# Familiar Embodiment Binding Profile (`familiar.embodiment_binding.v1`)

**Status:** Proposed v1 — awaiting ratification (OpenCoven/familiar-contract#17)
**Cross-repository program:** OpenCoven/coven#854 · Coven integration: OpenCoven/coven#857
**Canonical location:** this file, plus the machine-readable forms
[`familiar-embodiment-binding.schema.json`](familiar-embodiment-binding.schema.json) and
[`familiar-embodiment-verification.schema.json`](familiar-embodiment-verification.schema.json).
Implementations pin a version of these files.
**Normative base:** RFC-0001 v0.7.0 (`rfcs/RFC-0001-familiar-contract.md`) — the hash and
encoding discipline of §5.6.1 and the audit-evidence model of §5.6 apply to this profile.
**Design basis (non-normative):**
[`docs/superpowers/specs/2026-08-30-embodiment-binding-profile-design.md`](../docs/superpowers/specs/2026-08-30-embodiment-binding-profile-design.md)
**Conformance:** `tests/conformance/embodiment-binding/` — vectors EBV-01…EBV-18, checked by
`validators/check-embodiment-binding.js` under `bash tests/conformance/run-conformance.sh`
**Amendment protocol:** every change to this profile requires (a) a stated migration impact
and security rationale, (b) a conformance-vector update in the same PR (schema prose and
vectors must not drift, per [AGENTS.md](../AGENTS.md)), and (c) re-validation of the
`familiar.embodiment_verification.v1` refusal vocabulary. The `:v<N>` suffix of each object
name versions it; a semantic change to a field's meaning MUST change the object version.

---

## §1. Purpose and scope

This profile defines a universal, versioned **Familiar Embodiment Binding**: a normative
record that proves **which familiar root and exact identity revision a concrete runtime
session embodies**. It answers: *which familiar persisted into this execution, at which
revision, under which principal and validity state?* The same profile applies to scheduled
automation runs, manual Coven launches, Psyche-orchestrated work, Cave sessions, and other
conforming runtimes — direct, automation, and Psyche sessions use **one** binding profile.

An automation definition containing a human-readable `familiarId` cannot establish
continuity or authorization by itself. This profile is what lets a runtime resolve an alias
to one stable familiar root, pin an exact authorized identity revision at dispatch, reject
stale/revoked/retired identity, and retain enough content-addressed evidence to explain the
historical run later. Without it, each runtime invents its own meaning for "ran as Charm"
and historical receipts become unverifiable after identity evolution.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**,
**SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are to be interpreted as
described in [RFC 2119]. The term **fail closed** means: refuse the operation and emit an
explicit refusal record; never degrade into a permissive default.

[RFC 2119]: https://www.rfc-editor.org/rfc/rfc2119

### §1.1 What this profile owns

- Stable opaque familiar root identity (`familiarRootId`).
- Identity revision and same-familiar/fork/succession semantics (§4).
- The normative identity digest boundary (§7).
- Revision validity, retirement, revocation, and restoration state effects (§5, §6).
- Content-addressed historical identity rehydration (§9).
- Universal session embodiment binding and verification vectors (§2, §10).

### §1.2 What this profile does not own

- Automation definitions, schedules, occurrences, attempts, leases, or retries — an
  automation definition references a binding profile; it does not define one.
- Principal authentication implementation (the binding records `principalId` as an
  authenticated opaque identifier; how authentication happened is out of scope).
- Protected-action authorization or approval decisions (RFC-0001 §5.3 approval tiers and
  the Ward authority layer own that; a binding does not approve anything).
- Runtime selection or dispatch mechanics.
- Cave/SDK projection state.

A binding does not itself grant runtime capabilities or authorize protected mutation;
Coven Threads/Coven authority evidence is separate and correlated (correlation fields in
§2.1). This separation mirrors RFC-0001 §3.3: authority limits are enforced by an authority
layer separate from the familiar's own logic, and this profile is identity evidence, not
authority.

### §1.3 Relation to RFC-0001

This profile extends the Familiar Contract with a *runtime-session embodiment* layer. It
changes no RFC-0001 conformance requirement: claimant-directory conformance (RFC-0001 §6.1)
is unaffected. It reuses RFC-0001's evidence discipline:

- **Hash roles** follow RFC-0001 §5.6.1: single-byte-sequence checksums are **SHA-256**
  content fingerprints (bare lowercase hex, 64 chars — `schemas/audit-record.schema.json`
  `hashHex`); multi-field structural commitments are BLAKE3. Every digest in this profile
  is a content fingerprint of exactly specified bytes, so any tool that can read the bytes
  can recompute it with no knowledge of this specification beyond the algorithm name.
- **Audit events** that record binding issuance, refusal, or later-state changes belong in
  the append-only audit log of RFC-0001 §5.6, which is already the provenance anchor for
  memory admission and Ward updates.

---

## §2. Normative objects

Two objects, both JSON (UTF-8), both fail-closed on unknown members:

| Object | Discriminator | Machine-readable form |
|---|---|---|
| Familiar Embodiment Binding | `familiar.embodiment_binding.v1` | `schemas/familiar-embodiment-binding.schema.json` |
| Familiar Embodiment Verification Result | `familiar.embodiment_verification.v1` | `schemas/familiar-embodiment-verification.schema.json` |

The `schema` member carries the object/profile/schema version; a second mutable version
field was considered and rejected (drift risk — see the design basis, D-3). Policy
versioning is carried separately in `policyVersion`.

### §2.1 `familiar.embodiment_binding.v1` — field reference

| Field | Type | Normative meaning |
|---|---|---|
| `schema` | const `familiar.embodiment_binding.v1` | Profile discriminator; its `:v<N>` suffix versions the profile and schema together. |
| `bindingId` | opaque string | Unique identifier of this binding. |
| `familiarRootId` | opaque string | Stable familiar root identity — the continuity anchor. |
| `identityRevisionId` | opaque string | The exact identity revision embodied; selected at dispatch, not at routine authoring time. |
| `revisionIndex` | integer ≥ 0 | Monotonic/lineage position; 0 = genesis. |
| `identityDeclarationDigest` | 64-lowercase-hex | Canonical identity declaration/bundle digest (§7.2). |
| `identityCanonicalization` | const `fc-identity-canonical:v1` | Versioned canonicalization rule for the declaration digest (§7). |
| `lineage` | array | Predecessor/root lineage evidence; entries carry `relationship` (`genesis` \| `same_familiar` \| `fork` \| `succession` \| `restoration`), `priorRevisionId`, `priorRootId` (required non-null for `fork`/`succession`), optional `evidenceDigest`, `recordedAt` (§4). |
| `recordedAt` | RFC 3339 UTC | Recorded time — when the registry recorded the revision (§7.4). |
| `validFrom` / `validUntil` | RFC 3339 UTC / nullable | Valid-time interval; null `validUntil` = open interval (§7.4). |
| `status` | enum `active, retired, revoked, superseded` | Decision-time status. A resolver MUST NOT issue a binding whose decision-time status is not `active` (§5); the full vocabulary exists so refusal records and decision-time evidence share one vocabulary. Immutable after commit (§6.5). |
| `principalId` | opaque string | Authenticated principal to which the familiar is bound for this embodiment. |
| `projectScope` | string \| null | Project/scope binding where relevant; explicit null otherwise. |
| `correlationTarget` / `correlationTargetType` | string / enum `session\|run\|attempt` | Session/run/attempt correlation target. RECOMMENDED mapping: `direct`→`session`, `automation`/`psyche`→`run` or `attempt`; this mapping is not identity-meaning-bearing and MUST NOT be load-bearing for authorization. |
| `bindingPurpose` | enum `direct` \| `automation` \| `psyche` | Purpose/profile. Closed enum in v1; new purposes require a profile version bump. |
| `issuedAt` | RFC 3339 UTC | Issued/decision timestamp — the moment the final validity check passed and the binding was committed (§6.1). |
| `policyVersion` | string | Version of the validity/lifecycle policy under which the binding was issued. |
| `resolverId` | opaque string | Resolver/verifier identity. |
| `historicalBundle.contentAddress` | 64-lowercase-hex | Content address of the retained historical bundle (SHA-256 over the bundle manifest's canonical bytes). |
| `historicalBundle.locator` | string \| null | Retrieval locator, or null when withheld (minimization/erasure/tombstone). |
| `bindingIntegrityDigest` | 64-lowercase-hex | SHA-256 over the canonical encoding of this object with `bindingIntegrityDigest` removed (§7.3). |
| `privacyClass` | enum `standard` \| `sensitive` \| `tombstoned` | Privacy/retention classification (§8). |
| `supersededBy` | string | REQUIRED when `status` is `superseded` (schema-enforced). |

All identifiers (`bindingId`, `familiarRootId`, `identityRevisionId`, `principalId`,
`resolverId`, `supersededBy`) **MUST** be stable opaque strings that do not encode display
names, email addresses, or personal data. Numbers are integers only (canonical-encoding
requirement, §7.1).

### §2.2 `familiar.embodiment_verification.v1` — verdict semantics

A verification result records the outcome of one verification act. It has a `question`
(`issuance_eligibility` — may this revision/binding be issued/used now; or
`historical_rehydration` — what did a historical run actually embody, and how much of that
evidence survives), a `subject` (`alias`, `revision`, or `binding`), a `verdict`, a
`reason` from the ratified vocabulary, an `evidence` block
(`identityDigestRecomputed`, `integrityRecomputed`, `lineageVerified`, `bundleStatus`,
`bundleComponentsChecked`, `observedStatus`, `redacted`), and `checkedAt`/`verifierId`/
`policyVersion`.

The schema enforces the core fail-closed invariants mechanically
(`schemas/familiar-embodiment-verification.schema.json`):

- `verdict: valid` ⇒ `reason: ok` and all three recompute booleans true.
- `verdict: unverifiable | invalid` ⇒ `reason ≠ ok`.
- `verdict: degraded` ⇒ `bundleStatus ∈ {partial, erased}` and `reason ≠ ok`.
- `question: issuance_eligibility` ⇒ `bundleStatus: not_applicable`; and conversely
  `historical_rehydration` requires a consulted-bundle status.

**Degradation rule (normative).** A verifier **MUST NOT** overclaim historical continuity
when required material is unavailable: missing bundle ⇒ `unverifiable`/`bundle_missing`;
erased sensitive components with surviving minimum evidence ⇒ `degraded`/`bundle_erased`;
unauthorized reader ⇒ `unverifiable`/`bundle_unauthorized` (the *existence* of the refusal
is recordable; the material is not disclosed). A `degraded` or `unverifiable` result
**MUST NOT** be consumed as a `valid` result by any conforming consumer.

---

## §3. What a binding is evidence of (and what it is not)

A committed binding is **evidence**, not authority. It states: at `issuedAt`, resolver
`resolverId`, under `policyVersion`, resolved alias input (if any) to root
`familiarRootId`, verified revision `identityRevisionId` (index `revisionIndex`, declaration
digest `identityDeclarationDigest`, status `active` at decision time) as valid for principal
`principalId`, and committed that embodiment to correlation target `correlationTarget` with
integrity digest `bindingIntegrityDigest`.

It does **not**:

- grant runtime capabilities or approve protected actions;
- author run lifecycle state (queueing, retry, lease, completion);
- authenticate the principal (it records an already-authenticated principal);
- imply human ownership of a person, model personhood, unrestricted agency, legal
  representation, or fiduciary duty (§8).

Coven Threads/Coven authority evidence for protected actions is separate and correlated by
`correlationTarget`; possession of a binding alone authorizes nothing beyond the claim
recorded in it. This separation mirrors RFC-0001 §3.3: authority limits are enforced by an
authority layer separate from the familiar's own logic, and this profile is identity
evidence, not authority.

---

## §4. Identity roots, revisions, and the lifecycle state machine

The **root** is the stable opaque continuity anchor (`familiarRootId`). The **revision**
is an exact, content-addressed state of that root's identity. Human-readable names and
aliases are input convenience; they are never the root of trust and never part of any
identifier (§8).

### §4.1 Revision lifecycle state machine

```
                     issuance-time observation
                              │
              ┌───────────────┼────────────────┐
              ▼                ▼                ▼
        [genesis:0] ──►    (active) ──────► (superseded ── supersededBy)
                              │                (successor revision active)
                 ┌────────────┴──────────┐
                 ▼                       ▼
             (retired)               (revoked)
                 │                       │
                 ▼                       │  (restoration is a policy act
              (active)  ◄────────────────┘  with explicit lineage; it creates
                                            a NEW revision via `restoration`)
```

Normative transitions (all effects are *new state*, never retroactive mutation):

| Transition | Effect on new bindings | Effect on historical verification |
|---|---|---|
| active → active (new revision, `same_familiar`) | New bindings pin the new revision; lineage carries `same_familiar` + `priorRevisionId`. | Historical runs still verify against the revision they committed. |
| active → `superseded` | New bindings MUST resolve to the successor (`supersededBy`); issuance of the superseded revision fails closed (`revision_superseded`). | Historical verification remains possible against retained material; `observedStatus: superseded` is later state. |
| active → `retired` | New bindings fail closed (`revision_retired`) unless the governing `policyVersion` explicitly defines a retired-tolerant purpose; that exception MUST be recorded in the policy, not assumed. | Historical verification unaffected; `observedStatus: retired`. |
| active → `revoked` | New bindings fail closed (`revision_revoked`). | Historical verification of committed bindings remains answerable; current-eligibility questions return `invalid`/`revision_revoked` (§6.5). |
| `retired` → active (restoration) | Restoration MUST create a new revision carrying a `restoration` lineage entry; it MUST NOT silently reuse a retired revision index. | Same-familiar continuity is verified through the explicit restoration lineage entry. |
| fork | A new root is created. Its genesis lineage carries `relationship: fork`, non-null `priorRevisionId` and `priorRootId` (schema-enforced). It is a **different** root: name similarity MUST NOT be treated as continuity. | Cross-root historical verification uses the fork evidence; continuity claims across a fork MUST cite lineage evidence, never names. |
| succession | A new root becomes the successor of an old root's lineage. Binding lineage records `relationship: succession` with both roots' identifiers (schema requires non-null `priorRootId`). | Same as fork: evidence-based, never name-based. |

### §4.2 Same-familiar continuity is machine-verifiable

Same-familiar continuity, fork/new-root distinction, and succession mapping **MUST** be
verifiable from `lineage` evidence (relationship, `priorRevisionId`, `priorRootId`,
`evidenceDigest`), never inferred from names, aliases, or content similarity. This is the
same discipline RFC-0001 §5.6.1 applies to provenance: continuity claims are checked
against evidence, and an unverifiable chain fails closed (`lineage_unverifiable`).

---

## §5. Resolution and validity rules

1. A human-readable familiar name/alias is **input convenience, never the root of trust**.
2. Alias resolution **MUST** produce exactly one stable root or refuse: zero matches ⇒
   `alias_unresolved`; more than one ⇒ `alias_ambiguous`. Ambiguity is refused, never
   resolved silently by preference, recency, or string similarity.
3. The exact revision is selected at dispatch/session creation — **not** frozen when a
   routine/automation is authored. An automation definition MAY pin a revision floor, never
   a frozen revision as the root of trust.
4. The selected revision **MUST** be valid for execution under the current `principalId`
   (and `projectScope`, where present) and lifecycle policy at decision time.
5. Revoked, invalid, unresolved, and cryptographically unverifiable revisions **fail
   closed** — the resolver emits a verification result with the matching `reason` and no
   binding is committed. A resolver **MUST NOT** issue a binding whose decision-time
   status is not `active`.
6. A stale resolver cache **MUST NOT** silently produce an active binding: cached
   resolution output older than the cache-freshness bound defined by `policyVersion`
   **MUST** be re-resolved; presenting stale cache as fresh is a
   `stale_cached_revision` refusal.
7. A later identity revision does **not** rewrite which revision a historical run embodied.
8. Retirement/restoration/fork/succession have the explicit §4.1 effects on new bindings
   and historical verification.
9. Direct Coven and Psyche-delegated launches use the same binding semantics; only
   `bindingPurpose` and correlation differ.

---

## §6. Issuance, atomicity, and revocation (TOCTOU contract)

### §6.1 Issuance procedure

1. Resolve the alias (if any) to exactly one root (§5).
2. Load the revision the registry currently reports (never a stale cache, §5.6).
3. Verify the identity declaration digest against the canonical bytes the registry retains
   (§7); an unsupported canonicalization or algorithm is rejected, never skipped
   (`algorithm_unsupported`).
4. Run the final validity check: status active, valid-time interval covers `issuedAt`,
   principal/scope match, lineage evidence verifies, policy version supported.
5. Commit the binding (the object this profile defines) with `bindingIntegrityDigest` set.
6. Verify the committed binding bytes/digest **before** returning launch success (§6.3).

### §6.2 Atomicity requirements

- Where the platform offers a transaction boundary, the **final validity check and the
  binding commit MUST use one immutable snapshot**: the identity snapshot proven valid is
  exactly the one committed. Where no transaction boundary exists, the implementation
  **MUST** record `bindingDigest` (over the exact committed bytes) in the verification
  evidence and re-run the final validity check immediately before commit, treating any
  observed drift as `revocation_race` (fail closed).
- The committed binding bytes/digest **MUST** be verified before launch success is returned
  (recompute `bindingIntegrityDigest` over the committed bytes).
- An identity change after binding commit is **later state** (audit event, verification
  result with `observedStatus`), **never** a retroactive mutation of the committed binding.
- Revocation during queued / awaiting-approval / dispatching / running states **MUST** have
  an explicit policy and an event trail: the table in §6.5 is the ratified default.
- A stale resolver cache **MUST NOT** silently produce an active binding (§5.6;
  `stale_cached_revision`).

### §6.3 Committed-bytes verification

The consumer of a binding (the runtime about to launch) **MUST** recompute
`bindingIntegrityDigest` over the received committed bytes before treating launch as
successful; a mismatch is tamper evidence and fails closed (`integrity_mismatch`).

### §6.4 Integrity/authentication — v1 decision

`bindingIntegrityDigest` is an **unkeyed** SHA-256 content fingerprint: it is
tamper-*evident* (corruption, drift, and cross-replica divergence are detectable by any
verifier that can read the bytes), matching RFC-0001 §5.6.1's content-fingerprint role and
its cross-implementation recompute obligation. It is **not** by itself adversarial
authentication; a determined attacker who can rewrite storage can also recompute it.
Adversarial authentication (keyed BLAKE3 commitment under the authority layer's key, or an
asymmetric signature by the identity registry) is RECOMMENDED as the first ratified v1.x
extension and is a maintainer decision — see the design document, D-7.

### §6.5 Revocation and later state

A committed binding **MUST NOT** be retroactively mutated. Identity change after binding is
**later state**: an audit event and/or verification result referencing the `bindingId`, in
the same append-only discipline as the RFC-0001 §5.6 audit log. Explicit revocation policy
by execution state:

| State at revocation | Policy (v1 default) | Event trail |
|---|---|---|
| queued | dispatch MUST refuse; nothing launches | revocation event + verification result `invalid`/`revision_revoked` |
| awaiting-approval | approval request MUST be withdrawn/annotated; approval cannot proceed on a revoked revision | revocation event + verification result |
| dispatching | the final validity check (§6.1 step 4) is re-run at the commit boundary; `revocation_race` fails closed | revocation event; no binding committed |
| running | the run MAY complete in-flight per governing policy, but the revocation MUST be recorded immediately and MUST affect any subsequent launch decision | revocation event; later verification results carry `observedStatus: revoked` |

---

## §7. Digest boundary and canonicalization

### §7.1 Canonical JSON (`fc-canonical-json:v1`)

All profile digests over JSON material use **`fc-canonical-json:v1`**: UTF-8; object member
names sorted recursively by Unicode code point of the UTF-8 encoding; no insignificant
whitespace; integers only (this profile defines no fractional numbers); arrays in given
order; standard minimal JSON string escaping. This is the same discipline the repo's
content fingerprints use (SHA-256 over exactly specified input bytes, bare lowercase hex —
RFC-0001 §5.6.1; encoding normative in `schemas/audit-record.schema.json` `hashHex`).

### §7.2 Identity declaration digest

`identityDeclarationDigest` = SHA-256 over the **identity declaration manifest** encoded
with `fc-identity-canonical:v1`, where the manifest is the object map

```
{ "<member-name>": "<sha256 of that member's exact retained bytes>", ... }
```

whose member set is the familiar's identity surfaces (at minimum the RFC-0001 §3.1/§3.3/§3.4
required directory members: `SOUL.md`, `IDENTITY.md`, `MEMORY.md`, `ward.toml`, by canonical
relative name). This commits the member set and each member's bytes without embedding any
content — the digest boundary, not the payload, is what travels with every run. The
declaration manifest shape is registry-retained; rehydration (§9) recovers members by
content address.

### §7.3 Binding integrity digest

`bindingIntegrityDigest` = SHA-256 over the canonical encoding (`fc-canonical-json:v1`) of
the binding object with the `bindingIntegrityDigest` member removed. The `schema`
discriminator is part of the hashed material and versions the construction (analogous to
the embedded domain tags of RFC-0001 §5.6.1: "their domain tags are their version"). The
checker at `validators/check-embodiment-binding.js` recomputes this for every positive
fixture — the profile's canonicalization is self-checkable from the record alone.

### §7.4 Recorded time vs valid time

`recordedAt` is when the registry recorded the revision (transaction time). `validFrom` /
`validUntil` are the revision's valid-time interval (asserted applicability). Historical
verification answers "what was recorded and valid when the run was dispatched" from
committed bindings; current eligibility is answered from the registry now. A revision's
valid-time interval closing does **not** invalidate historical records that were valid when
issued.

---

## §8. Privacy and language

- Normative records use **stable opaque identifiers** (`bindingId`, `familiarRootId`,
  `identityRevisionId`, `principalId`); they **MUST NOT** encode display names, email
  addresses, or personal data. This follows the repo's established privacy posture
  (`schemas/coven-memory-schema.md` §11.1 hard rule on absolute paths and raw session keys;
  `SECURITY.md` guard patterns).
- Sensitive declaration, relationship, memory, and credential data **MUST** stay in
  separately encrypted/authorized stores; bindings carry `identityDeclarationDigest` and
  `historicalBundle.contentAddress`, never payloads.
- `privacyClass` classifies retained material; `bundleStatus: unauthorized` exists so a
  verifier can refuse an unauthorized historical read **without disclosing whether the
  material exists** beyond the refusal itself.
- Minimization, retention, redaction, erasure, and tombstones: `redacted: true` records are
  recorded-redaction, never silent; `tombstoned` bindings null their locator and degrade
  verification (fail closed). Erasure removes payload components; minimum integrity/audit
  evidence (digests, lineage, timestamps) is retained per §9.
- Product language ("ran as Charm", familiar continuity) is preserved at the presentation
  layer; normative records speak in root/revision/principal identifiers. Nothing in this
  profile implies human ownership of a person, model personhood, unrestricted agency,
  legal representation, or fiduciary duty — the same restraint RFC-0001 applies to
  personhood claims (RFC-0001 §3.5 binds familiars to persons; it does not merge them).

---

## §9. Historical rehydration

A verifier **MUST** be able to reconstruct the exact identity declaration used by a
historical run through content-addressed retained material, subject to privacy policy:

- **Required retained bundle components (v1 minimum):** the identity declaration manifest
  itself (each member's bytes recoverable by content address), the lineage evidence records
  referenced by `lineage[].evidenceDigest`, and the revocation/retention state records
  needed to interpret `status` transitions.
- **Digest/canonicalization algorithm and versioning:** every digest is SHA-256, bare
  lowercase hex (RFC-0001 §5.6.1); canonicalization is versioned via
  `identityCanonicalization` (v1: `fc-identity-canonical:v1`, §7). An implementation that
  does not support a named canonicalization **MUST** fail closed (`algorithm_unsupported`).
- **Erasure with surviving minimum evidence:** when sensitive payload components are erased
  under privacy policy, the binding record, digests, lineage evidence, and audit trail
  **MUST** remain sufficient to attest *that* the run embodied the named revision with
  digest X — while the erased content is unrecoverable. The verification result is then
  `degraded` (bundleStatus `erased`), never `valid`, and never silently upgraded.
- **Result states:** `present`, `partial`, `erased`, `missing`, `unauthorized` (§2.2
  `evidence.bundleStatus`); `partial`/`erased` ⇒ at best `degraded`; `missing` /
  `unauthorized` ⇒ `unverifiable`. Do not overclaim historical continuity when required
  material is unavailable.
- **Device/replica revocation and purge:** where retained material was purged under device/
  replica revocation, the registry **MUST** be able to distinguish "erased under policy"
  (`bundle_erased`) from "lost" (`bundle_missing`); a purge that removes minimum audit
  evidence **MUST** surface as `unverifiable`/`bundle_missing`, and the purge itself
  **MUST** be recorded (tombstone: binding `privacyClass: tombstoned`, locator null).
- **Recorded time vs valid time:** per §7.4.

---

## §10. Conformance vectors

The golden vectors are published as immutable JSON artifacts at
`tests/conformance/embodiment-binding/vectors/EBV-01.json` … `EBV-18.json`, checked by
`validators/check-embodiment-binding.js` in every suite run. Each vector records `given`
(the scenario), `expect` (one or more `{question, verdict, reason}` outcomes), and, where
the scenario produces one, the normative record (`binding` and/or `verification`) that a
conforming implementation would emit. Vectors are consumable by Coven, Psyche, Cave, SDK,
and independent validators at the exact artifact revision (git commit) that carries them.

| Vector | Scenario | Expected |
|---|---|---|
| EBV-01 | valid active root/revision binding | `issuance_eligibility` / `valid` / `ok` |
| EBV-02 | alias resolves to one root | `issuance_eligibility` / `valid` / `ok` |
| EBV-03 | ambiguous alias refusal | `issuance_eligibility` / `invalid` / `alias_ambiguous` |
| EBV-04 | stale cached revision refusal | `issuance_eligibility` / `invalid` / `stale_cached_revision` |
| EBV-05 | revoked revision refusal | `issuance_eligibility` / `invalid` / `revision_revoked` |
| EBV-06 | retired familiar behavior | `issuance_eligibility` / `invalid` / `revision_retired` |
| EBV-07 | restored familiar with explicit lineage | `issuance_eligibility` / `valid` / `ok` (restoration lineage entry) |
| EBV-08 | new revision of the same familiar | `issuance_eligibility` / `valid` / `ok` (`same_familiar` lineage) |
| EBV-09 | fork/new-root distinction | `issuance_eligibility` / `valid` / `ok` (`fork` lineage, distinct `priorRootId`) |
| EBV-10 | succession mapping | `issuance_eligibility` / `valid` / `ok` (`succession` lineage, both roots named) |
| EBV-11 | direct Coven session binding | `issuance_eligibility` / `valid` / `ok` (`direct`/`session`) |
| EBV-12 | scheduled automation run binding | `issuance_eligibility` / `valid` / `ok` (`automation`/`run`) |
| EBV-13 | Psyche-delegated run binding | `issuance_eligibility` / `valid` / `ok` (`psyche`/`run`) |
| EBV-14 | principal mismatch | `issuance_eligibility` / `invalid` / `principal_mismatch` |
| EBV-15 | tampered declaration/bundle digest | `historical_rehydration` / `invalid` / `digest_mismatch` |
| EBV-16 | missing historical bundle / degraded verification | `historical_rehydration` / `unverifiable` / `bundle_missing` |
| EBV-17 | privacy-authorized vs unauthorized historical reads | authorized → `degraded`/`bundle_erased`; unauthorized → `unverifiable`/`bundle_unauthorized` |
| EBV-18 | revocation race before/after binding commit | before commit: `issuance_eligibility`/`invalid`/`revocation_race`; after commit: historical question remains `valid`/`ok` with `observedStatus: revoked` (later state), current eligibility `invalid`/`revision_revoked` |

### §10.1 What the file-level suite does not test (runtime gaps)

Like RFC-0001 §9, the structural suite cannot execute runtime behavior. The following are
normative but require runtime testing against implementations: that a real resolver returns
the vector verdicts; alias-resolution store consistency; cache-freshness enforcement;
atomic snapshot/commit behavior (§6.2); revocation event delivery; bundle retrieval and
component recompute; privacy-authorization enforcement at the storage layer; and
device/replica purge propagation. The lane checks the structural claims: schema validity of
records and vectors, canonicalization and integrity recomputation, verdict/reason
consistency, and fail-closed vector coverage.

---

## §11. References

- RFC-0001 v0.7.0 — the Familiar Contract (this repository): five properties; Ward and
  authority-layer separation (§5.1); audit log (§5.6); hash algorithms and canonical
  encodings (§5.6.1); conformance (§6).
- `schemas/audit-record.schema.json` — hash-encoding discipline reused here (bare lowercase
  64-hex; SHA-256 content fingerprints).
- `schemas/coven-memory-schema.md` — the repo's precedent for a cross-repo normative
  profile co-located with its schema; §11.0 fail-closed gate conventions; §11.3
  manifest `sha256` content addressing.
- `validators/check-audit-records.js`, `tests/conformance/audit-records/` — the lane
  pattern (positive/negative fixtures, worked vectors, fail-closed coverage) reused here.
- `validators/validate.js`, `tests/conformance/run-conformance.sh` — structural conformance
  entry points this profile's lane is wired into.
- Cross-repository program: OpenCoven/coven#854; Coven integration: OpenCoven/coven#857.
  Consumers: Coven (dispatch + authority), Psyche (delegated runs), Cave, SDK, independent
  validators — each consumes the schemas and vectors at an exact artifact revision.

*Bead packet: one P0 protocol-profile bead mapped to OpenCoven/familiar-contract#17,
blocking the identity portion of OpenCoven/coven#857. Evidence bundle = this profile, the
two schemas, the conformance vectors, the design document, and the exact artifact revision
(git commit) of the merge.*
