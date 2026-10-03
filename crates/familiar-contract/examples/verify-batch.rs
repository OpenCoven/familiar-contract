//! Verifies many cases in one process, for the differential test in
//! `tests/conformance/rust-differential.js`.
//!
//! Reads JSON Lines from stdin, one case per line:
//! `{"binding": "<text>", "historicalBundle": "<text>", "trustedLedger": "<text>",
//! "postCommitRevocation": "<text>"}`, where an absent sidecar is not supplied.
//! Writes one line per case: the sorted, de-duplicated codes as a JSON array,
//! with `null` for an uncoded violation.

use std::collections::BTreeSet;
use std::io::{self, BufRead, Write};

use familiar_contract::{verify, EmbodimentInputs};
use serde_json::Value;

fn main() -> io::Result<()> {
    let stdout = io::stdout();
    let mut out = stdout.lock();
    for line in io::stdin().lock().lines() {
        let case: Value = serde_json::from_str(&line?)?;
        let text = |key: &str| case.get(key).and_then(Value::as_str);
        let codes: BTreeSet<Option<&str>> = verify(&EmbodimentInputs {
            binding: text("binding").unwrap_or_default(),
            historical_bundle: text("historicalBundle"),
            trusted_ledger: text("trustedLedger"),
            post_commit_revocation: text("postCommitRevocation"),
        })
        .iter()
        .map(|violation| violation.code.map(|code| code.as_str()))
        .collect();
        writeln!(out, "{}", serde_json::to_string(&codes)?)?;
    }
    Ok(())
}
