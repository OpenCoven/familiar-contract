# Changelog

All notable changes to this specification are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project uses [Semantic Versioning](https://semver.org/).

---

## [0.3.1] — 2026-07-21

### Changed

- **RFC-0001 §1.1** — Completed the *standard admission path* definition with the §3.4 loop-origin authorization step (clarification; no new requirement).
- **RFC-0001 §5.6** — Annotated the evidence-field list with per-event-type MUST pointers, including `principal_authorization` on loop-originated `memory_entry_admitted` events (cross-reference; no new requirement).
- **README.md, rfcs/README.md, SPEC.md, docs/faq.md, docs/ward-deep-dive.md, tests/conformance/README.md, validators/README.md, validators/validate.js** — Updated current-version references to v0.3.1.

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
> OpenCoven, 2026. https://github.com/OpenCoven/familiar-contract/blob/main/rfcs/RFC-0001-familiar-contract.md

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
