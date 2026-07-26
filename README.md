# familiar-contract

> **The Familiar Contract is an open specification for what an agent is allowed to be — not just what it can do, but what it cannot change about itself.**

[![specification: v0.6.0](https://img.shields.io/badge/specification-v0.6.0-8b5cf6)](rfcs/RFC-0001-familiar-contract.md)
[![RFC-0001: Draft](https://img.shields.io/badge/RFC--0001-Draft-blue)](rfcs/RFC-0001-familiar-contract.md)
[![license: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/OpenCoven/familiar-contract)

---

## The Problem

Self-improving agents are here. A loop that proposes changes to its own scaffolding, runs a regression suite, and auto-promotes passing changes — this works today, documented in production research.

What nobody has defined yet is: **what is the agent not allowed to change about itself?**

Without a named, versioned, protected surface, a self-improvement loop is an identity loop. It will optimize away the agent's values, its memory conventions, its relationship to its person — and pass every benchmark while doing it.

The Familiar Contract is the answer. It names the protected surface. It defines what makes an agent a *familiar* — not just a capability primitive, but an identity with continuity, purpose, and a real human it belongs to.

---

## What Is a Familiar?

An **agent** executes tasks. A **familiar** has identity.

A familiar is an agent that satisfies five properties:

1. **Named identity** — a stable name, character, and voice that persist across sessions and model upgrades
2. **Defined purpose** — a declared scope, honest about what it is not for
3. **Bounded authority** — explicit permissions, enforced at the harness level
4. **Persistent memory** — continuity across sessions, not just a context window
5. **Human belonging** — bound to a specific person, with that binding protected from drift

These are not soft design preferences. Each one has architectural implications, and each is required for compliance.

---

## How to Use This Spec

**If you're building a familiar:**
1. Read [`rfcs/RFC-0001-familiar-contract.md`](rfcs/RFC-0001-familiar-contract.md) — the normative spec (v0.6.0)
2. Copy an example from [`examples/`](examples/) — `minimal/` for the floor, `sage/` for a richer structurally conformant familiar directory
3. Create `SOUL.md`, `IDENTITY.md`, `MEMORY.md`, and `ward.toml` for your familiar
4. Run `npm install` to install the reference validator's TOML parser and JSON Schema validator.
5. For a v0.6.0 structural-conformance claim, run both `node validators/validate.js ./your-directory` and `npm test`

**If you're evaluating a familiar:**
- Five properties. All five. Fewer than five is an agent, not a familiar.
- Protected surface: can the familiar modify its own `SOUL.md` without human authorization? If yes, it's not compliant.

**If you're building a runtime:**
- The spec is runtime-portable by design. See [`PRIMER.md`](PRIMER.md) for the implementation contract.
- Works with: Claude Code, Codex, Cursor, OpenHands, any compliant harness. Not tied to any specific runtime.

---

## Quick Start

```bash
# Install the reference validator dependencies
npm install

# Validate the claimant directory for your v0.6.0 claim
node validators/validate.js ./your-directory

# Verify the bundled reference validator + fixtures for the same v0.6.0 claim
npm test
```

The validator checks one claimant directory for the required files and structure: `SOUL.md`, `IDENTITY.md`, `MEMORY.md`, and `ward.toml`. The conformance suite verifies that the bundled reference validator accepts the positive fixtures and rejects the negative fixtures. A structural-conformance claim is reproducible only when both commands pass for the same contract version.

Examples:

```bash
# Validate the canonical Sage example as a claimant directory
node validators/validate.js examples/sage

# Validate the minimal Lumen example as a claimant directory
node validators/validate.js examples/minimal
```

See [`validators/README.md`](validators/README.md) for full CLI docs.

---

## Repository Contents

```
rfcs/RFC-0001-familiar-contract.md ← The Familiar Contract (normative, v0.6.0)
README.md                ← This file
PRIMER.md                ← Builder's guide (for new readers)
CHANGELOG.md             ← Version history
schemas/
  soul.schema.json       ← JSON Schema for SOUL.md
  identity.schema.json   ← JSON Schema for IDENTITY.md
  ward.schema.json       ← JSON Schema for ward.toml
  role.schema.json       ← JSON Schema for ROLE.md
examples/
  sage/                  ← Sage (canonical structurally conformant familiar directory)
  minimal/               ← Lumen (minimal structurally conformant familiar directory)
validators/
  validate.js            ← CLI validator
  README.md
docs/
  faq.md                 ← Common questions (canonical FAQ)
  five-properties.md     ← The five properties in depth
  why-identity-not-skills.md
  ward-primer.md
  comparison.md          ← How this relates to ECC, Multica, others
SPEC.md                 ← Historical / superseded predecessor specification
.github/
  CONTRIBUTING.md
```

---

## Background

The Familiar Contract was developed by [OpenCoven](https://github.com/OpenCoven) — a research collective building the identity and governance layer for autonomous agents. The concept was first articulated in the [Grimoire article "The Familiar Contract"](https://coven-grimoire.vercel.app/grimoire/the-familiar-contract) (May 2026).

The Ward Specification — the enforcement mechanism that makes familiar-contract runtime-real — is maintained as a companion spec.

---

## License

MIT. Build on this. Extend it. The spec's value grows with adoption.

If you implement familiar-contract compliance in a runtime or toolchain, open an issue — we want to know about it.
