# Audit-Record Conformance Fixtures

Fixture lane for RFC-0001 §5.6/§5.6.1: the textual (JSON) encoding of audit-log records, validated against [`schemas/audit-record.schema.json`](../../../schemas/audit-record.schema.json) by [`validators/check-audit-records.js`](../../../validators/check-audit-records.js). The lane runs as part of `bash tests/conformance/run-conformance.sh` (and therefore `npm test`); it can also be run alone with `node validators/check-audit-records.js`.

Unlike the `positive/` and `negative/` familiar-directory lanes, each case here is a single JSON file — one audit record — not a claimant directory.

## Positive cases (MUST validate)

| Case | Demonstrates |
|---|---|
| `01-memory-entry-admitted.json` | A standard memory admission with `entry_hash`, `source_attestation`, and loop-origin `principal_authorization`. **Worked vector:** `01-memory-entry-admitted.entry` holds the admitted entry's exact bytes; the checker recomputes SHA-256 over them and requires equality with `entry_hash` (§5.6.1). |
| `02-ward-updated.json` | A principal-authorized Ward update carrying `ward_version`, `ward_hash`, and `principal_authorization`. The `ward_hash` value is a genuine reference vector: the BLAKE3 empty-weave root `H("coven-threads:empty:v1")` from the §5.6.1 Merkle construction. |
| `03-proposal-approved.json` | A proposal-verdict event; `diff_hash` is null, which §5.6.1 permits on verdict events. |
| `04-principal-authorized-write.json` | A principal-authorized write. **Worked vector:** `04-principal-authorized-write.surface` holds the post-write surface bytes; the checker recomputes SHA-256 over them and requires equality with `diff_hash` (§5.6.1). |

Companion-vector convention: `<case>.entry` binds to `entry_hash`; `<case>.surface` binds to `diff_hash`. An independent implementation can use these files as known-good vectors for its own fingerprint code. The checker fails closed unless at least one vector of each kind was found and verified per run — a deleted or renamed companion file breaks the suite instead of silently skipping the §6.1 worked-vector demonstration.

## Negative cases (MUST fail schema validation)

| Case | Violation |
|---|---|
| `01-entry-hash-uppercase.json` | `entry_hash` in uppercase hex — §5.6.1 requires lowercase. |
| `02-entry-hash-truncated.json` | `entry_hash` is 63 hex characters — not a 32-byte value. |
| `03-entry-hash-prefixed.json` | `entry_hash` uses the prohibited `sha256:<hex>` prefixed form — §5.6.1 requires bare hex. |
| `04-missing-entry-hash.json` | `memory_entry_admitted` without `entry_hash` — §5.6 MUST. |
| `05-missing-source-attestation.json` | `memory_entry_admitted` without `source_attestation` — §5.6 MUST. |
| `06-ward-updated-missing-ward-hash.json` | `ward_updated` without `ward_hash` — §5.6 MUST. |
| `07-extension-event-type.json` | An implementation-extension `event_type` (`compaction_ledger`) — outside the schema's §5.6 named set; extension records are not validated by this schema. |

## What this lane does not test

Runtime obligations remain out of scope for file-level conformance (§8.2, §9): append-only behavior, recomputation of recorded hashes as tamper evidence, fail-closed rejection of attestations naming unsupported algorithms, referent resolution for `source_attestation`, and the full BLAKE3 `ward_hash` Merkle construction over non-empty weaves.
