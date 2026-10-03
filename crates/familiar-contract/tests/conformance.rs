//! Runs every embodiment-binding conformance vector against the Rust verifier,
//! wired exactly as `tests/conformance/run-conformance.sh` wires them for the
//! JavaScript validator: a sidecar with the vector's file name under
//! `bundles/`, `ledgers/` or `revocations/` is supplied when it exists.

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use familiar_contract::{verify, EmbodimentInputs};
use serde_json::Value;

fn suite() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tests/conformance/embodiment-bindings")
}

fn read(path: &Path) -> String {
    String::from_utf8_lossy(&fs::read(path).unwrap()).into_owned()
}

fn sidecar(kind: &str, file: &str) -> Option<String> {
    let path = suite().join(kind).join(file);
    path.is_file().then(|| read(&path))
}

/// The codes the verifier emits for one vector.
fn codes(kind: &str, file: &str) -> Vec<String> {
    let binding = read(&suite().join(kind).join(file));
    let (bundle, ledger, revocation) = (
        sidecar("bundles", file),
        sidecar("ledgers", file),
        sidecar("revocations", file),
    );
    verify(&EmbodimentInputs {
        binding: &binding,
        historical_bundle: bundle.as_deref(),
        trusted_ledger: ledger.as_deref(),
        post_commit_revocation: revocation.as_deref(),
    })
    .iter()
    .map(|violation| violation.code.as_str().to_owned())
    .collect()
}

fn manifest() -> Value {
    serde_json::from_str(&read(&suite().join("manifest.json"))).unwrap()
}

#[test]
fn manifest_enumerates_exactly_the_vectors_on_disk() {
    let manifest = manifest();
    assert_eq!(manifest["profile"], "familiar.embodiment_binding.v1");
    for kind in ["positive", "negative"] {
        let listed: BTreeSet<String> = manifest[kind]
            .as_array()
            .unwrap()
            .iter()
            .map(|entry| {
                assert_eq!(entry["expected"], kind);
                assert_eq!(entry["errorCode"].is_null(), kind == "positive", "{entry}");
                entry["file"].as_str().unwrap().to_owned()
            })
            .collect();
        let on_disk: BTreeSet<String> = fs::read_dir(suite().join(kind))
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .filter(|name| name.ends_with(".json"))
            .collect();
        assert_eq!(listed, on_disk, "{kind}");
    }
}

#[test]
fn every_positive_vector_passes() {
    let manifest = manifest();
    let positives = manifest["positive"].as_array().unwrap();
    assert_eq!(positives.len(), 23);
    let failures: Vec<String> = positives
        .iter()
        .map(|entry| entry["file"].as_str().unwrap())
        .filter_map(|file| {
            let codes = codes("positive", file);
            (!codes.is_empty()).then(|| format!("{file}: {codes:?}"))
        })
        .collect();
    assert!(
        failures.is_empty(),
        "positive vectors failed:\n{}",
        failures.join("\n")
    );
}

#[test]
fn every_negative_vector_fails_with_its_code() {
    let manifest = manifest();
    let negatives = manifest["negative"].as_array().unwrap();
    assert_eq!(negatives.len(), 68);
    let failures: Vec<String> = negatives
        .iter()
        .filter_map(|entry| {
            let file = entry["file"].as_str().unwrap();
            let expected = entry["errorCode"].as_str().unwrap();
            let codes = codes("negative", file);
            (!codes.iter().any(|code| code == expected))
                .then(|| format!("{file}: expected {expected}, got {codes:?}"))
        })
        .collect();
    assert!(
        failures.is_empty(),
        "negative vectors misbehaved:\n{}",
        failures.join("\n")
    );
}

/// Arbitrarily deep input in any role fails closed, without overflowing the
/// stack while parsing, validating, hashing or dropping it.
#[test]
fn deep_inputs_fail_closed_without_overflowing() {
    let depth = 200_000;
    let arrays = "[".repeat(depth) + &"]".repeat(depth);
    let member = format!(r#"{{"schemaVersion":"1.0.0","deep":{arrays}}}"#);
    let file = "01-active-direct.json";
    let binding = read(&suite().join("positive").join(file));
    let bundle = sidecar("bundles", file).unwrap();
    let ledger = sidecar("ledgers", file).unwrap();
    let deep_content = bundle.replacen(
        r#""content": {"#,
        &format!(r#""content": {{"deep": {arrays}, "#),
        1,
    );
    assert_ne!(deep_content, bundle, "the bundle has retained content");
    let run = |inputs: EmbodimentInputs<'_>| -> Vec<&'static str> {
        verify(&inputs)
            .iter()
            .map(|violation| violation.code.as_str())
            .collect()
    };
    let with = |binding: &str, bundle: &str, ledger: &str, revocation: Option<&str>| {
        run(EmbodimentInputs {
            binding,
            historical_bundle: Some(bundle),
            trusted_ledger: Some(ledger),
            post_commit_revocation: revocation,
        })
    };
    assert_eq!(with(&arrays, &bundle, &ledger, None), ["E_SCHEMA"]);
    assert!(with(&member, &bundle, &ledger, None).contains(&"E_SCHEMA"));
    assert!(with(&binding, &arrays, &ledger, None).contains(&"E_BUNDLE_SCHEMA"));
    assert!(with(&binding, &deep_content, &ledger, None).contains(&"E_COMPONENT_DIGEST"));
    assert!(with(&binding, &bundle, &arrays, None).contains(&"E_TRUSTED_LEDGER"));
    assert!(with(&binding, &bundle, &ledger, Some(&arrays)).contains(&"E_REVOCATION"));
    assert!(with(&binding, &bundle, &ledger, None).is_empty());
}
