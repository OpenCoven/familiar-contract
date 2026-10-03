//! Rust verifier for the Familiar Contract's `familiar.embodiment_binding.v1`
//! profile.
//!
//! This is a port of `node validators/validate.js --embodiment-binding`. For
//! the same binding and sidecars it reports the same error codes, and the
//! conformance vectors under `tests/conformance/embodiment-bindings` run
//! against both. The JavaScript validator and the schemas under `schemas/`
//! remain the reference; a disagreement is a bug here.
//!
//! ```no_run
//! use familiar_contract::{verify, EmbodimentInputs};
//!
//! let binding = std::fs::read_to_string("binding.json").unwrap();
//! let ledger = std::fs::read_to_string("ledger.json").unwrap();
//! let violations = verify(&EmbodimentInputs {
//!     binding: &binding,
//!     trusted_ledger: Some(&ledger),
//!     ..EmbodimentInputs::default()
//! });
//! for violation in &violations {
//!     println!("{violation}");
//! }
//! ```
//!
//! **Trust is the caller's policy.** Each binding, lineage transition and
//! revocation event carries its own Ed25519 public key, and this crate checks
//! only that the document verifies under that key. A consumer must also check
//! that the key belongs to a signer it trusts; [`spki_public_key`] returns the
//! raw key for that. Likewise the trusted ledger sidecar must come from the
//! consumer's own authoritative source, never from the request being checked.

mod canonical;
mod ed25519;
mod json;
mod model;
mod schema;
mod time;
mod verify;

use std::borrow::Cow;
use std::fmt;

pub use canonical::{
    binding_digest, bundle_digest, canonical_json, digest_object, revocation_digest,
    transition_digest, TransitionPreimage,
};
pub use ed25519::spki_public_key;
pub use time::is_timestamp;
pub use verify::{verify, EmbodimentInputs};

/// The error codes the reference validator emits for embodiment bindings.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
#[non_exhaustive]
pub enum Code {
    Json,
    IJson,
    Schema,
    Version,
    Timestamp,
    BundleReference,
    BindingDigest,
    CommitDigest,
    Authentication,
    Snapshot,
    StaleCache,
    CacheTime,
    Alias,
    Principal,
    Ordering,
    Stale,
    Lineage,
    TrustedLedger,
    Status,
    History,
    Retention,
    BundleAccess,
    BundleMissing,
    Redaction,
    Revocation,
    BundleSchema,
    BundleIdentity,
    ComponentDigest,
    ComponentRequired,
    BundleDigest,
}

impl Code {
    /// The code as the reference prints it, such as `E_STALE_CACHE`.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Json => "E_JSON",
            Self::IJson => "E_IJSON",
            Self::Schema => "E_SCHEMA",
            Self::Version => "E_VERSION",
            Self::Timestamp => "E_TIMESTAMP",
            Self::BundleReference => "E_BUNDLE_REFERENCE",
            Self::BindingDigest => "E_BINDING_DIGEST",
            Self::CommitDigest => "E_COMMIT_DIGEST",
            Self::Authentication => "E_AUTHENTICATION",
            Self::Snapshot => "E_SNAPSHOT",
            Self::StaleCache => "E_STALE_CACHE",
            Self::CacheTime => "E_CACHE_TIME",
            Self::Alias => "E_ALIAS",
            Self::Principal => "E_PRINCIPAL",
            Self::Ordering => "E_ORDERING",
            Self::Stale => "E_STALE",
            Self::Lineage => "E_LINEAGE",
            Self::TrustedLedger => "E_TRUSTED_LEDGER",
            Self::Status => "E_STATUS",
            Self::History => "E_HISTORY",
            Self::Retention => "E_RETENTION",
            Self::BundleAccess => "E_BUNDLE_ACCESS",
            Self::BundleMissing => "E_BUNDLE_MISSING",
            Self::Redaction => "E_REDACTION",
            Self::Revocation => "E_REVOCATION",
            Self::BundleSchema => "E_BUNDLE_SCHEMA",
            Self::BundleIdentity => "E_BUNDLE_IDENTITY",
            Self::ComponentDigest => "E_COMPONENT_DIGEST",
            Self::ComponentRequired => "E_COMPONENT_REQUIRED",
            Self::BundleDigest => "E_BUNDLE_DIGEST",
        }
    }
}

impl fmt::Display for Code {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

/// One failed check.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Violation {
    /// The error code. Only a malformed genesis lineage has none, as in the
    /// reference.
    pub code: Option<Code>,
    /// The member or document the check concerns.
    pub field: String,
    /// What the check requires.
    pub message: Cow<'static, str>,
}

impl Violation {
    fn new(code: Code, field: impl Into<String>, message: impl Into<Cow<'static, str>>) -> Self {
        Self {
            code: Some(code),
            field: field.into(),
            message: message.into(),
        }
    }

    fn uncoded(field: &str, message: &'static str) -> Self {
        Self {
            code: None,
            field: field.to_owned(),
            message: Cow::Borrowed(message),
        }
    }
}

impl fmt::Display for Violation {
    /// `[CODE] field: message`, the reference's `[CODE] field` form.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        if let Some(code) = self.code {
            write!(formatter, "[{code}] ")?;
        }
        write!(formatter, "{}: {}", self.field, self.message)
    }
}
