//! Typed views of documents that have already passed their schema.
//!
//! The schemas close every object (`additionalProperties: false`) and require
//! every member read here, so deserializing a schema-valid document cannot
//! fail. Only the members the semantic checks read are modelled. Every
//! optional member here has `minLength: 1`, a pattern, or an object type, so
//! `Some` is exactly JavaScript truthiness.

use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Binding {
    pub binding_id: String,
    pub familiar: Familiar,
    pub resolution_snapshot: ResolutionSnapshot,
    pub alias_resolution: Option<AliasResolution>,
    pub identity_bundle: IdentityBundle,
    pub revision_recorded_at: String,
    pub valid_time: ValidTime,
    pub status_at_decision: StatusAtDecision,
    pub principal: Principal,
    pub target: Principal,
    pub binding_purpose: String,
    pub issued_at: String,
    pub decision_at: String,
    pub historical_verification: HistoricalVerification,
    pub revocation: Revocation,
    pub commit: Commit,
    pub integrity: Integrity,
    pub authentication: Authentication,
    pub privacy: Privacy,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Familiar {
    pub familiar_root_id: String,
    pub identity_revision_id: String,
    pub lineage_position: u64,
    pub lineage_evidence: LineageEvidence,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LineageEvidence {
    pub relationship: String,
    pub root_evidence: String,
    pub predecessor: Option<Predecessor>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Predecessor {
    pub familiar_root_id: String,
    pub identity_revision_id: String,
    pub lineage_position: u64,
    pub status: String,
    pub identity_bundle_ref: String,
    pub transition: Transition,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Transition {
    pub relationship: String,
    pub predecessor_bundle_digest: String,
    pub successor_familiar_root_id: String,
    pub successor_identity_revision_id: String,
    pub successor_bundle_digest: String,
    pub successor_declaration_digest: String,
    pub authentication: Authentication,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ResolutionSnapshot {
    pub snapshot_id: String,
    pub resolved_at: String,
    pub authoritative_ledger_generation: u64,
    pub authoritative_head_revision_id: String,
    pub freshness_bound_seconds: u64,
    pub cache_observed_at: String,
    pub familiar_root_id: String,
    pub identity_revision_id: String,
    pub lineage_position: u64,
    pub bundle_digest: String,
    pub status: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AliasResolution {
    pub resolved_root_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct IdentityBundle {
    pub declaration_digest: Digest,
    pub bundle_digest: Digest,
    pub historical_bundle_ref: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct Digest {
    pub value: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ValidTime {
    pub not_before: String,
    pub not_after: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StatusAtDecision {
    pub status: String,
    pub decision_time: String,
}

/// The binding's `principal`, and its `target`, which repeats the principal.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Principal {
    pub authenticated_principal_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HistoricalVerification {
    pub state: String,
    pub read_authorization: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Revocation {
    pub outcome: String,
    pub revoked_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Commit {
    pub snapshot_id: String,
    pub final_validity_check_at: String,
    pub committed_at: String,
    pub verified_binding_digest: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Integrity {
    pub binding_digest: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Authentication {
    pub public_key: String,
    pub signature: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Privacy {
    pub recorded_at: String,
    pub tombstone_state: String,
    pub replica_purge_state: String,
    pub erasure_evidence: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Bundle {
    pub familiar_root_id: String,
    pub identity_revision_id: String,
    pub lineage_position: u64,
    pub recorded_at: String,
    pub components: Vec<Component>,
    pub bundle_digest: Digest,
    pub retention: Retention,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Component {
    pub component_id: String,
    pub digest: Digest,
    pub redaction_state: String,
    pub content: Option<Value>,
    pub redaction_evidence: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Retention {
    pub verifier_access: String,
    pub recorded_at: String,
    pub tombstone_state: String,
    pub replica_purge_state: String,
    pub erasure_evidence: Option<String>,
    pub device_revocation_evidence: Option<String>,
    pub redaction_state: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RevocationEvent {
    pub binding_id: String,
    pub binding_digest: String,
    pub familiar_root_id: String,
    pub identity_revision_id: String,
    pub revoked_at: String,
    pub integrity: EventIntegrity,
    pub authentication: Authentication,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EventIntegrity {
    pub event_digest: String,
}
