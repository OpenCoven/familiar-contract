# Changelog

All notable changes to this specification are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project uses [Semantic Versioning](https://semver.org/).

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
