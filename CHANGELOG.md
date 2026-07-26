# Changelog

All notable changes to this specification are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project uses [Semantic Versioning](https://semver.org/).

---

## [0.7.0] — 2026-07-26

Draft minor under the **v0.5.0** §6.3 rule (unchanged through v0.6.0): rescopes an existing normative MUST and promotes the reference `ward_hash` leaf construction to a normative definition. Closes both findings of the v0.6.0 post-merge review (beads `threads-8gg`, `threads-df9`).

### Added

- **RFC-0001 §5.6.1** — The `ward_hash` Merkle leaf `payload` is now defined: the thread's `thread:v2` leaf commitment (surface path, writer id, sorted deduplicated covered-channel tags, full tension-state commitment bytes, lexicographically sorted strand commitment bytes; every field big-endian-u64 length-prefixed). The reference implementation's construction is adopted as the **normative** definition of the payload bytes, restoring the design-basis D-2 delegation dropped in the v0.6.0 transposition; a change to the payload construction **MUST** change its embedded tag. Previously `ward_hash` was not recomputable from the RFC alone.
- **RFC-0001 §10.1** — Normative reference to `coven-threads-core` (`weave.rs` `thread_leaf_bytes`, `manifest.rs` `merkle_root`) as the source of the §5.6.1 structural-commitment constructions.
- **rfcs/RFC-0001-v0.6.md** — Historical snapshot of the final v0.6.x text (exact copy of tag `v0.6.0`).

### Changed

- **RFC-0001 §5.6.1 (cross-implementation verification)** — The recompute **MUST** is scoped by hash role: content fingerprints (`diff_hash`, `entry_hash`) remain recomputable from the audit log plus referenced surface bytes alone; `ward_hash` recomputation requires the committed authority state it commits to, which the log references but does not embed. A verifier holding only the log and surfaces **MUST** verify the field's textual encoding and **MUST NOT** treat missing committed state as a recomputation mismatch. The v0.6.0 wording overclaimed the `ward_hash` inputs (undischargeable as written); the §9 gap bullet is rescoped to match.
- **validators/check-audit-records.js** — Fails closed unless at least one `.entry` and one `.surface` companion vector was found and verified per run: a deleted or renamed vector file now breaks the suite instead of silently skipping the §6.1 worked-vector demonstration.
- **Migration impact:** none for the reference implementation — the leaf-payload definition codifies its deployed `thread:v2` construction, and the rescoped MUST matches what implementations could actually do. Directories structurally conformant with v0.6.0 are structurally conformant with v0.7.0; no claimant-directory changes. Foreign implementations gain a complete, citable `ward_hash` preimage definition where none existed. Consumers pinning v0.6.0 are unaffected.
- **Security rationale:** an unrecomputable structural commitment invites trust-not-verify — the failure §5.6.1 exists to remove; the normative leaf-payload definition makes `ward_hash` independently checkable by anyone holding the committed state. Role-scoping the recompute MUST prevents false tamper alarms (a verifier treating "cannot recompute for lack of inputs" as tamper evidence trains operators to ignore the alarm that matters). The vector-coverage assertion closes a fail-open in the conformance machinery itself: the §6.1 claim is now enforced by the run, not by the continued presence of optional files.
- **README.md, PRIMER.md, SPEC.md, rfcs/README.md, docs/faq.md, tests/conformance/README.md, validators/README.md, validators/validate.js, schemas/ward.schema.json + schemas/audit-record.schema.json (description strings), package.json** — Updated current-version references to v0.7.0.

---

## [0.6.0] — 2026-07-26

Draft minor under the **v0.5.0** §6.3 rule: additive normative conformance changes (new MUSTs on previously implementation-defined hash fields; a new audit-record lane in the reference conformance suite). Closes the A-6 residual from the v0.3.0 provenance review. Design basis: `docs/superpowers/specs/2026-07-22-hash-canonicalization-design.md` (bead `threads-5vn`).

### Added

- **RFC-0001 §5.6.1** — Hash algorithms and canonical encodings for the audit log's hash-bearing fields: structural commitments (`ward_hash`, multi-field/Merkle commitments) use BLAKE3 with domain-tagged, length-prefixed framing; content fingerprints (`diff_hash`, `entry_hash`) use SHA-256 over exactly specified input bytes; textual encodings are 64-character lowercase bare hex (prefixed forms prohibited) with an explicit `"blake3"`/`"sha256"` discriminator where a field's definition does not fix the algorithm. Implementations **MUST** reject attestations naming unsupported algorithms (never skip verification), **MUST** be able to recompute every recorded hash from the audit log and referenced surface bytes regardless of writing implementation, and **MUST** treat recomputation mismatches as tamper evidence.
- **schemas/audit-record.schema.json** — Machine-readable form of the §5.6/§5.6.1 audit-record field constraints for textual (JSON) encodings.
- **tests/conformance/audit-records/** — New conformance lane (4 positive, 7 negative single-record fixtures) checked by `validators/check-audit-records.js` under the same `npm test` entry point; positive fixtures carry worked test vectors — SHA-256 vectors verified by recomputation from companion byte files, and the BLAKE3 empty-weave reference vector `blake3("coven-threads:empty:v1")` computed from the reference construction.
- **validators/validate.js** — Optional claimant-directory audit-record samples: `audit/*.json` validates against the schema when present; absence of `audit/` is not a violation, a present-but-empty `audit/` fails closed. Covered by fixtures `positive/07-audit-record-samples` (worked provenance chain whose SHA-256 vectors recompute from the fixture's own `MEMORY.md` bytes), `negative/37-bad-entry-hash`, and `negative/38-empty-audit-dir`.
- **RFC-0001 §8.2 / §9** — Failure mode and testing-gap bullets for runtime hash obligations: recomputation-as-tamper-evidence, fail-closed unsupported-algorithm rejection, and cross-implementation `ward_hash` verification are runtime properties beyond the file-level suite.
- **rfcs/RFC-0001-v0.5.md** — Historical snapshot of the final v0.5.x text (exact copy of tag `v0.5.0`).

### Changed

- **Migration impact:** none for the reference implementation (`coven-threads-core` and the `coven` daemon) — §5.6.1 codifies its deployed practice, grandfathering existing domain-tagged constructions (their `:v<N>` tags are their version). Other implementations of §5.6 must verify their hash fields recompute under the now-normative definitions. No claimant-directory changes are required; directories without `audit/` samples are unaffected. Consumers pinning v0.5.0 are unaffected.
- **Security rationale:** unspecified hash constructions made provenance chains verifiable only by their writer — a foreign implementation or auditor had to trust, not verify, exactly where §5.6 exists to remove trust. Fixed constructions make tampering detectable across implementations; fail-closed algorithm handling prevents downgrade-by-unknown-algorithm; domain tags with length-prefix framing prevent cross-context collision and forgeable delimiter framing.
- **README.md, PRIMER.md, SPEC.md, rfcs/README.md, docs/faq.md, tests/conformance/README.md, validators/README.md, validators/validate.js, schemas/ward.schema.json (description string), package.json** — Updated current-version references to v0.6.0.

---

## [0.5.0] — 2026-07-24

Draft minor, classified under the **v0.4.1** §6.3 rule per the incoming §6.3.1 freeze: one additive normative change, shipped alone. No directory-level conformance requirements change.

### Added

- **RFC-0001 §6.3.1** — Amendment freeze for the versioning rule: a release changing §6.3 **MUST NOT** contain any other normative change (current-version anchor substitutions inside otherwise-unchanged normative sentences excepted), **MUST** be classified under the §6.3 rule ratified in the most recent prior release (never the rule it introduces), a changed rule governs only later releases, and ambiguous classification under the prior rule **MUST** take the larger bump. Closes the self-ratification pattern (v0.4.0 review finding A-1; first flagged as A-7 in the v0.3.0 review).
- **RFC-0001 §9** — Testing-gap bullet for §6.3.1 (release-process property; verified in release history and review, not by the file-level suite).
- **rfcs/RFC-0001-v0.4.md** — Historical snapshot of the final v0.4.x text (exact copy of tag `v0.4.1`).

### Changed

- **Migration impact:** none. Directories structurally conformant with v0.4.1 remain structurally conformant with v0.5.0; the new MUSTs bind the RFC's own release process, not implementations.
- **Security rationale:** §6.3 is the specification's own authority boundary; a release blessed by the versioning rule it introduces is self-ratifying — the specification-layer analogue of the Ward-mutation loophole Gate 4 closes. The freeze makes the amendment rule a protected surface of the spec itself.
- **README.md, PRIMER.md, SPEC.md, rfcs/README.md, docs/faq.md, tests/conformance/README.md, validators/README.md, validators/validate.js, schemas/ward.schema.json (description string), package.json** — Updated current-version references to v0.5.0.

---

## [0.4.1] — 2026-07-21

Draft patch (§6.3): clarifications only; no conformance requirements change.

### Changed

- **RFC-0001 §1.1** — Completed the *standard admission path* definition with the §3.4 loop-origin authorization step (clarification; no new requirement).
- **RFC-0001 §5.6** — Annotated the evidence-field list with per-event-type MUST pointers, including `principal_authorization` on loop-originated `memory_entry_admitted` events (cross-reference; no new requirement).
- **tests/conformance/negative/09-missing-memory/CASE.md** — Corrected the false claim that the validator reports missing `MEMORY.md` "as a warning only" (it is a violation since v0.2.0) and dropped the stale v0.2 anchor.
- **tests/conformance/positive/05-tier-rich-ward/CASE.md** — Reanchored the tier-name citation from "the v0.2 RFC frame" to RFC-0001 §5.3.
- **README.md, PRIMER.md, SPEC.md, rfcs/README.md, docs/faq.md, tests/conformance/README.md, validators/README.md, validators/validate.js, package.json** — Updated current-version references to v0.4.1.

---

## [0.4.0] — 2026-07-19

### Added

- **RFC-0001 §5.3.1** — Added a normative approval-tier compiler mapping from Ward TOML declarations to typed daemon approval paths and registered surface-region identifiers.
- **tests/conformance/** — Expanded approval-tier conformance coverage to 36 negative cases total, including malformed TOML, schema-invalid metadata, unknown tier fields, gate mismatches, invalid veto declarations, and unbound, duplicate, or mistyped block declarations.

### Changed

- **RFC-0001 §5.3.1** — Tier declarations now fail closed on unknown fields and require the tier's exact gate plus non-empty, unique block lists bound to registered `editable.harness_blocks` entries.
- **RFC-0001 §5.3.1 / §5.4** — Veto windows remain optional where allowed, but use delayed apply with evidence replay plus Gate 4 revalidation before any write.
- **RFC-0001 §5.3.1 / §5.4** — Protected-target proposals are explicitly outside approval-path promotion; principal-authorized protected updates remain a separate audited path.
- **README.md, rfcs/README.md, SPEC.md, docs/faq.md, tests/conformance/README.md, validators/README.md, validators/validate.js** — Updated current-version references to v0.4.0.
- **validators/validate.js** — Replaced the hand-written Ward parser with standards-compliant TOML parsing and Ajv JSON Schema validation before semantic checks.
- **RFC-0001 §1.1 / §6.1** — Defined claimant directory, reference conformance suite, structurally conformant familiar directory, surface region identifier (`SurfaceRegionId`), and deterministic extractor as first-class terms; a v0.4.0 structural-conformance claim now requires both the claimant-directory validator run and the reference conformance suite run.
- **RFC-0001 §9** — Added an open-gap bullet for approval-path compilation: extractor binding, veto-window delayed apply with evidence replay and Gate-4 re-run, and fail-closed Ward loading are runtime behaviors outside the structural suite.
- **examples/, tests/conformance/positive/** — Updated `examples/minimal`, `examples/sage`, and positive fixtures 01–05 `ward.toml` files to declare `editable.harness_blocks` and bind tier `blocks` to registered entries (minimal also drops `system_prompt.recovery`), keeping the suite green across the breaking declaration change.
- **RFC-0001 §6.3** — Redefined the versioning rule for the Draft stage: draft minor releases MAY introduce breaking conformance changes with documented migration impact and security rationale, and consumers MUST pin the exact draft version they implement.

### Migration

Upgrading from v0.3.0 to v0.4.0 can invalidate previously accepted Ward declarations. Before compiling or deploying v0.4.0:

1. Declare `editable.harness_blocks`.
2. Ensure every tier block is a nonempty, unique string registered in `editable.harness_blocks`.
3. Use the tier's exact gate for promotion; do not infer or alias gates.
4. Remove unknown tier fields and unknown tier tables.
5. Allow `human_veto_window_hours` only on `auto` and `familiar_review`, and only as a positive integer.
6. Run `npm install`, then validate the Ward before upgrading.

### Security rationale

Prior v0.3-style ignored, ambiguous, or stringly typed declarations could create policy drift or bypasses. The v0.4 validator now rejects malformed TOML and schema-invalid values before semantic compilation, forcing deterministic, fail-closed authority declarations.

---

## [0.3.0] — 2026-07-18

### Added

- **RFC-0001** — Added Property 4 provenance requirements for continuity-bearing memory entries, including standard admission path definition and audit-log dependency.
- **RFC-0001 §5.6** — Added `memory_entry_admitted` and `principal_authorized_write` audit event vocabulary for falsifiable source attestations.
- **RFC-0001 §5.6** — Required evidence fields at the provenance-chain anchors: `principal_authorized_write` and `ward_updated` events MUST carry `principal_authorization` (and `ward_updated` additionally `ward_version`/`ward_hash`); attestations resolving to events lacking them are unverified, and unresolvable attestation referents MUST be rejected.
- **RFC-0001 §1.1** — Defined "Committed Ward state" and "Continuity-bearing" (with fail-closed classification default); scoped the Ward-manifest equivalent-form allowance to authority-layer runtime storage.
- **RFC-0001 §3.4** — Attestation establishes provenance, not authorization: loop-originated entries additionally require explicit human authorization, recorded on the admission event (§5.6); ambiguous origin is treated as loop-originated.
- **RFC-0001 §4.1** — Genesis bootstrap note: closure is satisfiable from the first principal-authorized Ward write.
- **RFC-0001 §5.4 / §9** — Gate 4 re-verifies Ward-manifest closure before promotion; documented runtime closure verification as an open testing gap.
- **tests/conformance/negative/10-protected-missing-ward/** — Added negative fixture for a Ward manifest omitted from `[protected].files`.

### Changed

- **RFC-0001** — Bumped draft version to v0.3.0 for new backward-compatible normative requirements.
- **RFC-0001 §4.1 / §5.4** — Strengthened Ward-manifest closure prose and Gate 1 fail-closed behavior.
- **RFC-0001 §3.4 / §5.6** — Replaced the undefined "claiming Property 4 provenance" condition with "an implementation that provides a standard admission path (§1.1)".
- **RFC-0001 §6.3** — Redefined semver categories: Major now covers *incompatible* changes to the five properties or existing conformance requirements; Minor covers backward-compatible normative additions (previously any change to MUST-level requirements read as Major).
- **README.md, rfcs/README.md, SPEC.md, docs/faq.md, validators/validate.js** — Updated current-version references to v0.3.0.
- **docs/ward-deep-dive.md** — Updated version references to v0.3.0 and reframed the open-questions horizon.

---

## [0.2.0] — 2026-06-19

### Added

- **rfcs/RFC-0001-familiar-contract.md** — Reformulation of the v0.1.0 specification as a numbered, RFC-2119-keyworded document
  - 11 sections, 3,614 words, normative throughout
  - Section 5.1 hardens authority-layer separation requirement
  - Section 5.4 specifies four enforcement gates with normative MUST/MUST NOT requirements
  - Section 4.2 adds protected-invariants requirement (semantic protection beyond path-only)
  - Section 5.5 specifies regression-suite and identity-probe requirements
  - Section 5.6 adds audit-log requirements (append-only)
  - Section 7.2 documents convention-based production systems (HKUDS ohmo, Signet AI, Letta) and explicitly distinguishes from this RFC's structural protection
  - Section 7.3 documents the self-improvement loops this RFC defends against (Self-Harness, SkillOpt, sleep-time compute, Letta sleep-time agents)
  - Section 8 adds explicit threat model and failure modes
  - Section 9 acknowledges open testing gaps (file-level vs system-level conformance)
- **rfcs/README.md** — RFC process documentation (lifecycle, numbering, citation format)
- **tests/conformance/** — Executable conformance suite
  - `positive/` — minimum 5 cases that MUST pass validation
  - `negative/` — minimum 8 cases that MUST fail validation, each with documented violation
  - `run-conformance.sh` — runnable bash script verifying full suite

### Changed

- **README.md** — Version badge updated to v0.2.0; RFC-0001 badge added
- **validators/validate.js** — Promoted missing MEMORY.md from warning to violation (RFC-0001 §3.4 makes file presence a MUST, not a SHOULD). Also updated version-string output to v0.2.0. Surfaced by negative/09-missing-memory test case.
- **SPEC.md** — Marked as Superseded; preserved for reproducibility with clear pointer to RFC-0001

### Citation

The RFC is now the canonical citation target:

> Familiar Contract RFC-0001 v0.2.0, "The Familiar Contract."
> OpenCoven, 2026. https://github.com/OpenCoven/familiar-contract/blob/main/rfcs/RFC-0001-v0.2.md

For academic citation, the tagged release at `v0.2.0` provides a stable URL.

---

## [0.1.0] — 2026-06-11

### Added

- **SPEC.md** — The Familiar Contract v0.1.0 normative specification
  - Five properties defined with compliance criteria and violation criteria
  - Protected surface definition (what a familiar cannot change about itself)
  - Editable surface definition (what the self-improvement loop may propose)
  - Approval tiers (Tier 0–3 + Blocked)
  - Ward pointer (enforcement mechanism)
  - Versioning policy
- **Schemas**
  - `soul.schema.json` — JSON Schema for SOUL.md required/optional fields
  - `identity.schema.json` — JSON Schema for IDENTITY.md
  - `ward.schema.json` — JSON Schema for ward.toml (core v0.1 fields)
  - `role.schema.json` — JSON Schema for ROLE.md frontmatter
- **Examples**
  - `examples/sage/` — Sage (full compliant familiar, canonical reference)
  - `examples/minimal/` — Lumen (minimal compliant familiar, floor reference)
- **Validator**
  - `validators/validate.js` — Node.js CLI validator (no external deps required)
- **Documentation**
  - `docs/five-properties.md` — The five properties in depth
  - `docs/why-identity-not-skills.md` — Why identity needs its own layer
  - `docs/ward-primer.md` — What the Ward is
  - `docs/comparison.md` — How this relates to ECC, Multica, other approaches
- **Contributing**
  - `.github/CONTRIBUTING.md`
- **README.md**, **PRIMER.md**, **FAQ.md**

### Scope of v0.1.0

This version covers:
- The five Familiar Contract properties (normative)
- SOUL.md, IDENTITY.md, ward.toml schemas
- Minimum viable familiar definition
- Protected and editable surface definitions
- Approval tiers (concept)

Not in scope for v0.1.0 (planned for later versions):
- Runtime-specific implementation guides
- MCP tool grant integration
- Multi-familiar orchestration protocols
- Doll / Sympathetic Familiar Architecture
- Ward daemon implementation spec

---

*Sage, 2026-06-11 — initial skeleton built for OpenCoven/familiar-contract*
