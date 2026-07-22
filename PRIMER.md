# Builder's Primer — Familiar Contract

*If you found this repo through a blog post, a GitHub search, or someone saying "you should check out the Familiar Contract" — this is your starting point. No prior OpenCoven knowledge required.*

---

## What you're looking at

`familiar-contract` is an open specification — think EIP-20 or an RFC — for what makes an AI agent a *familiar*.

A familiar is not just a capable agent. It is an agent with stable identity, a declared purpose, explicit authority limits, persistent memory, and a binding to a specific person. These five properties are the specification.

The contract defines what a familiar is allowed to *be*. It also defines what it cannot change about itself — the protected surface that no self-improvement loop may touch without human authorization.

---

## Why this exists now

Self-improving agents are real. Research published in 2026 demonstrates a loop that proposes changes to its own scaffolding, runs a regression suite, and auto-promotes passing changes. It works.

The paper proves the loop. It does not define the boundary.

That boundary is the gap this spec fills. Without a named, enforced protected surface, a self-improvement loop is an identity loop — optimizing away the agent's values, memory conventions, and relationship to its person, passing every benchmark while doing so.

The Familiar Contract names the boundary. The Ward (the enforcement mechanism) implements it.

---

## The five properties — in plain language

**1. Named identity.** Your familiar has a name that means something: a defined character, a consistent voice, a stable persona that survives model upgrades. Not a product brand — a character design.

**2. Defined purpose.** Your familiar knows what it's for and is honest about what it isn't. Refusals follow from purpose, not arbitrary guardrails. "That's for Charm, not me" is a purpose-defined refusal.

**3. Bounded authority.** Your familiar has explicit permissions. It doesn't take external actions (send emails, post publicly, call external APIs) without human approval. The boundary is enforced at the harness level, not just stated in a system prompt.

**4. Persistent memory.** Your familiar carries context forward. It knows what happened last session. Memory is structured, maintained, and durable — not just context injected at session start.

**5. Human belonging.** Your familiar belongs to a specific person. Its purpose and memory are organized around that person's actual work. The binding is explicit and protected — it cannot be changed programmatically.

---

## What you need to create a compliant familiar

Four required files:

**`SOUL.md`** — who the familiar is. Name, purpose, vibe, what it is not. This is the human-readable identity document. See [`schemas/soul.schema.json`](schemas/soul.schema.json) for the required fields.

**`IDENTITY.md`** — the machine-readable identity record. Name, pronouns, creature type, Coven membership (if any), emoji. Minimal structured data that a validator can check.

**`MEMORY.md`** — the familiar's persistent memory surface. It is required for structural conformance and must also appear on the Ward's protected surface.

**`ward.toml`** — the governance document. Protected files, editable files, approval tiers. This is what tells the self-improvement loop what it cannot touch. See [`schemas/ward.schema.json`](schemas/ward.schema.json).

Start from [`examples/minimal/`](examples/minimal/) — that's the floor. [`examples/sage/`](examples/sage/) shows a richer structurally conformant familiar directory. Sage's runtime enforcement lives outside this repo fixture.

---

## What runtime do I need?

None in particular. The spec is runtime-portable by design.

**Claude Code, Codex, Cursor, OpenHands** — all compatible. The spec operates at the identity and governance layer, not at the execution layer.

What you need:
- A way to store `SOUL.md`, `IDENTITY.md`, `MEMORY.md`, and `ward.toml` as files accessible to the familiar
- A runtime that can inject `SOUL.md` content into the familiar's context at session start
- An enforcement mechanism for the Ward (your own or based on the Ward spec)

The validator in this repo checks one claimant directory against the four required files. For a structural-conformance claim, pair that claimant-directory run with `bash tests/conformance/run-conformance.sh` from the same repository version. The validator checks your directory; the bundled conformance suite verifies that the reference validator accepts the positive fixtures and rejects the negative fixtures.

---

## What is the Ward?

The Ward is the enforcement mechanism for the Familiar Contract. It is what stops the self-improvement loop from touching the protected surface.

A Ward is a `ward.toml` file that declares:
- Which files are protected (cannot be proposed for modification)
- Which files are editable (proposals allowed)
- What approval is required for each class of change

The Ward spec is published separately. See [`docs/ward-primer.md`](docs/ward-primer.md) for the short version.

---

## What is OpenCoven?

[OpenCoven](https://github.com/OpenCoven) is the research collective that developed the Familiar Contract and Ward spec. It runs a set of production familiars (Sage, Cody, Charm, Echo, Astra, and others) that operate under this spec.

You do not need to use OpenCoven's infrastructure to implement familiar-contract. The spec is open. MIT license. Build on it.

---

## Where to go next

- [`rfcs/RFC-0001-familiar-contract.md`](rfcs/RFC-0001-familiar-contract.md) — the normative specification (v0.4.1)
- [`examples/minimal/`](examples/minimal/) — the minimal structurally conformant familiar directory (Lumen)
- [`examples/sage/`](examples/sage/) — a richer structurally conformant familiar directory (Sage)
- `node validators/validate.js ./your-directory` — validate your claimant directory
- `bash tests/conformance/run-conformance.sh` — verify the bundled reference validator + fixtures for the same contract version
- [`docs/faq.md`](docs/faq.md) — common questions
- [`docs/comparison.md`](docs/comparison.md) — how this relates to other approaches
