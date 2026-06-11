# familiar-contract

> **The Familiar Contract is an open specification for what an agent is allowed to be — not just what it can do, but what it cannot change about itself.**

[![specification: v0.1.0](https://img.shields.io/badge/specification-v0.1.0-8b5cf6)](SPEC.md)
[![license: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

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
1. Read [`SPEC.md`](SPEC.md) — the normative core
2. Copy an example from [`examples/`](examples/) — `minimal/` for the floor, `sage/` for a full compliant familiar
3. Create `SOUL.md`, `IDENTITY.md`, and `ward.toml` for your familiar
4. Validate with the CLI: `node validators/validate.js ./your-familiar-directory`

**If you're evaluating a familiar:**
- Five properties. All five. Fewer than five is an agent, not a familiar.
- Protected surface: can the familiar modify its own `SOUL.md` without human authorization? If yes, it's not compliant.

**If you're building a runtime:**
- The spec is runtime-portable by design. See [`PRIMER.md`](PRIMER.md) for the implementation contract.
- Works with: Claude Code, Codex, Cursor, OpenHands, any compliant harness. Not tied to any specific runtime.

---

## Quick Start

```bash
# Validate a familiar directory
node validators/validate.js examples/sage

# Validate the minimal example
node validators/validate.js examples/minimal
```

See [`validators/README.md`](validators/README.md) for full CLI docs.

---

## Repository Contents

```
SPEC.md                  ← The Familiar Contract (normative)
README.md                ← This file
PRIMER.md                ← Builder's guide (for new readers)
FAQ.md                   ← Common questions
CHANGELOG.md             ← Version history
schemas/
  soul.schema.json       ← JSON Schema for SOUL.md
  identity.schema.json   ← JSON Schema for IDENTITY.md
  ward.schema.json       ← JSON Schema for ward.toml
  role.schema.json       ← JSON Schema for ROLE.md
examples/
  sage/                  ← Sage (canonical compliant familiar)
  minimal/               ← Lumen (minimal compliant familiar)
validators/
  validate.js            ← CLI validator
  README.md
docs/
  five-properties.md     ← The five properties in depth
  why-identity-not-skills.md
  ward-primer.md
  comparison.md          ← How this relates to ECC, Multica, others
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
