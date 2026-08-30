# Familiar Embodiment Binding Profile — Design

**Status:** Proposed — survey and design; normative text proposed in
[`schemas/familiar-embodiment-binding.md`](../../../schemas/familiar-embodiment-binding.md)
**Date:** 2026-08-30
**Bead:** P0 protocol-profile bead mapped to OpenCoven/familiar-contract#17 (bead creation
is orchestrator-owned; this PR is the evidence bundle)
**Cross-repository program:** OpenCoven/coven#854 · Coven integration: OpenCoven/coven#857

## Purpose

Resolve OpenCoven/familiar-contract#17: define a universal, versioned **Familiar Embodiment
Binding** that proves which familiar root and exact identity revision a concrete runtime
session embodies. An automation definition carrying a human-readable `familiarId` cannot
establish continuity or authorization by itself; without a canonical binding profile, each
runtime invents its own meaning for "ran as Charm" and historical automation receipts
become unverifiable after identity evolution.

This document surveys what the repository already specifies (with code paths), proposes the
normative profile, records the maintainer decisions with alternatives, and defines the
conformance surface. It is non-normative; the normative text is
[`schemas/familiar-embodiment-binding.md`](../../../schemas/familiar-embodiment-binding.md)
and the two schemas beside it.

## Survey: what the repo already provides (2026-08-30)

| Building block | Where | What this profile reuses |
| --- | --- | --- |
| RFC 2119 normative form | `rfcs/RFC-0001-familiar-contract.md` (v0.7.0) | MUST/SHOULD discipline; fail-closed default throughout |
| Hash roles | RFC-0001 §5.6.1; `schemas/audit-record.schema.json` (`definitions.hashHex`) | SHA-256 content fingerprints over exactly specified bytes, bare lowercase 64-hex; algorithm fixed by field definition; unsupported algorithm ⇒ reject, never skip |
| Provenance evidence model | RFC-0001 §5.6 (`schemas/audit-record.schema.json`) | Binding issuance/refusal/later-state events belong in the same append-only audit log; referents must resolve |
| Content-addressed manifests | `schemas/coven-memory-schema.md` §11.3 (`manifest.jsonl` `sha256`, append-only, supersession explicit) | `identityDeclarationDigest` and `historicalBundle.contentAddress` are content addresses, not payload copies |
| Fail-closed gate conventions | `schemas/coven-memory-schema.md` §11.0/§11.4 (FAMILIAR_ROOT resolution; "a defaulted gate input is a fail-open edge") | Alias resolution, cache freshness, and policy-version checks fail closed |
| Conformance lane pattern | `tests/conformance/audit-records/` + `validators/check-audit-records.js`, wired into `tests/conformance/run-conformance.sh` | Positive/negative single-record fixtures, worked vectors, fail-closed vector coverage |
| Opaque-identifier posture | `schemas/coven-memory-schema.md` §11.1/§11.2 privacy rules; `SECURITY.md` | Opaque identifiers in normative records; no absolute paths, raw session keys, or personal data |

What is missing — and what issue #17 asks for — is the *session embodiment* layer: a
normative record proving which familiar root, at which exact revision, under which
principal and validity state, a concrete execution embodied; plus alias-resolution,
validity, TOCTOU, rehydration, and privacy semantics for that record.

## Proposed design

### D-1. Two objects, one profile: binding + verification result

`familiar.embodiment_binding.v1` (issued at dispatch; the committed evidence) and
`familiar.embodiment_verification.v1` (issued by a resolver/verifier; records resolution,
eligibility, refusal, and rehydration outcomes). The issue's proposed object fields map
1:1 onto the binding schema (§2.1 of the profile).

*Alternatives considered:* a single object carrying both the commitment and the verdict —
rejected: a binding is immutable committed state, while verifications are per-check and
must exist for refusals where no binding is ever committed (ambiguous alias, stale cache).
Merging them forces retroactive mutation or duplicate objects.

### D-2. Digest roles follow RFC-0001 §5.6.1 (no new algorithm zoo)

- `identityDeclarationDigest` — **SHA-256** content fingerprint over the identity
  declaration manifest's canonical bytes (§7.2 of the profile).
- `bindingIntegrityDigest` — **SHA-256** content fingerprint over the canonical encoding of
  the binding minus the digest member. Although this commits multiple fields, the preimage
  is a single canonical byte sequence (unambiguous total-order encoding), which §5.6.1
  classifies as the content-fingerprint role: "recomputable by any tool that can read the
  fingerprinted bytes, with no knowledge of this specification beyond the algorithm name".
  The `schema` discriminator inside the hashed material versions the construction, the same
  way embedded domain tags version RFC-0001 §5.6.1 constructions.
- **Alternatives considered:** (a) a BLAKE3 structural commitment with a new
  `coven-threads:embodiment-binding:v1` domain tag and BE-u64 length framing — rejected for
  v1: no BLAKE3 implementation exists in this repo's dependency set (Node `crypto`,
  `ajv`, `@iarna/toml` only — see `package.json`), so in-repo vector recomputation would be
  impossible without a new native/JS dependency; and the §5.6.1 role table assigns
  single-byte-sequence checksums to SHA-256. The binding hash is over one canonical byte
  sequence, not an adversarially-framed field concatenation. (b) Prefixed `sha256:<hex>`
  forms — prohibited, per §5.6.1 and the negative audit-record fixture precedent
  (`tests/conformance/audit-records/negative/03-entry-hash-prefixed.json`).

### D-3. Versioning via the `schema` discriminator only

`schema: "familiar.embodiment_binding.v1"` carries profile+schema version. A separate
`profileVersion` field was considered (the issue lists "policy/profile/schema versions") —
rejected: two mutable version fields drift; the discriminator is pinned by every record and
vector. `policyVersion` remains a first-class field because validity/lifecycle policy
evolves independently of the object shape, and verifiers MUST refuse results under
unsupported policy versions.

### D-4. Closed enums + `additionalProperties: false` (fail closed)

Follows `schemas/coven-memory-schema.md` §11.1 ("Every other missing field, unknown field,
or unknown enum value → reject, fail-closed"). The audit-record schema keeps its root open
because audit records are implementation-extensible by design; a binding is a canonical,
digest-committed object where an unknown member silently changing the digest preimage is a
fail-open edge. Extension = profile version bump. New `bindingPurpose` values likewise
require a bump.

### D-5. One canonicalization: `fc-canonical-json:v1`

UTF-8, recursively key-sorted, no whitespace, integers only. Chosen so every profile digest
is recomputable in any runtime with SHA-256 and a JSON encoder (the cross-implementation
property §5.6.1 demands at the content layer). **Alternatives considered:** (a) JCS
(RFC 8785) — more standard, but adds IETF-tooling dependency and number-format edge cases
this profile avoids by integers-only; a future version MAY adopt JCS via a new
`identityCanonicalization` value. (b) BLAKE3 domain-tagged framing for the binding — see
D-2.

### D-6. Lifecycle semantics: status is decision-time evidence; later state is new state

The binding's `status` field carries the ratified vocabulary (`active`, `retired`,
`revoked`, `superseded`) but conforming issuance requires `active`; refusal outcomes are
recorded as verification results, and post-commit changes are later state (`observedStatus`
on verification records), never retroactive binding mutation — mirroring the append-only
discipline of RFC-0001 §5.6. **Alternative considered:** omit `status` from the binding and
put it only in verification records — rejected: the issue explicitly requires decision-time
status on the binding, and the shared vocabulary keeps refusal records schema-identical
across runtimes.

### D-7. Integrity vs authentication

`bindingIntegrityDigest` is unkeyed in v1 (tamper-evident, not adversarially
tamper-proof). Keyed BLAKE3 (authority-layer key) or an asymmetric signature is the
recommended first ratified extension. This is a maintainer decision: it introduces key
management the identity registry must own, and doing it badly (e.g. trusting a
familiar-reachable key) would be worse than an honest unkeyed fingerprint. Until ratified,
consumers MUST treat the integrity digest as corruption/drift evidence only.

### D-8. Purpose ↔ correlation mapping is not load-bearing

`direct`→`session`, `automation`/`psyche`→`run`/`attempt` is RECOMMENDED but not
schema-enforced: a direct Coven launch may legitimately create a run object. Hard-binding
purpose to correlation type would make the mapping load-bearing for identity meaning,
which the issue forbids ("without changing identity meaning").

### D-9. TypeScript types: rejected for v1

The deliverable allows "JSON Schema / TypeScript types". The repo has no TypeScript
toolchain (`package.json` is CommonJS with only `ajv` + `@iarna/toml`; no `tsconfig.json`).
Adding one would violate "no code changes beyond what the spec needs to typecheck" and add
an unrequested build dependency. JSON Schema is this repo's machine-readable normative form
(AGENTS.md). A `.d.ts` can be generated mechanically from these schemas by any consumer
(Coven, Psyche, Cave, SDK) without this repo adopting a toolchain.

## Conformance coverage plan

New lane `tests/conformance/embodiment-binding/`, checked by
`validators/check-embodiment-binding.js` under the same `run-conformance.sh` / `npm test`
entry point (the audit-record lane pattern, `validators/check-audit-records.js`):

- **Positive records** (single JSON files): must validate against the discriminator-matched
  schema. The checker recomputes `bindingIntegrityDigest` for every positive binding (the
  canonicalization rule is self-checkable from the record) and recomputes
  `identityDeclarationDigest` from companion `.identity-declaration` byte files (worked
  vectors). Fail-closed coverage: the lane fails if no companion identity-declaration
  vector was found and verified (the audit lane's §6.1 lesson — a deleted vector file must
  break the run, not silently skip the demonstration).
- **Negative records:** must fail schema validation (unknown members, prefixed/uppercase
  digests, unknown enum values, missing conditional fields, cross-field verdict
  inconsistencies).
- **Golden vectors EBV-01…EBV-18:** one JSON file per issue-#17 conformance vector at
  `tests/conformance/embodiment-binding/vectors/`; the checker enforces complete coverage
  (all 18 IDs present, no extras), validates embedded records against the schemas, and
  checks embedded `(question, verdict, reason)` triples against each vector's `expect`
  entries. Runtime behavior (that a real resolver returns these verdicts) is normative but
  documented as a runtime gap (profile §10.1), exactly as RFC-0001 §9 scopes its own gaps.

## Migration impact

None for existing conformance claims: no RFC-0001 requirement changes, no claimant-directory
changes, no changes to existing fixtures. The lane is additive under the existing
`npm test` entry point. Consumers (Coven, Psyche, Cave, SDK) gain new optional artifacts to
pin; nothing existing breaks. If ratified, the bead packet's "exact artifact revision" is
the merge commit of this PR.

## Sequencing

1. This PR: profile prose + schemas + vectors + lane (draft PR; ratification is the
   maintainer's act, per the repo's RFC lifecycle in `rfcs/README.md`).
2. On ratification: Coven resolver/dispatcher consumes `familiar.embodiment_binding.v1`
   (OpenCoven/coven#857 identity portion); Psyche and Cave adopt the same profile;
   independent validators consume the pinned vector revision.
3. First ratified extension candidates (maintainer decisions): adversarial authentication
   for `bindingIntegrityDigest` (D-7), retired-tolerant purposes (if any), additional
   `bindingPurpose` values, key-blinded alias records.
