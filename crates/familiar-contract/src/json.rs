//! Strict JSON parsing with the reference validator's semantics.
//!
//! `validators/validate.js` parses each input with `parseJsonNoDuplicate`, a
//! duplicate-key scan followed by `JSON.parse`, and then checks the result with
//! `hasInvalidIJsonValue`. This module does both in one pass:
//!
//! - syntax is exactly ECMA-404 JSON, as `JSON.parse` accepts it;
//! - duplicate object keys are compared as decoded UTF-16, as JavaScript does;
//! - a lone UTF-16 surrogate in a key or string, or a number that is not a
//!   finite double, marks the document as not I-JSON instead of failing to
//!   parse, because `JSON.parse` accepts both.
//!
//! Every number is normalized to the double JavaScript would hold, so `3.0`
//! and `1e2` become the integers `3` and `100`, and `9007199254740993` becomes
//! `9007199254740992`. Schema checks, comparisons and canonical bytes then see
//! the same value JavaScript does.
//!
//! Parsing, and dropping a [`Parsed`] document, are iterative, so nesting
//! depth is bounded only by the input's size and never by the stack. The
//! reference has no stated limit either; its recursive scanner fails at an
//! engine-dependent depth (about 4,500 levels in Node 24), which no fixed
//! limit here could match.

use std::collections::HashSet;

use serde_json::{Map, Number, Value};

/// A document that `JSON.parse` would reject, or that repeats an object key.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SyntaxError(pub String);

/// A parsed document. Dropping it tears the value down iteratively, so a
/// deeply nested document cannot overflow the stack.
#[derive(Debug)]
pub struct Parsed {
    /// The document, with numbers normalized to their JavaScript value. A lone
    /// surrogate is replaced by U+FFFD, and a non-finite number by `null`;
    /// either one also sets `not_i_json`.
    pub value: Value,
    /// True when the document holds a lone UTF-16 surrogate or a number that
    /// does not fit a finite double.
    pub not_i_json: bool,
}

impl Drop for Parsed {
    fn drop(&mut self) {
        dismantle(std::mem::take(&mut self.value));
    }
}

/// Drops `value` without recursion. serde_json's own `Drop` recurses once per
/// nesting level.
pub(crate) fn dismantle(value: Value) {
    let mut pending = vec![value];
    while let Some(value) = pending.pop() {
        match value {
            Value::Array(items) => pending.extend(items),
            Value::Object(object) => pending.extend(object.into_iter().map(|(_, item)| item)),
            _ => {}
        }
    }
}

/// Parses `text` as one JSON document.
pub fn parse(text: &str) -> Result<Parsed, SyntaxError> {
    let mut parser = Parser {
        bytes: text.as_bytes(),
        text,
        at: 0,
        not_i_json: false,
        open: Vec::new(),
    };
    match parser.document() {
        Ok(value) => Ok(Parsed {
            value,
            not_i_json: parser.not_i_json,
        }),
        Err(error) => {
            for frame in parser.open.drain(..) {
                match frame {
                    Frame::Array(items) => dismantle(Value::Array(items)),
                    Frame::Object { map, .. } => dismantle(Value::Object(map)),
                }
            }
            Err(error)
        }
    }
}

/// Formats a JSON number the way JavaScript would hold it: integer-valued
/// doubles become exact integers, everything else stays a double.
pub(crate) fn js_number(value: f64) -> Option<Number> {
    if !value.is_finite() {
        return None;
    }
    // 2^63: every integer-valued double below it converts exactly.
    if value.fract() == 0.0 && value.abs() < 9_223_372_036_854_775_808.0 {
        if value >= 0.0 {
            return Some(Number::from(value as u64));
        }
        return Some(Number::from(value as i64));
    }
    Number::from_f64(value)
}

/// A container still being read.
enum Frame {
    Array(Vec<Value>),
    Object {
        map: Map<String, Value>,
        keys: HashSet<Vec<u16>>,
        /// The member whose value is being read.
        key: String,
    },
}

struct Parser<'a> {
    bytes: &'a [u8],
    text: &'a str,
    at: usize,
    not_i_json: bool,
    /// Open containers, outermost first.
    open: Vec<Frame>,
}

impl Parser<'_> {
    fn error(&self, message: &str) -> SyntaxError {
        SyntaxError(format!("{message} at byte {}", self.at))
    }

    fn peek(&self) -> Option<u8> {
        self.bytes.get(self.at).copied()
    }

    fn whitespace(&mut self) {
        while matches!(self.peek(), Some(b' ' | b'\t' | b'\n' | b'\r')) {
            self.at += 1;
        }
    }

    /// The whole document: one value and nothing after it.
    fn document(&mut self) -> Result<Value, SyntaxError> {
        loop {
            self.whitespace();
            let Some(mut value) = self.open_or_scalar()? else {
                // A container opened; read its first element or member.
                continue;
            };
            // Attach the finished value, closing every container it ends.
            loop {
                self.whitespace();
                match self.open.last_mut() {
                    None => {
                        if self.at != self.bytes.len() {
                            dismantle(value);
                            return Err(self.error("trailing input"));
                        }
                        return Ok(value);
                    }
                    Some(Frame::Array(items)) => {
                        items.push(value);
                        match self.peek() {
                            Some(b',') => {
                                self.at += 1;
                                break;
                            }
                            Some(b']') => {
                                self.at += 1;
                                let Some(Frame::Array(items)) = self.open.pop() else {
                                    unreachable!("the last frame is an array");
                                };
                                value = Value::Array(items);
                            }
                            _ => return Err(self.error("expected `,` or `]`")),
                        }
                    }
                    Some(Frame::Object { map, key, .. }) => {
                        map.insert(std::mem::take(key), value);
                        match self.peek() {
                            Some(b',') => {
                                self.at += 1;
                                self.member_key()?;
                                break;
                            }
                            Some(b'}') => {
                                self.at += 1;
                                let Some(Frame::Object { map, .. }) = self.open.pop() else {
                                    unreachable!("the last frame is an object");
                                };
                                value = Value::Object(map);
                            }
                            _ => return Err(self.error("expected `,` or `}`")),
                        }
                    }
                }
            }
        }
    }

    /// Reads a scalar, or an empty container, as a finished value. A non-empty
    /// container is pushed as an open frame instead, and `None` returned.
    fn open_or_scalar(&mut self) -> Result<Option<Value>, SyntaxError> {
        match self.peek() {
            Some(b'[') => {
                self.at += 1;
                self.whitespace();
                if self.peek() == Some(b']') {
                    self.at += 1;
                    return Ok(Some(Value::Array(Vec::new())));
                }
                self.open.push(Frame::Array(Vec::new()));
                Ok(None)
            }
            Some(b'{') => {
                self.at += 1;
                self.whitespace();
                if self.peek() == Some(b'}') {
                    self.at += 1;
                    return Ok(Some(Value::Object(Map::new())));
                }
                self.open.push(Frame::Object {
                    map: Map::new(),
                    keys: HashSet::new(),
                    key: String::new(),
                });
                self.member_key()?;
                Ok(None)
            }
            Some(b'"') => Ok(Some(Value::String(self.string()?.text))),
            Some(b't') => self.literal("true", Value::Bool(true)).map(Some),
            Some(b'f') => self.literal("false", Value::Bool(false)).map(Some),
            Some(b'n') => self.literal("null", Value::Null).map(Some),
            Some(b'-' | b'0'..=b'9') => self.number().map(Some),
            Some(_) => Err(self.error("unexpected token")),
            None => Err(self.error("unexpected end of input")),
        }
    }

    /// Reads `"key":` for the innermost open object.
    fn member_key(&mut self) -> Result<(), SyntaxError> {
        self.whitespace();
        if self.peek() != Some(b'"') {
            return Err(self.error("expected a string key"));
        }
        let decoded = self.string()?;
        self.whitespace();
        if self.peek() != Some(b':') {
            return Err(self.error("expected colon"));
        }
        self.at += 1;
        let at = self.at;
        let Some(Frame::Object { keys, key, .. }) = self.open.last_mut() else {
            unreachable!("a key is read only inside an object");
        };
        if !keys.insert(decoded.units) {
            return Err(SyntaxError(format!("duplicate object key at byte {at}")));
        }
        *key = decoded.text;
        Ok(())
    }

    fn literal(&mut self, word: &str, value: Value) -> Result<Value, SyntaxError> {
        if self.bytes[self.at..].starts_with(word.as_bytes()) {
            self.at += word.len();
            Ok(value)
        } else {
            Err(self.error("unexpected token"))
        }
    }

    fn number(&mut self) -> Result<Value, SyntaxError> {
        let start = self.at;
        if self.peek() == Some(b'-') {
            self.at += 1;
        }
        match self.peek() {
            Some(b'0') => self.at += 1,
            Some(b'1'..=b'9') => self.digits(),
            _ => return Err(self.error("invalid number")),
        }
        if self.peek() == Some(b'.') {
            self.at += 1;
            if !matches!(self.peek(), Some(b'0'..=b'9')) {
                return Err(self.error("invalid number"));
            }
            self.digits();
        }
        if matches!(self.peek(), Some(b'e' | b'E')) {
            self.at += 1;
            if matches!(self.peek(), Some(b'+' | b'-')) {
                self.at += 1;
            }
            if !matches!(self.peek(), Some(b'0'..=b'9')) {
                return Err(self.error("invalid number"));
            }
            self.digits();
        }
        let literal = &self.text[start..self.at];
        // Rust's float parsing rounds to nearest like JavaScript's Number().
        let value: f64 = literal.parse().map_err(|_| self.error("invalid number"))?;
        match js_number(value) {
            Some(number) => Ok(Value::Number(number)),
            None => {
                self.not_i_json = true;
                Ok(Value::Null)
            }
        }
    }

    fn digits(&mut self) {
        while matches!(self.peek(), Some(b'0'..=b'9')) {
            self.at += 1;
        }
    }

    fn string(&mut self) -> Result<DecodedString, SyntaxError> {
        self.at += 1;
        let mut units: Vec<u16> = Vec::new();
        loop {
            let Some(byte) = self.peek() else {
                return Err(self.error("unterminated string"));
            };
            match byte {
                b'"' => {
                    self.at += 1;
                    break;
                }
                b'\\' => {
                    self.at += 1;
                    let escaped = self.peek().ok_or_else(|| self.error("bad escape"))?;
                    self.at += 1;
                    let unit = match escaped {
                        b'"' => 0x22,
                        b'\\' => 0x5c,
                        b'/' => 0x2f,
                        b'b' => 0x08,
                        b'f' => 0x0c,
                        b'n' => 0x0a,
                        b'r' => 0x0d,
                        b't' => 0x09,
                        b'u' => self.hex4()?,
                        _ => return Err(self.error("bad escape")),
                    };
                    units.push(unit);
                }
                0x00..=0x1f => return Err(self.error("control character in string")),
                _ => {
                    // `text` is valid UTF-8, so the next char starts here.
                    let ch = self.text[self.at..]
                        .chars()
                        .next()
                        .ok_or_else(|| self.error("unterminated string"))?;
                    self.at += ch.len_utf8();
                    let mut buffer = [0_u16; 2];
                    units.extend_from_slice(ch.encode_utf16(&mut buffer));
                }
            }
        }
        let mut lone = false;
        let text = char::decode_utf16(units.iter().copied())
            .map(|decoded| {
                decoded.unwrap_or_else(|_| {
                    lone = true;
                    char::REPLACEMENT_CHARACTER
                })
            })
            .collect();
        if lone {
            self.not_i_json = true;
        }
        Ok(DecodedString { text, units })
    }

    fn hex4(&mut self) -> Result<u16, SyntaxError> {
        let digits = self
            .text
            .get(self.at..self.at + 4)
            .ok_or_else(|| self.error("bad unicode escape"))?;
        if !digits.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err(self.error("bad unicode escape"));
        }
        self.at += 4;
        u16::from_str_radix(digits, 16).map_err(|_| self.error("bad unicode escape"))
    }
}

struct DecodedString {
    text: String,
    /// The exact UTF-16 code units, lone surrogates included, so keys compare
    /// as JavaScript compares them.
    units: Vec<u16>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn ok(text: &str) -> Parsed {
        parse(text).unwrap_or_else(|error| panic!("{text}: {error:?}"))
    }

    #[test]
    fn parses_json_and_normalizes_numbers_to_javascript_values() {
        let parsed = ok(r#" {"a": [1, 3.0, 1e2, -0, 0.5, 9007199254740993, 1e300], "b": null} "#);
        assert!(!parsed.not_i_json);
        assert_eq!(
            parsed.value,
            json!({"a": [1, 3, 100, 0, 0.5, 9_007_199_254_740_992_u64, 1e300], "b": null})
        );
        assert_eq!(
            ok(r#"[[], {}, [[1], {"a": {"b": []}}], "x", true, false, null]"#).value,
            json!([[], {}, [[1], {"a": {"b": []}}], "x", true, false, null])
        );
    }

    #[test]
    fn rejects_what_json_parse_rejects() {
        for text in [
            "",
            " ",
            "{",
            "[",
            "[1,]",
            "{\"a\":1,}",
            "{\"a\"}",
            "{\"a\":}",
            "{,}",
            "[,1]",
            "01",
            "1.",
            ".5",
            "+1",
            "1e",
            "-",
            "tru",
            "nul",
            "'a'",
            "\"a",
            "\"\\x\"",
            "\"\\u12\"",
            "\"\t\"",
            "{a:1}",
            "[1 2]",
            "1 2",
            "[1]]",
            "{}}",
            "[}",
            "{]",
            "\u{feff}{}",
            "\u{a0}{}",
            "NaN",
            "Infinity",
        ] {
            assert!(parse(text).is_err(), "{text:?} must not parse");
        }
    }

    #[test]
    fn duplicate_keys_compare_decoded_utf16() {
        assert!(parse(r#"{"a":1,"a":2}"#).is_err());
        assert!(parse(r#"{"a":1,"\u0061":2}"#).is_err());
        assert!(parse(r#"{"a":{"b":1},"c":{"b":1}}"#).is_ok());
        assert!(parse(r#"{"a":{"b":1,"b":2}}"#).is_err());
        // Different lone surrogates are different keys, even though both
        // become U+FFFD in the parsed value.
        assert!(parse(r#"{"\ud800":1,"\ud801":2}"#).is_ok());
        assert!(parse(r#"{"\ud800":1,"\ud800":2}"#).is_err());
    }

    #[test]
    fn lone_surrogates_and_non_finite_numbers_are_not_i_json() {
        for text in [
            r#""\ud800""#,
            r#""\udc00""#,
            r#""a\ud800b""#,
            r#""\ud800\u0041""#,
            r#"{"\udfff":1}"#,
            "1e400",
            "-1e400",
            "[1, 2e999]",
        ] {
            assert!(ok(text).not_i_json, "{text} is not I-JSON");
        }
        for text in [
            r#""\ud83d\ude00""#,
            "\"\u{1f600}\"",
            "1e308",
            "5e-324",
            "1e-400",
        ] {
            assert!(!ok(text).not_i_json, "{text} is I-JSON");
        }
        assert_eq!(ok(r#""\ud83d\ude00""#).value, json!("\u{1f600}"));
    }

    #[test]
    fn nesting_depth_is_not_limited_by_the_stack() {
        // Far deeper than any recursive parser or Drop would survive.
        let depth = 1_000_000;
        let arrays = "[".repeat(depth) + &"]".repeat(depth);
        let parsed = ok(&arrays);
        let mut level = &parsed.value;
        let mut seen = 0;
        while let Some(inner) = level.as_array().and_then(|items| items.first()) {
            level = inner;
            seen += 1;
        }
        assert_eq!(seen, depth - 1);
        drop(parsed);
        let objects = r#"{"a":"#.repeat(depth) + "1" + &"}".repeat(depth);
        assert!(!ok(&objects).not_i_json);
        // A deep document that fails part-way is torn down without recursion.
        assert!(parse(&("[".repeat(depth) + "1,")).is_err());
        assert!(parse(&(r#"{"a":"#.repeat(depth) + "1" + &"}".repeat(depth) + "x")).is_err());
    }
}
