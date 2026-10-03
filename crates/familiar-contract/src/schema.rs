//! The profile's JSON Schemas, compiled from this repository's own files.
//!
//! The schemas under `schemas/` are normative, so the verifier embeds them
//! rather than restating their shape in Rust. They are draft-07 and use no
//! `format` keyword. `jsonschema` translates their ECMAScript patterns, so
//! `\d` stays ASCII-only, as it is for Ajv.

use std::sync::OnceLock;

use jsonschema::{Draft, Validator};
use serde_json::Value;

pub(crate) const BINDING_SCHEMA: &str =
    include_str!("../../../schemas/familiar-embodiment-binding.schema.json");
pub(crate) const BUNDLE_SCHEMA: &str =
    include_str!("../../../schemas/familiar-identity-bundle.schema.json");
pub(crate) const REVOCATION_SCHEMA: &str =
    include_str!("../../../schemas/familiar-embodiment-revocation.schema.json");

fn compile(source: &str) -> Validator {
    let schema: Value = serde_json::from_str(source).expect("bundled schema is valid JSON");
    jsonschema::options()
        .with_draft(Draft::Draft7)
        .should_validate_formats(false)
        .build(&schema)
        .expect("bundled schema compiles")
}

pub(crate) fn binding() -> &'static Validator {
    static VALIDATOR: OnceLock<Validator> = OnceLock::new();
    VALIDATOR.get_or_init(|| compile(BINDING_SCHEMA))
}

pub(crate) fn bundle() -> &'static Validator {
    static VALIDATOR: OnceLock<Validator> = OnceLock::new();
    VALIDATOR.get_or_init(|| compile(BUNDLE_SCHEMA))
}

pub(crate) fn revocation() -> &'static Validator {
    static VALIDATOR: OnceLock<Validator> = OnceLock::new();
    VALIDATOR.get_or_init(|| compile(REVOCATION_SCHEMA))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn schemas_compile_and_patterns_use_ascii_digits() {
        let _ = (binding(), bundle());
        let event = |revoked_at: &str| {
            json!({
                "profile": "familiar.embodiment_revocation.v1", "schemaVersion": "1.0.0",
                "revocationId": "revocation:1", "bindingId": "binding:1",
                "bindingDigest": "a".repeat(64), "familiarRootId": "root:oak",
                "identityRevisionId": "revision:oak:1", "revokedAt": revoked_at,
                "reasonCode": "compromised",
                "integrity": {"algorithm": "sha-256", "canonicalization": "jcs-rfc8785", "eventDigest": "b".repeat(64)},
                "authentication": {"method": "ed25519", "signerId": "signer:test", "publicKey": "QUJD", "signature": "QUJD"}
            })
        };
        assert!(revocation().is_valid(&event("2026-10-03T09:00:00Z")));
        // Arabic-Indic digits match Rust's Unicode \d, but not ECMAScript's.
        assert!(!revocation().is_valid(&event("٢٠٢٦-10-03T09:00:00Z")));
        assert!(!revocation().is_valid(&event("2026-10-03T09:00:00.1234Z")));
    }
}
