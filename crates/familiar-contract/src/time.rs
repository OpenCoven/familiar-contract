//! Timestamps, as the reference validator reads them.
//!
//! [`is_timestamp`] is the reference `isTimestamp`: RFC 3339 shape with ASCII
//! digits, an optional fraction of one to three digits, `Z` or an offset, and
//! a real calendar date that `Date.UTC` maps back to itself, which excludes
//! years before 0100.
//!
//! [`date_ms`] is `new Date(value).getTime()` as V8 computes it for a string
//! of that shape. It is looser: it accepts years before 0100, an hour of 24
//! when the rest of the time is zero, and any day up to 31, rolling
//! `2026-02-30` over to March 2. Anything else is NaN, which compares false
//! exactly as JavaScript's NaN does.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Parts {
    year: i64,
    month: i64,
    day: i64,
    hour: i64,
    minute: i64,
    second: i64,
    millis: i64,
    /// Signed offset east of UTC, in minutes, before any range check.
    offset_hours: i64,
    offset_minutes: i64,
    offset_sign: i64,
}

/// The reference validator's strict calendar timestamp check.
pub fn is_timestamp(value: &str) -> bool {
    let Some(parts) = shape(value) else {
        return false;
    };
    (1..=12).contains(&parts.month)
        && parts.hour <= 23
        && parts.minute <= 59
        && parts.second <= 59
        && parts.offset_hours <= 23
        && parts.offset_minutes <= 59
        // Date.UTC maps years 0-99 to 1900-1999, so they never round-trip.
        && parts.year >= 100
        && parts.day >= 1
        && parts.day <= days_in_month(parts.year, parts.month)
}

/// Milliseconds since the epoch, as `new Date(value).getTime()` returns them,
/// or NaN.
pub fn date_ms(value: &str) -> f64 {
    let Some(parts) = shape(value) else {
        return f64::NAN;
    };
    let end_of_day =
        parts.hour == 24 && parts.minute == 0 && parts.second == 0 && parts.millis == 0;
    if !(1..=12).contains(&parts.month)
        || !(1..=31).contains(&parts.day)
        || (parts.hour > 23 && !end_of_day)
        || parts.minute > 59
        || parts.second > 59
        || parts.offset_hours > 23
        || parts.offset_minutes > 59
    {
        return f64::NAN;
    }
    let days = days_from_civil(parts.year, parts.month, 1) + parts.day - 1;
    let offset = parts.offset_sign * (parts.offset_hours * 60 + parts.offset_minutes);
    let millis = days * 86_400_000
        + parts.hour * 3_600_000
        + parts.minute * 60_000
        + parts.second * 1_000
        + parts.millis
        - offset * 60_000;
    millis as f64
}

/// `^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|([+-])(\d{2}):(\d{2}))$`
/// with JavaScript's ASCII-only `\d`.
fn shape(value: &str) -> Option<Parts> {
    let bytes = value.as_bytes();
    let number = |range: std::ops::Range<usize>| -> Option<i64> {
        let digits = bytes.get(range)?;
        if !digits.iter().all(u8::is_ascii_digit) {
            return None;
        }
        Some(
            digits
                .iter()
                .fold(0, |sum, digit| sum * 10 + i64::from(digit - b'0')),
        )
    };
    let at = |index: usize, expected: u8| bytes.get(index) == Some(&expected);
    if !(at(4, b'-') && at(7, b'-') && at(10, b'T') && at(13, b':') && at(16, b':')) {
        return None;
    }
    let mut parts = Parts {
        year: number(0..4)?,
        month: number(5..7)?,
        day: number(8..10)?,
        hour: number(11..13)?,
        minute: number(14..16)?,
        second: number(17..19)?,
        millis: 0,
        offset_hours: 0,
        offset_minutes: 0,
        offset_sign: 0,
    };
    let mut index = 19;
    if at(index, b'.') {
        let start = index + 1;
        let mut end = start;
        while end < bytes.len() && end - start < 3 && bytes[end].is_ascii_digit() {
            end += 1;
        }
        if end == start {
            return None;
        }
        // ".5" is 500 ms and ".12" is 120 ms.
        let fraction = number(start..end)?;
        parts.millis = fraction * 10_i64.pow(3 - u32::try_from(end - start).ok()?);
        index = end;
    }
    match bytes.get(index) {
        Some(b'Z') if index + 1 == bytes.len() => Some(parts),
        Some(sign @ (b'+' | b'-')) if index + 6 == bytes.len() && at(index + 3, b':') => {
            parts.offset_sign = if *sign == b'+' { 1 } else { -1 };
            parts.offset_hours = number(index + 1..index + 3)?;
            parts.offset_minutes = number(index + 4..index + 6)?;
            Some(parts)
        }
        _ => None,
    }
}

fn is_leap(year: i64) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

fn days_in_month(year: i64, month: i64) -> i64 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if is_leap(year) => 29,
        2 => 28,
        _ => 0,
    }
}

/// Days from 1970-01-01 to the proleptic Gregorian date (Howard Hinnant).
fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let year = if month <= 2 { year - 1 } else { year };
    let era = year.div_euclid(400);
    let year_of_era = year - era * 400;
    let month_index = (month + 9) % 12;
    let day_of_year = (153 * month_index + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146_097 + day_of_era - 719_468
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strict_timestamps_match_the_reference() {
        for valid in [
            "2026-10-03T09:00:00Z",
            "2026-10-03T09:00:00.5Z",
            "2026-10-03T09:00:00.123+05:30",
            "2024-02-29T23:59:59-23:59",
            "0100-01-01T00:00:00Z",
            "9999-12-31T23:59:59.999Z",
        ] {
            assert!(is_timestamp(valid), "{valid}");
        }
        for invalid in [
            "2026-02-29T00:00:00Z",
            "2026-04-31T00:00:00Z",
            "2026-13-01T00:00:00Z",
            "2026-00-01T00:00:00Z",
            "2026-01-00T00:00:00Z",
            "2026-01-01T24:00:00Z",
            "2026-01-01T00:60:00Z",
            "2026-01-01T00:00:60Z",
            "2026-01-01T00:00:00+24:00",
            "2026-01-01T00:00:00+23:60",
            "0099-12-31T00:00:00Z",
            "2026-01-01T00:00:00",
            "2026-01-01T00:00:00.Z",
            "2026-01-01T00:00:00.1234Z",
            "2026-01-01 00:00:00Z",
            "2026-01-01T00:00:00z",
            "2026-01-01T00:00:00+0000",
            "٢٠٢٦-01-01T00:00:00Z",
            " 2026-01-01T00:00:00Z",
        ] {
            assert!(!is_timestamp(invalid), "{invalid}");
        }
    }

    #[test]
    fn date_ms_matches_v8() {
        // Expected values are `new Date(value).getTime()` in Node 24.
        let cases = [
            ("2026-02-30T00:00:00Z", 1_772_409_600_000.0),
            ("2026-02-29T00:00:00Z", 1_772_323_200_000.0),
            ("2026-04-31T00:00:00Z", 1_777_593_600_000.0),
            ("2026-01-01T24:00:00Z", 1_767_312_000_000.0),
            ("0099-01-01T00:00:00Z", -59_042_995_200_000.0),
            ("0000-01-01T00:00:00Z", -62_167_219_200_000.0),
            ("2026-01-01T00:00:00.5Z", 1_767_225_600_500.0),
            ("2026-01-01T00:00:00.123+05:30", 1_767_205_800_123.0),
        ];
        for (value, expected) in cases {
            assert_eq!(date_ms(value), expected, "{value}");
        }
        for nan in [
            "2026-13-01T00:00:00Z",
            "2026-00-10T00:00:00Z",
            "2026-01-00T00:00:00Z",
            "2026-01-32T00:00:00Z",
            "2026-01-01T24:00:01Z",
            "2026-01-01T25:00:00Z",
            "2026-01-01T00:60:00Z",
            "2026-01-01T00:00:60Z",
            "2026-01-01T00:00:00+24:00",
            "2026-01-01T00:00:00+23:60",
            "not a time",
        ] {
            assert!(date_ms(nan).is_nan(), "{nan}");
        }
    }
}
