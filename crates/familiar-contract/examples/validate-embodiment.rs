//! The Rust counterpart of `node validators/validate.js --embodiment-binding`,
//! with the same options, the same strict option parsing and the same exit
//! codes. `tests/conformance/run-rust-parity.sh` runs both over every vector.
//!
//! ```sh
//! cargo run -q --example validate-embodiment -- --embodiment-binding binding.json \
//!   [--historical-bundle bundle.json] [--trusted-ledger ledger.json] \
//!   [--post-commit-revocation revocation.json]
//! ```

use std::path::Path;
use std::process::ExitCode;

use familiar_contract::{verify, EmbodimentInputs};

fn read(path: &str, what: &str) -> Result<String, String> {
    if !Path::new(path).is_file() {
        return Err(format!("Error: {what} file not found: {path}"));
    }
    // Node reads with 'utf8', which replaces invalid sequences with U+FFFD.
    std::fs::read(path)
        .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
        .map_err(|error| format!("Error: cannot read {path}: {error}"))
}

fn run(args: &[String]) -> Result<bool, String> {
    if args.first().map(String::as_str) != Some("--embodiment-binding") || args.len() < 2 {
        return Err("Error: --embodiment-binding requires a JSON file.".to_owned());
    }
    let binding = read(&args[1], "Binding")?;
    let mut sidecars: [Option<String>; 3] = [None, None, None];
    for pair in args[2..].chunks(2) {
        let slot = match pair[0].as_str() {
            "--historical-bundle" => 0,
            "--trusted-ledger" => 1,
            "--post-commit-revocation" => 2,
            _ => usize::MAX,
        };
        let value = pair
            .get(1)
            .filter(|value| !value.is_empty() && !value.starts_with("--"));
        match (sidecars.get(slot), value) {
            (Some(None), Some(value)) => sidecars[slot] = Some(value.clone()),
            _ => {
                return Err(format!(
                    "Error: Unknown, duplicate, or valueless embodiment option: {}",
                    pair[0]
                ))
            }
        }
    }
    let [bundle, ledger, revocation] = sidecars;
    let bundle = bundle
        .map(|path| read(&path, "Historical bundle"))
        .transpose()?;
    let ledger = ledger
        .map(|path| read(&path, "Trusted ledger"))
        .transpose()?;
    let revocation = revocation
        .map(|path| read(&path, "Post-commit revocation"))
        .transpose()?;
    let violations = verify(&EmbodimentInputs {
        binding: &binding,
        historical_bundle: bundle.as_deref(),
        trusted_ledger: ledger.as_deref(),
        post_commit_revocation: revocation.as_deref(),
    });
    if violations.is_empty() {
        println!("PASS: embodiment binding validation passed.");
        return Ok(true);
    }
    println!(
        "FAIL: {} embodiment-binding violation(s):",
        violations.len()
    );
    for violation in &violations {
        println!("  {violation}");
    }
    Ok(false)
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match run(&args) {
        Ok(true) => ExitCode::SUCCESS,
        Ok(false) => ExitCode::FAILURE,
        Err(message) => {
            eprintln!("{message}");
            ExitCode::FAILURE
        }
    }
}
