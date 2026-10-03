//! `familiar.embodiment_binding.v1` verification, ported check for check from
//! `validateEmbodimentBindingFile` and `validateEmbodimentBinding` in
//! `validators/validate.js`.
//!
//! The order of checks, which of them stop early, and the error code each one
//! emits all follow the reference, so both validators report the same codes
//! for the same inputs. Comments name the reference function a block ports.

use std::cmp::Ordering;
use std::collections::HashSet;

use serde::Deserialize;
use serde_json::Value;

use crate::canonical::{self, TransitionPreimage};
use crate::model::{Binding, Bundle, Familiar, Predecessor, RevocationEvent};
use crate::time::{date_ms as at, is_timestamp};
use crate::{ed25519, json, schema, Code, Violation};

/// The verifier's fixed ceiling on cache and ledger observation age.
const MAX_CACHE_AGE_SECONDS: f64 = 300.0;

/// One binding and the sidecars supplied with it. A sidecar is "supplied"
/// when it is `Some`, whatever its text holds: a supplied sidecar that is
/// `null` is checked, and fails, where an absent one is not.
#[derive(Debug, Clone, Copy, Default)]
pub struct EmbodimentInputs<'a> {
    /// The binding document.
    pub binding: &'a str,
    /// A detached `familiar.identity_bundle.v1` historical bundle.
    pub historical_bundle: Option<&'a str>,
    /// The verifier's own authoritative ledger observation:
    /// `{generation, headRevisionId, status, observedAt, revokedAt?}`.
    pub trusted_ledger: Option<&'a str>,
    /// A signed `familiar.embodiment_revocation.v1` event recorded after the
    /// binding's commit.
    pub post_commit_revocation: Option<&'a str>,
}

/// Verifies a binding and its sidecars. An empty result means the binding
/// passes; otherwise each violation names the check that failed.
///
/// Authentication here means each document verifies under the key it
/// carries. Whether that key is trusted is the caller's policy; see
/// [`crate::spki_public_key`].
pub fn verify(inputs: &EmbodimentInputs<'_>) -> Vec<Violation> {
    // validateEmbodimentBindingFile: each input is parsed, and the binding,
    // bundle and ledger checked for I-JSON, before anything else runs.
    // Each document stays a `json::Parsed`, which tears itself down without
    // recursion; values are only ever borrowed from it.
    let binding = match json::parse(inputs.binding) {
        Ok(parsed) if parsed.not_i_json => {
            return vec![Violation::new(
                Code::IJson,
                "input",
                "JCS inputs must be I-JSON and cannot contain non-finite numbers or lone UTF-16 surrogates.",
            )]
        }
        Ok(parsed) => parsed,
        Err(error) => {
            return vec![Violation::new(
                Code::Json,
                "syntax",
                format!("JSON syntax violation: {}", error.0),
            )]
        }
    };
    let bundle = match inputs.historical_bundle.map(json::parse) {
        None => None,
        Some(Ok(parsed)) if parsed.not_i_json => {
            return vec![Violation::new(
                Code::IJson,
                "historicalBundle",
                "JCS inputs must be I-JSON and cannot contain non-finite numbers or lone UTF-16 surrogates.",
            )]
        }
        Some(Ok(parsed)) => Some(parsed),
        Some(Err(error)) => {
            return vec![Violation::new(
                Code::BundleSchema,
                "historicalBundle",
                format!("JSON syntax violation: {}", error.0),
            )]
        }
    };
    let ledger = match inputs.trusted_ledger.map(json::parse) {
        None => None,
        Some(Ok(parsed)) if parsed.not_i_json => {
            return vec![Violation::new(
                Code::IJson,
                "trustedLedger",
                "Trusted ledger JSON must be I-JSON and cannot contain non-finite numbers or lone UTF-16 surrogates.",
            )]
        }
        Some(Ok(parsed)) => Some(parsed),
        Some(Err(error)) => {
            return vec![Violation::new(
                Code::TrustedLedger,
                "trustedLedger",
                format!("JSON syntax violation: {}", error.0),
            )]
        }
    };
    // The revocation event's I-JSON check runs later, after its schema.
    let revocation = match inputs.post_commit_revocation.map(json::parse) {
        None => None,
        Some(Ok(parsed)) => Some(parsed),
        Some(Err(error)) => {
            return vec![Violation::new(
                Code::Revocation,
                "postCommitRevocation",
                format!("JSON syntax violation: {}", error.0),
            )]
        }
    };
    verify_binding(
        &binding.value,
        bundle.as_ref().map(|parsed| &parsed.value),
        ledger.as_ref().map(|parsed| &parsed.value),
        revocation.as_ref(),
    )
}

/// validateEmbodimentBinding.
fn verify_binding(
    value: &Value,
    bundle: Option<&Value>,
    ledger: Option<&Value>,
    revocation: Option<&json::Parsed>,
) -> Vec<Violation> {
    if !value.is_object() {
        return vec![Violation::new(
            Code::Schema,
            "shape",
            "An embodiment binding must be one JSON object.",
        )];
    }
    if value.get("schemaVersion").and_then(Value::as_str) != Some("1.0.0") {
        return vec![Violation::new(
            Code::Version,
            "schemaVersion",
            "Only familiar.embodiment_binding.v1 schemaVersion 1.0.0 is supported.",
        )];
    }
    let schema_errors: Vec<Violation> = schema::binding()
        .iter_errors(value)
        .map(|error| {
            let path = error.instance_path().to_string();
            let keyword = error.kind().keyword();
            // The message names the keyword only. Formatting the error itself
            // would print the offending value, which may be nested arbitrarily
            // deep.
            Violation::new(
                Code::Schema,
                format!(
                    "schema {} [{keyword}]",
                    if path.is_empty() { "/" } else { &path },
                ),
                format!("fails the schema's `{keyword}` keyword"),
            )
        })
        .collect();
    if !schema_errors.is_empty() {
        return schema_errors;
    }
    let binding = match Binding::deserialize(value) {
        Ok(binding) => binding,
        Err(error) => {
            return vec![Violation::new(Code::Schema, "shape", error.to_string())];
        }
    };

    let mut violations = Vec::new();
    let b = &binding;
    let (familiar, snapshot, commit) = (&b.familiar, &b.resolution_snapshot, &b.commit);
    let authority = matches!(b.binding_purpose.as_str(), "dispatch" | "session_creation");

    let times = [
        Some(&b.revision_recorded_at),
        Some(&b.valid_time.not_before),
        b.valid_time.not_after.as_ref(),
        Some(&snapshot.resolved_at),
        Some(&b.status_at_decision.decision_time),
        Some(&b.issued_at),
        Some(&b.decision_at),
        Some(&commit.final_validity_check_at),
        Some(&commit.committed_at),
        b.revocation.revoked_at.as_ref(),
        Some(&b.privacy.recorded_at),
        Some(&snapshot.cache_observed_at),
    ];
    if times
        .into_iter()
        .flatten()
        .any(|time| !time.is_empty() && !is_timestamp(time))
    {
        violations.push(Violation::new(
            Code::Timestamp,
            "timestamps",
            "All present timestamps must be strict RFC 3339 calendar date-times with an offset or Z.",
        ));
    }

    if b.identity_bundle.historical_bundle_ref
        != format!("urn:sha256:{}", b.identity_bundle.bundle_digest.value)
    {
        violations.push(Violation::new(
            Code::BundleReference,
            "identityBundle.historicalBundleRef",
            "The content-addressed historical bundle reference must exactly carry bundleDigest.value.",
        ));
    }
    if b.integrity.binding_digest != canonical::binding_digest(value) {
        violations.push(Violation::new(
            Code::BindingDigest,
            "integrity.bindingDigest",
            "The SHA-256 digest of JCS-canonical binding bytes with the entire integrity/authentication members and redundant commit digest verification omitted does not match.",
        ));
    }
    if commit.verified_binding_digest != b.integrity.binding_digest {
        violations.push(Violation::new(
            Code::CommitDigest,
            "commit.verifiedBindingDigest",
            "The immutable commit must verify the exact committed binding digest.",
        ));
    }
    if !ed25519::verify(
        &b.authentication.public_key,
        &b.authentication.signature,
        &b.integrity.binding_digest,
    ) {
        violations.push(Violation::new(
            Code::Authentication,
            "authentication",
            "The Ed25519 public key and signature do not verify the binding digest.",
        ));
    }
    if snapshot.snapshot_id != commit.snapshot_id
        || snapshot.familiar_root_id != familiar.familiar_root_id
        || snapshot.identity_revision_id != familiar.identity_revision_id
        || snapshot.lineage_position != familiar.lineage_position
        || snapshot.bundle_digest != b.identity_bundle.bundle_digest.value
        || snapshot.status != b.status_at_decision.status
    {
        violations.push(Violation::new(
            Code::Snapshot,
            "resolutionSnapshot",
            "The immutable resolution snapshot must bind root, revision, lineage position, bundle digest, and decision status.",
        ));
    }
    let cache_and_final =
        is_timestamp(&snapshot.cache_observed_at) && is_timestamp(&commit.final_validity_check_at);
    let freshness_ms = MAX_CACHE_AGE_SECONDS.min(snapshot.freshness_bound_seconds as f64) * 1000.0;
    if authority
        && (snapshot.authoritative_head_revision_id != familiar.identity_revision_id
            || (cache_and_final
                && at(&commit.final_validity_check_at) - at(&snapshot.cache_observed_at)
                    > freshness_ms))
    {
        violations.push(Violation::new(
            Code::StaleCache,
            "resolutionSnapshot",
            "Authority snapshots must name the current head revision and satisfy both the signed freshness bound and the verifier policy maximum.",
        ));
    }
    if cache_and_final && at(&snapshot.cache_observed_at) > at(&commit.final_validity_check_at) {
        violations.push(Violation::new(
            Code::CacheTime,
            "resolutionSnapshot.cacheObservedAt",
            "Cache observation cannot be after the trusted final validity evaluation.",
        ));
    }
    if let Some(alias) = &b.alias_resolution {
        let roots = &alias.resolved_root_ids;
        if roots.len() != 1 || roots[0] != familiar.familiar_root_id {
            violations.push(Violation::new(
                Code::Alias,
                "aliasResolution",
                "Aliases are non-authoritative evidence and must resolve to exactly the declared familiar root.",
            ));
        }
    }
    if b.principal.authenticated_principal_id != b.target.authenticated_principal_id {
        violations.push(Violation::new(
            Code::Principal,
            "target.authenticatedPrincipalId",
            "The target principal must equal the authenticated binding principal.",
        ));
    }
    if is_timestamp(&b.revision_recorded_at)
        && is_timestamp(&b.decision_at)
        && at(&b.revision_recorded_at) > at(&b.decision_at)
    {
        violations.push(Violation::new(
            Code::Ordering,
            "revisionRecordedAt",
            "The revision cannot be recorded after the binding decision.",
        ));
    }
    let not_before = &b.valid_time.not_before;
    if let Some(not_after) = &b.valid_time.not_after {
        if is_timestamp(not_before) && is_timestamp(not_after) && at(not_before) > at(not_after) {
            violations.push(Violation::new(
                Code::Ordering,
                "validTime",
                "The valid-time interval cannot end before it begins.",
            ));
        }
    }
    if authority
        && is_timestamp(not_before)
        && is_timestamp(&commit.committed_at)
        && at(not_before) > at(&commit.committed_at)
    {
        violations.push(Violation::new(
            Code::Stale,
            "validTime.notBefore",
            "The revision is not yet valid at the decision time.",
        ));
    }
    if let Some(not_after) = &b.valid_time.not_after {
        if authority
            && is_timestamp(not_after)
            && is_timestamp(&commit.committed_at)
            && at(not_after) < at(&commit.committed_at)
        {
            violations.push(Violation::new(
                Code::Stale,
                "validTime.notAfter",
                "The revision is stale at the decision time.",
            ));
        }
    }
    if is_timestamp(&commit.final_validity_check_at)
        && is_timestamp(&commit.committed_at)
        && at(&commit.final_validity_check_at) > at(&commit.committed_at)
    {
        violations.push(Violation::new(
            Code::Ordering,
            "commit",
            "The final validity check cannot follow the immutable commit.",
        ));
    }
    let all_four = is_timestamp(&snapshot.resolved_at)
        && is_timestamp(&commit.final_validity_check_at)
        && is_timestamp(&b.decision_at)
        && is_timestamp(&commit.committed_at);
    // `issuedAt` is compared without its own timestamp guard, as in the
    // reference: an unparseable value is NaN and the ordering fails.
    let ordered = at(&snapshot.resolved_at) <= at(&commit.final_validity_check_at)
        && at(&commit.final_validity_check_at) <= at(&b.decision_at)
        && at(&b.decision_at) <= at(&commit.committed_at)
        && at(&commit.committed_at) <= at(&b.issued_at);
    if (all_four && !ordered) || b.status_at_decision.decision_time != b.decision_at {
        violations.push(Violation::new(
            Code::Ordering,
            "decisionAt",
            "Snapshot resolution, final validity check, decision, commit, and issue must be ordered; statusAtDecision.decisionTime equals decisionAt.",
        ));
    }
    if authority
        && is_timestamp(&commit.final_validity_check_at)
        && is_timestamp(&b.decision_at)
        && is_timestamp(&commit.committed_at)
        && !(at(&commit.final_validity_check_at) == at(&b.decision_at)
            && at(&b.decision_at) == at(&commit.committed_at))
    {
        violations.push(Violation::new(
            Code::Ordering,
            "commit",
            "Authority eligibility check, decision, and immutable commit must share one transaction boundary.",
        ));
    }

    check_lineage(b, &mut violations);

    if authority && !trusted_ledger_matches(b, ledger) {
        violations.push(Violation::new(
            Code::TrustedLedger,
            "trustedLedger",
            "Dispatch requires verifier-supplied authoritative ledger state observed no earlier than the cache, no more than 300 seconds before the final validity check, never after that check, matching the snapshot, and with no revocation at or before commit.",
        ));
    }
    if authority && b.status_at_decision.status != "active" {
        violations.push(Violation::new(
            Code::Status,
            "statusAtDecision.status",
            "Only an active revision is eligible for a new dispatch or session creation.",
        ));
    }
    let history = &b.historical_verification;
    if authority && history.state != "verified" {
        violations.push(Violation::new(
            Code::History,
            "historicalVerification.state",
            "Degraded, unavailable, or unverifiable history is never authority for a new dispatch.",
        ));
    }
    if history.read_authorization == "not_authorized"
        && (history.state != "unavailable" || b.binding_purpose != "historical_verification")
    {
        violations.push(Violation::new(
            Code::History,
            "historicalVerification",
            "An unauthorized historical read must be recorded as unavailable historical verification, never as dispatch authority.",
        ));
    }
    if b.privacy.tombstone_state != "live"
        && (b.privacy.erasure_evidence.is_none()
            || b.privacy.replica_purge_state == "not_requested")
    {
        violations.push(Violation::new(
            Code::Retention,
            "privacy",
            "Tombstoned or erased binding metadata requires erasure evidence and a requested replica purge.",
        ));
    }
    if bundle.is_some() && history.read_authorization == "not_authorized" {
        violations.push(Violation::new(
            Code::BundleAccess,
            "historicalVerification.readAuthorization",
            "A denied historical read cannot include a detached bundle.",
        ));
    }
    match bundle {
        Some(bundle) => violations.extend(verify_bundle(bundle, b)),
        None => {
            let expected = if history.read_authorization == "not_authorized" {
                "unavailable"
            } else {
                "degraded"
            };
            if history.state != expected {
                let code = if history.state == "verified" {
                    Code::BundleMissing
                } else {
                    Code::Redaction
                };
                violations.push(Violation::new(
                    code,
                    "historicalVerification",
                    format!("A missing historical bundle must be {expected} for the recorded read-authorization state."),
                ));
            }
        }
    }

    let revoked_at = b.revocation.revoked_at.as_deref();
    if b.revocation.outcome == "before_commit" {
        let recorded_by_commit = revoked_at.is_some_and(|revoked| {
            is_timestamp(revoked)
                && is_timestamp(&commit.committed_at)
                && at(revoked) <= at(&commit.committed_at)
        });
        if !recorded_by_commit {
            violations.push(Violation::new(
                Code::Revocation,
                "revocation",
                "A before-commit revocation must be timestamped at or before the immutable commit.",
            ));
        } else if authority {
            violations.push(Violation::new(
                Code::Revocation,
                "revocation",
                "A revocation observed before commit must fail closed and cannot authorize dispatch.",
            ));
        }
    }
    if b.revocation.outcome == "none" && revoked_at.is_some() {
        violations.push(Violation::new(
            Code::Revocation,
            "revocation.outcome",
            "A binding with revokedAt must classify the revocation outcome explicitly.",
        ));
    }
    if let Some(revoked) = revoked_at {
        if is_timestamp(revoked)
            && is_timestamp(&commit.committed_at)
            && at(revoked) <= at(&commit.committed_at)
            && authority
        {
            violations.push(Violation::new(
                Code::Revocation,
                "revocation.revokedAt",
                "Any revocation at or before decision/commit rejects dispatch regardless of the asserted outcome.",
            ));
        }
    }
    if b.status_at_decision.status == "revoked"
        && (b.revocation.outcome != "before_commit"
            || !revoked_at.is_some_and(|revoked| {
                // `decisionAt` is unguarded in the reference, so a NaN
                // decision time compares as "not after" and passes here.
                is_timestamp(revoked)
                    && at(revoked).partial_cmp(&at(&b.decision_at)) != Some(Ordering::Greater)
            }))
    {
        violations.push(Violation::new(
            Code::Revocation,
            "revocation",
            "A revision recorded as revoked at decision time requires a before-commit revocation at or before that decision.",
        ));
    }
    if let Some(revocation) = revocation {
        violations.extend(verify_post_commit_revocation(revocation, b));
    }
    violations
}

/// The lineage block of validateEmbodimentBinding.
fn check_lineage(b: &Binding, violations: &mut Vec<Violation>) {
    let familiar = &b.familiar;
    let lineage = &familiar.lineage_evidence;
    let predecessor = lineage.predecessor.as_ref();
    let relationship = lineage.relationship.as_str();
    if predecessor.is_some_and(|p| p.identity_revision_id == familiar.identity_revision_id) {
        violations.push(Violation::new(
            Code::Lineage,
            "familiar.lineageEvidence.predecessor",
            "A lineage predecessor must be a distinct identity revision.",
        ));
    }
    if relationship == "genesis"
        && (familiar.lineage_position != 0
            || lineage.root_evidence != "genesis"
            || predecessor.is_some())
    {
        violations.push(Violation::new(
            Code::Lineage,
            "familiar.lineageEvidence",
            "Genesis requires position 0, genesis root evidence, and no predecessor.",
        ));
    }
    let edge = |p: &Predecessor| valid_transition(p, familiar, relationship, b);
    if matches!(relationship, "same_familiar_revision" | "restoration") {
        let continued = predecessor.is_some_and(|p| {
            lineage.root_evidence == "continued"
                && p.familiar_root_id == familiar.familiar_root_id
                && i128::from(p.lineage_position) == i128::from(familiar.lineage_position) - 1
                && p.identity_revision_id != familiar.identity_revision_id
                && !p.identity_bundle_ref.is_empty()
                && edge(p)
        });
        if !continued {
            violations.push(Violation::new(
                Code::Lineage,
                "familiar.lineageEvidence",
                "Same-familiar continuation/restoration requires an authenticated, content-addressed edge from the immediately preceding distinct revision on the same root.",
            ));
        }
    }
    if relationship == "restoration" && !predecessor.is_some_and(|p| p.status == "retired") {
        violations.push(Violation::new(
            Code::Lineage,
            "familiar.lineageEvidence",
            "Restoration requires a retired predecessor on the same familiar root.",
        ));
    }
    if matches!(relationship, "fork_new_root" | "succession") {
        let root_evidence = if relationship == "fork_new_root" {
            "fork"
        } else {
            "succession"
        };
        let new_root = predecessor.is_some_and(|p| {
            !p.identity_bundle_ref.is_empty()
                && edge(p)
                && familiar.lineage_position == 0
                && p.familiar_root_id != familiar.familiar_root_id
                && lineage.root_evidence == root_evidence
        });
        if !new_root {
            violations.push(Violation::new(
                Code::Lineage,
                "familiar.lineageEvidence",
                "Fork/new-root and succession require authenticated, content-addressed predecessor evidence, position 0, a distinct root, and matching root evidence.",
            ));
        }
    }
}

/// validTransition.
fn valid_transition(
    predecessor: &Predecessor,
    familiar: &Familiar,
    relationship: &str,
    b: &Binding,
) -> bool {
    let transition = &predecessor.transition;
    // `slice('urn:sha256:'.length)`; the schema makes the reference ASCII.
    let predecessor_bundle = predecessor.identity_bundle_ref.get(11..).unwrap_or("");
    transition.relationship == relationship
        && transition.predecessor_bundle_digest == predecessor_bundle
        && transition.successor_familiar_root_id == familiar.familiar_root_id
        && transition.successor_identity_revision_id == familiar.identity_revision_id
        && transition.successor_bundle_digest == b.identity_bundle.bundle_digest.value
        && transition.successor_declaration_digest == b.identity_bundle.declaration_digest.value
        && ed25519::verify(
            &transition.authentication.public_key,
            &transition.authentication.signature,
            &canonical::transition_digest(&TransitionPreimage {
                relationship: &transition.relationship,
                predecessor_bundle_digest: &transition.predecessor_bundle_digest,
                successor_familiar_root_id: &transition.successor_familiar_root_id,
                successor_identity_revision_id: &transition.successor_identity_revision_id,
                successor_bundle_digest: &transition.successor_bundle_digest,
                successor_declaration_digest: &transition.successor_declaration_digest,
            }),
        )
}

/// The trusted-ledger block of validateEmbodimentBinding. The ledger sidecar
/// has no schema, so this reads it as JavaScript would: a missing member is
/// `undefined`, and a falsy `revokedAt` is no revocation.
fn trusted_ledger_matches(b: &Binding, ledger: Option<&Value>) -> bool {
    let Some(ledger) = ledger.and_then(Value::as_object) else {
        return false;
    };
    let commit = &b.commit;
    let snapshot = &b.resolution_snapshot;
    let timestamp_ms = |value: Option<&Value>| match value.and_then(Value::as_str) {
        Some(text) if is_timestamp(text) => at(text),
        _ => f64::NAN,
    };
    let observed = timestamp_ms(ledger.get("observedAt"));
    let final_check = if is_timestamp(&commit.final_validity_check_at) {
        at(&commit.final_validity_check_at)
    } else {
        f64::NAN
    };
    let cache = if is_timestamp(&snapshot.cache_observed_at) {
        at(&snapshot.cache_observed_at)
    } else {
        f64::NAN
    };
    // Number.isSafeInteger, then `>= 0` and `===` against the snapshot.
    let generation_matches = ledger
        .get("generation")
        .and_then(Value::as_f64)
        .is_some_and(|generation| {
            generation.fract() == 0.0
                && generation.abs() <= 9_007_199_254_740_991.0
                && generation >= 0.0
                && generation == snapshot.authoritative_ledger_generation as f64
        });
    let text = |key: &str| ledger.get(key).and_then(Value::as_str);
    let revoked_by_commit = match ledger.get("revokedAt") {
        Some(revoked) if js_truthy(revoked) => match revoked.as_str() {
            Some(text) if is_timestamp(text) => at(text) <= at(&commit.committed_at),
            _ => true,
        },
        _ => false,
    };
    generation_matches
        && text("headRevisionId") == Some(b.familiar.identity_revision_id.as_str())
        && text("status") == Some(b.status_at_decision.status.as_str())
        && observed.is_finite()
        && final_check.is_finite()
        && cache.is_finite()
        && observed >= cache
        && observed <= final_check
        && final_check - observed <= MAX_CACHE_AGE_SECONDS * 1000.0
        && !revoked_by_commit
}

/// validateHistoricalBundle.
fn verify_bundle(value: &Value, b: &Binding) -> Vec<Violation> {
    let malformed = || {
        vec![Violation::new(
            Code::BundleSchema,
            "historicalBundle",
            "The detached historical bundle is malformed.",
        )]
    };
    if !value.is_object() || !schema::bundle().is_valid(value) {
        return malformed();
    }
    let Ok(bundle) = Bundle::deserialize(value) else {
        return malformed();
    };
    let mut violations = Vec::new();
    if !is_timestamp(&bundle.recorded_at) || !is_timestamp(&bundle.retention.recorded_at) {
        violations.push(Violation::new(
            Code::Timestamp,
            "historicalBundle.timestamps",
            "Historical bundle timestamps must be strict RFC 3339 calendar date-times with an offset or Z.",
        ));
    }
    if bundle.familiar_root_id != b.familiar.familiar_root_id
        || bundle.identity_revision_id != b.familiar.identity_revision_id
        || bundle.lineage_position != b.familiar.lineage_position
    {
        violations.push(Violation::new(
            Code::BundleIdentity,
            "historicalBundle",
            "The detached bundle does not identify the bound root, revision, and lineage position.",
        ));
    }
    // The reference stops at the first bad component, before counting or
    // recording it, so a later required component can then read as missing.
    let mut seen = HashSet::new();
    let mut redacted = 0;
    // Content is hashed in place from the parsed document; the typed view only
    // records whether it is present.
    let contents = value["components"]
        .as_array()
        .map(Vec::as_slice)
        .unwrap_or_default();
    for (index, component) in bundle.components.iter().enumerate() {
        let bad = seen.contains(component.component_id.as_str())
            || (component.redaction_state == "retained"
                && contents[index].get("content").is_none_or(|content| {
                    component.digest.value != canonical::digest_object(content)
                }))
            || (component.redaction_state == "redacted"
                && (component.content.is_some() || component.redaction_evidence.is_none()));
        if bad {
            violations.push(Violation::new(
                Code::ComponentDigest,
                "historicalBundle.components",
                "Every unique retained component digest must recompute from its canonical content.",
            ));
            break;
        }
        if component.redaction_state == "redacted" {
            redacted += 1;
        }
        seen.insert(component.component_id.as_str());
    }
    if !seen.contains("identity-declaration") || !seen.contains("soul-declaration") {
        violations.push(Violation::new(
            Code::ComponentRequired,
            "historicalBundle.components",
            "Historical bundles retain identity-declaration and soul-declaration components.",
        ));
    }
    let computed = canonical::bundle_digest(value);
    let declaration = bundle
        .components
        .iter()
        .find(|component| component.component_id == "identity-declaration")
        .map(|component| component.digest.value.as_str());
    if bundle.bundle_digest.value != computed
        || b.identity_bundle.bundle_digest.value != computed
        || Some(b.identity_bundle.declaration_digest.value.as_str()) != declaration
    {
        violations.push(Violation::new(
            Code::BundleDigest,
            "historicalBundle.bundleDigest",
            "The detached bundle and its retained identity declaration must recompute to the bound digests.",
        ));
    }
    let retention = &bundle.retention;
    if retention.verifier_access != "authorized" {
        violations.push(Violation::new(
            Code::BundleAccess,
            "historicalBundle.retention",
            "A supplied detached bundle must be authorized for verifier access.",
        ));
    }
    let all_retained = redacted == 0;
    let all_redacted = redacted == bundle.components.len();
    let history_state = b.historical_verification.state.as_str();
    let (redaction, tombstone, purge) = (
        retention.redaction_state.as_str(),
        retention.tombstone_state.as_str(),
        retention.replica_purge_state.as_str(),
    );
    let lifecycle = if all_retained {
        (redaction != "none" || tombstone != "live" || purge != "not_requested" || history_state != "verified")
            .then_some(("historicalBundle.retention", "A fully retained supplied bundle must be live, unredacted, unpurged, and verified."))
    } else if redaction != "redacted" {
        Some((
            "historicalBundle.retention.redactionState",
            "Any unavailable component content requires bundle-level redaction state.",
        ))
    } else if tombstone == "live" {
        (purge != "not_requested" || history_state != "unverifiable").then_some((
            "historicalBundle.retention",
            "A live supplied redacted bundle must be unpurged and classified as unverifiable.",
        ))
    } else if !all_redacted {
        Some((
            "historicalBundle.components",
            "A tombstoned or erased bundle cannot retain sensitive component content.",
        ))
    } else if tombstone == "tombstoned" {
        (retention.erasure_evidence.is_none()
            || !matches!(purge, "pending" | "complete")
            || history_state != "unavailable")
            .then_some(("historicalBundle.retention", "A tombstoned supplied bundle requires erasure evidence, an active purge, and unavailable history."))
    } else if tombstone == "erased" {
        (retention.erasure_evidence.is_none()
            || retention.device_revocation_evidence.is_none()
            || purge != "complete"
            || history_state != "unavailable")
            .then_some(("historicalBundle.retention", "An erased supplied bundle requires complete purge evidence and unavailable history."))
    } else {
        None
    };
    if let Some((field, message)) = lifecycle {
        violations.push(Violation::new(Code::Redaction, field, message));
    }
    violations
}

/// validatePostCommitRevocation.
fn verify_post_commit_revocation(revocation: &json::Parsed, b: &Binding) -> Vec<Violation> {
    let value = &revocation.value;
    if !value.is_object() || !schema::revocation().is_valid(value) {
        return vec![Violation::new(
            Code::Revocation,
            "postCommitRevocation",
            "The post-commit revocation event is malformed.",
        )];
    }
    let event = match RevocationEvent::deserialize(value) {
        Ok(event) if !revocation.not_i_json && is_timestamp(&event.revoked_at) => event,
        _ => {
            return vec![Violation::new(
                Code::Revocation,
                "postCommitRevocation",
                "The post-commit revocation event must be valid I-JSON with a strict timestamp.",
            )]
        }
    };
    let mut violations = Vec::new();
    if event.binding_id != b.binding_id
        || event.binding_digest != b.integrity.binding_digest
        || event.familiar_root_id != b.familiar.familiar_root_id
        || event.identity_revision_id != b.familiar.identity_revision_id
        || at(&event.revoked_at) <= at(&b.commit.committed_at)
    {
        violations.push(Violation::new(
            Code::Revocation,
            "postCommitRevocation",
            "A post-commit revocation must reference the exact immutable binding and occur strictly after its commit.",
        ));
    }
    let digest = canonical::revocation_digest(value);
    if event.integrity.event_digest != digest {
        violations.push(Violation::new(
            Code::Revocation,
            "postCommitRevocation.integrity",
            "The post-commit revocation event digest does not match its canonical preimage.",
        ));
    }
    if !ed25519::verify(
        &event.authentication.public_key,
        &event.authentication.signature,
        &digest,
    ) {
        violations.push(Violation::new(
            Code::Authentication,
            "postCommitRevocation.authentication",
            "The post-commit revocation Ed25519 signature does not verify.",
        ));
    }
    violations
}

/// JavaScript truthiness of a JSON value.
fn js_truthy(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Bool(flag) => *flag,
        Value::Number(number) => number.as_f64().is_some_and(|float| float != 0.0),
        Value::String(text) => !text.is_empty(),
        Value::Array(_) | Value::Object(_) => true,
    }
}
