# Changelog

All notable changes to this specification are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project uses [Semantic Versioning](https://semver.org/).

---

## [0.4.0] — 2026-07-19

### Added

- **RFC-0001 §5.3.1** — Added a normative approval-tier compiler mapping from Ward TOML declarations to typed daemon approval paths and registered surface-region identifiers.
- **tests/conformance/** — Expanded approval-tier conformance coverage to 28 negative cases total, including unknown tier fields, gate mismatches, invalid veto declarations, and unbound, duplicate, or mistyped block declarations.

### Changed

- **RFC-0001 §5.3.1** — Tier declarations now fail closed on unknown fields and require the tier's exact gate plus non-empty, unique block lists bound to registered `editable.harness_blocks` entries.
- **RFC-0001 §5.3.1 / §5.4** — Veto windows remain optional where allowed, but use delayed apply with evidence replay plus Gate 4 revalidation before any write.
- **RFC-0001 §5.3.1 / §5.4** — Protected-target proposals are explicitly outside approval-path promotion; principal-authorized protected updates remain a separate audited path.
- **README.md, rfcs/README.md, SPEC.md, docs/faq.md, tests/conformance/README.md, validators/README.md, validators/validate.js** — Updated current-version references to v0.4.0.

### Migration

Upgrading from v0.3.0 to v0.4.0 can invalidate previously accepted Ward declarations. Before compiling or deploying v0.4.0:

1. Declare `editable.harness_blocks`.
2. Ensure every tier block is a nonempty, unique string registered in `editable.harness_blocks`.
3. Use the tier's exact gate for promotion; do not infer or alias gates.
4. Remove unknown tier fields and unknown tier tables.
5. Allow `human_veto_window_hours` only on `auto` and `familiar_review`, and only as a positive integer.
6. Validate the Ward before upgrading.

### Security rationale

Prior v0.3-style ignored, ambiguous, or stringly typed declarations could create policy drift or bypasses. v0.4.0 forces deterministic compilation and fail-closed rejection so authority is explicit and unambiguous.

---

## [0.3.0] — 2026-07-18

### Added

- **RFC-0001** — Added Property 4 provenance requirements for continuity-bearing memory entries, including standard admission path definition and audit-log dependency.
- **RFC-0001 §5.6** — Added `memory_entry_admitted` and `principal_authorized_write` audit event vocabulary for falsifiable source attestations.
- **tests/conformance/negative/10-protected-missing-ward/** — Added negative fixture for a Ward manifest omitted from `[protected].files`.

### Changed

- **RFC-0001** — Bumped draft version to v0.3.0 for new backward-compatible normative requirements.
- **RFC-0001 §4.1 / §5.4** — Strengthened Ward-manifest closure prose and Gate 1 fail-closed behavior.
- **README.md, rfcs/README.md, SPEC.md, docs/faq.md, validators/validate.js** — Updated current-version references to v0.3.0.

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
