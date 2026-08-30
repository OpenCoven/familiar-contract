# Embodiment-Binding Conformance Fixtures

Fixture lane for the Familiar Embodiment Binding profile (`familiar.embodiment_binding.v1`,
OpenCoven/familiar-contract#17), validated against
[`schemas/familiar-embodiment-binding.schema.json`](../../../schemas/familiar-embodiment-binding.schema.json)
and
[`schemas/familiar-embodiment-verification.schema.json`](../../../schemas/familiar-embodiment-verification.schema.json)
by [`validators/check-embodiment-binding.js`](../../../validators/check-embodiment-binding.js).
The lane runs as part of `bash tests/conformance/run-conformance.sh` (and therefore
`npm test`); it can also be run alone with `node validators/check-embodiment-binding.js`.

Each case is a single JSON file — a binding, a verification result, or a golden vector —
discriminated by its `schema` member.

## Positive cases (MUST validate)

| Case | Demonstrates |
|---|---|
| `01-direct-session-active.json` | A valid active direct-session binding. **Worked vectors:** `01-direct-session-active.identity-declaration` holds the identity declaration manifest's exact canonical bytes; the checker recomputes SHA-256 over them and requires equality with `identityDeclarationDigest`, and re-encodes them canonically to prove they are themselves `fc-canonical-json:v1` canonical. The checker also recomputes `bindingIntegrityDigest` over the canonical encoding of every positive binding (§7.3 of the profile) — the canonicalization rule is self-checkable from the record alone. |
| `02-automation-run.json` | A scheduled automation run binding (`automation` / `attempt` correlation). |
| `03-psyche-delegated-run.json` | A Psyche-delegated run binding (`psyche` / `run`) — same profile, different purpose. |
| `04-restored-with-lineage.json` | A restored familiar: lineage carries an explicit `restoration` entry with an evidence digest. |
| `05-fork-new-root.json` | A fork: new root with cross-root lineage (`fork` + non-null `priorRootId`, schema-enforced). |
| `06-succession-map.json` | A succession mapping: both roots named in lineage (`succession` + `priorRootId`). |
| `07-superseded-with-successor.json` | A superseded revision carrying `supersededBy` (schema-required for `status: superseded`). |
| `08-tombstoned-privacy.json` | `privacyClass: tombstoned` — the locator is null (erasure/tombstone). |
| `09-verification-historical-valid.json` | A fully verified historical rehydration (`valid`/`ok`, bundle present, all recompute booleans true). |
| `10-verification-degraded-erased.json` | Degraded verification: sensitive components erased, minimum evidence survives (`degraded`/`bundle_erased`, `redacted: true`). |
| `11-verification-refusal-revoked.json` | A fail-closed issuance refusal for a revoked revision (`observedStatus: revoked` — later state, not retroactive mutation). |
| `12-verification-unverifiable-bundle-missing.json` | Missing retained bundle → `unverifiable`/`bundle_missing`; continuity is never overclaimed. |

Companion-vector convention: `<case>.identity-declaration` binds to
`identityDeclarationDigest` — the checker recomputes SHA-256 over the companion bytes and
also requires the bytes themselves to be canonical (`fc-canonical-json:v1`). As in the
audit-record lane, the checker fails closed unless at least one identity-declaration vector
was found and verified per run: a deleted or renamed companion file breaks the suite
instead of silently skipping the canonicalization demonstration. Unlike companion files,
`bindingIntegrityDigest` is recomputed for **every** positive binding record (the rule is
deterministic from the record alone).

Reference-vector convention: `historicalBundle.contentAddress` values are genuine SHA-256
reference vectors over the deterministic preimage `fc-bundle-manifest:v1\nbinding=<bindingId>\n`
(stated preimages, like the audit lane's BLAKE3 empty-weave reference vector); the retained
bundle preimage itself is registry-owned and out of the file-level suite's scope, exactly
as `ward_hash` committed state is for RFC-0001 §5.6.1.

## Negative cases (MUST fail schema validation)

| Case | Violation |
|---|---|
| `01-binding-missing-binding-id.json` | Required `bindingId` absent. |
| `02-binding-digest-prefixed.json` | `identityDeclarationDigest` uses the prohibited `sha256:<hex>` prefixed form (RFC-0001 §5.6.1). |
| `03-binding-integrity-uppercase.json` | `bindingIntegrityDigest` in uppercase hex — lowercase required. |
| `04-binding-unknown-status.json` | `status: "archived"` — outside the ratified status vocabulary. |
| `05-binding-unknown-purpose.json` | `bindingPurpose: "cron"` — outside the closed v1 enum; new purposes require a profile version bump. |
| `06-binding-superseded-without-successor.json` | `status: superseded` without the required `supersededBy`. |
| `07-binding-same-familiar-null-prior.json` | `same_familiar` lineage entry with null `priorRevisionId`. |
| `08-binding-fork-missing-prior-root.json` | Fork lineage without the required `priorRootId` (cross-root evidence). |
| `09-binding-negative-revision-index.json` | `revisionIndex: -1` — monotonic positions are ≥ 0. |
| `10-binding-genesis-non-null-prior.json` | `genesis` lineage entry carrying a non-null `priorRevisionId`. |
| `11-binding-fractional-revision-index.json` | Fractional `revisionIndex` — `fc-canonical-json:v1` is integers-only. |
| `12-binding-tombstoned-with-locator.json` | `privacyClass: tombstoned` with a non-null bundle locator. |
| `13-verification-valid-failure-reason.json` | `verdict: invalid` with `reason: ok`. |
| `14-verification-valid-unrecomputed.json` | `verdict: valid` with `identityDigestRecomputed: false` — a valid verdict cannot skip recomputation. |
| `15-verification-rehydration-bundle-not-applicable.json` | `historical_rehydration` with `bundleStatus: not_applicable` — rehydration always consults retained material. |
| `16-verification-issuance-consults-bundle.json` | `issuance_eligibility` question with a consulted-bundle status. |
| `17-verification-unknown-reason.json` | `reason: "cache_expired"` — outside the ratified reason vocabulary. |
| `18-verification-valid-alias-integrity-true.json` | Valid alias-resolution result claiming `integrityRecomputed: true` — no binding was verified. |
| `19-binding-extension-member.json` | Implementation-extension member on a binding — unknown members fail closed; extension requires a profile version bump. |
| `20-verification-degraded-bundle-missing.json` | `verdict: degraded` with `bundleStatus: missing` — degraded requires `partial`/`erased`; missing material is `unverifiable`. |

## Golden vectors (EBV-01 … EBV-18)

The `vectors/` directory publishes the issue-#17 conformance vectors as immutable JSON
artifacts: one file per vector, each carrying `given` (the scenario), `expect` (one or more
`{question, verdict, reason}` outcomes), and, where the scenario produces one, the
normative record a conforming implementation would emit. The checker enforces complete
coverage (exactly EBV-01…EBV-18 — fail closed on missing or extra ids), validates embedded
records against the schemas, recomputes embedded bindings' integrity digests, and checks
embedded verification triples against each vector's `expect` entries. Vectors are
consumable at an exact artifact revision (the git commit carrying them) by Coven, Psyche,
Cave, SDK, and independent validators.

## What this lane does not test

Runtime obligations remain out of scope for file-level conformance (profile §10.1, in the
spirit of RFC-0001 §9): that a real resolver returns the vector verdicts; alias-store
consistency and cache-freshness enforcement; atomic snapshot/commit behavior and
`revocation_race` detection; revocation event delivery; bundle retrieval, component
recompute, and privacy-authorization enforcement at the storage layer; device/replica purge
propagation; and adversarial authentication of `bindingIntegrityDigest` (v1 integrity is an
unkeyed content fingerprint — tamper-evident, not tamper-proof).
