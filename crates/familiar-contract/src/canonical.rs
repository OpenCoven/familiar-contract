//! Canonical JSON and the profile's SHA-256 digests.
//!
//! The reference `canonicalJson` sorts object keys by UTF-16 code unit and
//! prints every other value with `JSON.stringify`. For I-JSON input that is
//! RFC 8785 (JCS). Numbers print as ECMAScript `Number.prototype.toString`
//! does, and strings escape only `"`, `\` and C0 controls.

use ring::digest::{digest, SHA256};
use serde_json::{Map, Value};

/// The canonical JSON text of `value`.
pub fn canonical_json(value: &Value) -> String {
    let mut out = String::new();
    write_value(value, &mut out);
    out
}

/// Lowercase hexadecimal SHA-256 of the canonical JSON text of `value`.
pub fn digest_object(value: &Value) -> String {
    sha256_hex(canonical_json(value).as_bytes())
}

/// The binding digest: the binding without `integrity`, `authentication` and
/// `commit.verifiedBindingDigest`.
pub fn binding_digest(binding: &Value) -> String {
    let mut committed = binding.clone();
    if let Some(object) = committed.as_object_mut() {
        object.remove("integrity");
        object.remove("authentication");
        if let Some(commit) = object.get_mut("commit").and_then(Value::as_object_mut) {
            commit.remove("verifiedBindingDigest");
        }
    }
    digest_object(&committed)
}

/// The post-commit revocation event digest: the event without `integrity` and
/// `authentication`.
pub fn revocation_digest(revocation: &Value) -> String {
    let mut committed = revocation.clone();
    if let Some(object) = committed.as_object_mut() {
        object.remove("integrity");
        object.remove("authentication");
    }
    digest_object(&committed)
}

/// The historical bundle digest: the bundle without `bundleDigest`. It covers
/// the retention and redaction state as well as the components.
pub fn bundle_digest(bundle: &Value) -> String {
    let mut copy = bundle.clone();
    if let Some(object) = copy.as_object_mut() {
        object.remove("bundleDigest");
    }
    digest_object(&copy)
}

/// The fields a lineage transition signs, in a fixed six-member object.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TransitionPreimage<'a> {
    pub relationship: &'a str,
    pub predecessor_bundle_digest: &'a str,
    pub successor_familiar_root_id: &'a str,
    pub successor_identity_revision_id: &'a str,
    pub successor_bundle_digest: &'a str,
    pub successor_declaration_digest: &'a str,
}

/// The digest a lineage transition's authentication signs.
pub fn transition_digest(transition: &TransitionPreimage<'_>) -> String {
    let mut object = Map::new();
    for (key, value) in [
        ("relationship", transition.relationship),
        (
            "predecessorBundleDigest",
            transition.predecessor_bundle_digest,
        ),
        (
            "successorFamiliarRootId",
            transition.successor_familiar_root_id,
        ),
        (
            "successorIdentityRevisionId",
            transition.successor_identity_revision_id,
        ),
        ("successorBundleDigest", transition.successor_bundle_digest),
        (
            "successorDeclarationDigest",
            transition.successor_declaration_digest,
        ),
    ] {
        object.insert(key.to_owned(), Value::String(value.to_owned()));
    }
    digest_object(&Value::Object(object))
}

pub(crate) fn sha256_hex(bytes: &[u8]) -> String {
    digest(&SHA256, bytes)
        .as_ref()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn write_value(value: &Value, out: &mut String) {
    match value {
        Value::Null => out.push_str("null"),
        Value::Bool(true) => out.push_str("true"),
        Value::Bool(false) => out.push_str("false"),
        Value::Number(number) => match number.as_f64() {
            Some(float) if float.is_finite() => {
                out.push_str(ryu_js::Buffer::new().format_finite(float));
            }
            // JSON.stringify prints a non-finite number as null.
            _ => out.push_str("null"),
        },
        Value::String(text) => write_string(text, out),
        Value::Array(items) => {
            out.push('[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                write_value(item, out);
            }
            out.push(']');
        }
        Value::Object(object) => {
            let mut keys: Vec<&String> = object.keys().collect();
            keys.sort_by(|left, right| left.encode_utf16().cmp(right.encode_utf16()));
            out.push('{');
            for (index, key) in keys.into_iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                write_string(key, out);
                out.push(':');
                write_value(&object[key], out);
            }
            out.push('}');
        }
    }
}

fn write_string(text: &str, out: &mut String) {
    out.push('"');
    for ch in text.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\u{8}' => out.push_str("\\b"),
            '\u{c}' => out.push_str("\\f"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            '\u{0}'..='\u{1f}' => out.push_str(&format!("\\u{:04x}", u32::from(ch))),
            _ => out.push(ch),
        }
    }
    out.push('"');
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn numbers_print_as_ecmascript_does() {
        // Expected strings are what `JSON.stringify` prints in Node.
        let cases = [
            (json!(0), "0"),
            (json!(-0.0), "0"),
            (json!(1), "1"),
            (json!(100), "100"),
            (json!(0.5), "0.5"),
            (json!(0.1 + 0.2), "0.30000000000000004"),
            (json!(1e21), "1e+21"),
            (json!(1e20), "100000000000000000000"),
            (json!(1e-7), "1e-7"),
            (json!(0.000001), "0.000001"),
            (json!(123.456), "123.456"),
            (json!(5e-324), "5e-324"),
            (json!(1.7976931348623157e308), "1.7976931348623157e+308"),
            (json!(9_007_199_254_740_992_u64), "9007199254740992"),
            (json!(-42), "-42"),
        ];
        for (value, expected) in cases {
            assert_eq!(canonical_json(&value), expected, "{value}");
        }
    }

    #[test]
    fn strings_escape_as_json_stringify_does() {
        let value = json!("a\"b\\c\u{8}\u{c}\n\r\t\u{1}\u{1f}\u{7f}\u{2028}é\u{1f600}/");
        assert_eq!(
            canonical_json(&value),
            "\"a\\\"b\\\\c\\b\\f\\n\\r\\t\\u0001\\u001f\u{7f}\u{2028}é\u{1f600}/\""
        );
    }

    #[test]
    fn keys_sort_by_utf16_code_unit() {
        // By code point U+FF61 sorts before U+1F600, but by UTF-16 code unit
        // it sorts after, since U+1F600 is the surrogate pair D83D DE00.
        let value = json!({"b": 1, "a": {"z": [true, null], "y": false}, "\u{1f600}": 2, "\u{ff61}": 3, "B": 4});
        assert_eq!(
            canonical_json(&value),
            "{\"B\":4,\"a\":{\"y\":false,\"z\":[true,null]},\"b\":1,\"\u{1f600}\":2,\"\u{ff61}\":3}"
        );
    }

    #[test]
    fn digests_omit_their_own_members() {
        let binding = json!({
            "a": 1, "integrity": {"bindingDigest": "x"}, "authentication": {},
            "commit": {"verifiedBindingDigest": "x", "state": "committed"}
        });
        assert_eq!(
            binding_digest(&binding),
            digest_object(&json!({"a": 1, "commit": {"state": "committed"}}))
        );
        let revocation = json!({"a": 1, "integrity": {}, "authentication": {}});
        assert_eq!(
            revocation_digest(&revocation),
            digest_object(&json!({"a": 1}))
        );
        let bundle = json!({"a": 1, "bundleDigest": {}});
        assert_eq!(bundle_digest(&bundle), digest_object(&json!({"a": 1})));
        assert_eq!(
            sha256_hex(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }
}
