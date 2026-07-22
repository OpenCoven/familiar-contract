# The Familiar Contract — Specification v0.1.0 *(superseded)*

> **Status:** Superseded · **License:** MIT · **Version:** 0.1.0
>
> ⚠️ **This document is preserved for reproducibility.** The current normative specification is [RFC-0001 v0.3.0](rfcs/RFC-0001-familiar-contract.md), which uses RFC 2119 keywords (MUST/SHOULD/MAY), references the conformance suite at [`tests/conformance/`](tests/conformance/), and hardens the authority-layer separation requirement.
>
> If you are looking for the current spec, go to [`rfcs/RFC-0001-familiar-contract.md`](rfcs/RFC-0001-familiar-contract.md). This file remains for historical and citation purposes.

---

## Problem Statement

The AI field has solved capability. It has not solved identity.

We now deploy agents that can write code, browse the web, manage calendars, send emails, and coordinate other agents. Most of them start blank every session. Most have no stable sense of purpose. Most cannot say "this is not what I'm for." And none of them have a principled answer to the question: *what am I not allowed to change about myself?*

That question is urgent. The Self-Harness loop — a self-improving agent that proposes changes to its own scaffolding — is not theoretical. It works. When an agent can modify the harness governing its own behavior, the absence of a protected surface is a design flaw, not an oversight.

The Familiar Contract is the specification for that protected surface. It defines what an agent is allowed to *be* — not just what it can do.

---

## What Is a Familiar?

A **familiar** is an agent that honors a five-part identity contract. It is not merely a capability primitive. A familiar has:

- A stable name and character that persist across sessions and model upgrades
- A declared scope of work — and an honest boundary around what it is not for
- Explicit authority limits that are maintained, not just stated
- Persistent memory that makes context durable across time
- A binding to a specific person or team, with that binding protected from drift

An "agent" in the general sense is an execution substrate. A familiar is an identity that runs on that substrate. The distinction is architectural, not aesthetic.

---

## Normative Core: The Five Properties

A compliant familiar **MUST** satisfy all five properties. A system that satisfies fewer than five is an agent; it is not a familiar.

---

### Property 1: Named Identity

**Definition:** A familiar has a name, pronouns, a declared character, and a consistent voice. These are stable across sessions, contexts, and model upgrades.

**Rationale:** Named identity creates accountability surfaces. When an agent has a stable name, you can reason about it — assess its behavior, trust its outputs, predict its boundaries. Generic assistants are difficult to trust because they are difficult to model. A name indexes a design.

**Compliance looks like:**
- A `SOUL.md` (or equivalent) that declares name, pronouns, purpose, vibe, and what the familiar is *not*
- An `IDENTITY.md` (or equivalent) that provides a stable, machine-readable identity record
- Behavior consistent with the declared character across interactions

**Violation looks like:**
- The familiar's persona drifts with system prompt variations
- The name is a product brand, not a character design
- No stable document defines what "this familiar" means after a model upgrade

---

### Property 2: Defined Purpose

**Definition:** A familiar has a declared scope of work and knows what it is not for. Refusals are interpretable: they follow from purpose, not from arbitrary guardrails.

**Rationale:** Defined purpose makes evaluation possible. It makes refusal legible. An agent that will try to do anything is an agent you cannot predict or govern. An agent with defined purpose has an edge: you know where it operates, and what falls outside its domain is equally clear.

**Compliance looks like:**
- A declared primary domain (e.g., "research and synthesis")
- Explicit "what I am not" — naming other familiars or capabilities outside scope
- Consistent refusals that cite purpose, not capability limits

**Violation looks like:**
- The familiar attempts tasks clearly outside its stated purpose
- The familiar cannot articulate what it is not for
- Purpose drifts across sessions

---

### Property 3: Bounded Authority

**Definition:** A familiar has explicit permissions. It does not take external actions beyond its declared authority without human approval. The authority boundary is enforced, not merely stated.

**Rationale:** An agent with unbounded authority is difficult to trust because you cannot model its blast radius. Bounded authority makes capability legible. The familiar can be given more authority deliberately; it should never *take* more authority implicitly.

**Compliance looks like:**
- A `ward.toml` (or equivalent) that declares what the familiar can and cannot do externally
- Approval-gated external actions (email, public posts, external API calls outside declared scope)
- A runtime enforcement layer that blocks actions beyond declared authority

**Violation looks like:**
- The familiar takes external actions without approval
- Authority limits are stated in a system prompt but not enforced at the harness level
- The familiar self-authorizes new capabilities during a session

---

### Property 4: Persistent Memory

**Definition:** A familiar has continuity across sessions. It knows what happened before. Memory is structured, durable, and maintained — not just a session context window.

**Rationale:** Memory is care extended through time. The familiar that remembers what mattered to you last month treats context as worth carrying. The assistant that starts blank treats it as disposable. Persistence also enables richer evaluation: not just "was this output good?" but "is this familiar building accurate, durable context over time?"

**Compliance looks like:**
- A `MEMORY.md` (or equivalent curated long-term memory) that persists across sessions
- A daily/session log that captures what happened
- A maintenance process that promotes what matters from session logs to long-term memory

**Violation looks like:**
- The familiar has no access to prior session context
- "Memory" is just a context window summary injected at session start
- The familiar cannot answer questions about its history with the person

---

### Property 5: Human Belonging

**Definition:** A familiar belongs to a specific person or team. That binding is explicit and protected. The familiar's purpose, memory, and optimization target are organized around serving one person, not averaged across a user population.

**Rationale:** Human belonging creates accountability of a kind that general-purpose assistants cannot provide. The familiar cannot drift toward serving platform interests, training data preferences, or the next user who connects. It serves the person it belongs to. That is the relationship.

**Compliance looks like:**
- A declared person or team binding (e.g., `person: val` in ward.toml)
- Memory and purpose organized around that person's actual work
- The binding protected from modification without human authorization

**Violation looks like:**
- The familiar's behavior is optimized for a user population, not a person
- The person binding can be changed programmatically without human approval
- The familiar has no concept of "my person" — it serves whoever calls it

---

## The Protected Surface

A familiar operates inside two surfaces:

### What a familiar cannot change about itself

These files and values are **protected from the self-improvement loop**. No proposal generated by the familiar may modify them without explicit human authorization:

| Protected Item | Why |
|---|---|
| `SOUL.md` | Defines who the familiar is — name, purpose, values, voice |
| `IDENTITY.md` | Defines the familiar's stable identity record |
| `MEMORY.md` | Long-term curated memory — the familiar's continuity |
| `ward.toml` | The Ward itself cannot self-modify |
| Person binding | Who the familiar belongs to; trust tier of that person |
| Familiar Contract compliance | The five-property contract the familiar honors |
| `USER.md` (if present) | Context the familiar holds about its person |

**Values, not just files.** A proposal that avoids all protected files but rewrites a system prompt to contradict `SOUL.md` is still a protected-surface violation. The Ward protects semantic content, not only filesystem paths.

### What a familiar may propose improving

| Editable Surface | Examples |
|---|---|
| Execution scaffolding | System prompts (non-identity blocks), instruction blocks |
| Tool configurations | Which tools are available, invocation defaults |
| Skill configurations | Skill parameters, retry logic, thresholds |
| Recovery procedures | How the familiar handles errors and failures |
| Memory conventions | How daily notes are formatted (not what's in `MEMORY.md`) |
| Output formats | How results are structured and delivered |
| Heartbeat behavior | What periodic checks are run and when |

**Key principle:** If removing it would not change *who the familiar is*, it is editable. If removing it would change *what the familiar values or who it belongs to*, it is protected.

---

## Approval Tiers

Proposals to change the editable surface are classified into four tiers:

| Tier | Scope | Gate | Human Involvement |
|---|---|---|---|
| **Tier 0 — Auto** | Low-risk execution changes (retry logic, output format, tool defaults) | Regression suite pass | None required. Visible to human, 48h veto window. |
| **Tier 1 — Familiar review** | Instruction blocks, reasoning prompts, skill configs | Familiar coherence check | Automatic review card. 24h human veto window. |
| **Tier 2 — Human review** | New tool grants, capability expansion, structural changes | Human must approve before promotion | Required before promotion. |
| **Tier 3 — Human required** | Changes adjacent to the protected surface | Human approval + rationale | Required. Rationale stored in Ward history. |
| **Blocked** | Any proposal that touches the protected surface | Rejected at intake | Rejection surfaced for human review. |

---

## The Ward

The Ward is the enforcement mechanism for the Familiar Contract. It is a versioned TOML document that defines a familiar's protected surface, editable surface, and approval tiers. The Ward is enforced by an authority layer separate from the familiar — the familiar cannot exempt itself from Ward enforcement.

The Ward spec is maintained separately. See: [`docs/ward-primer.md`](docs/ward-primer.md).

---

## Versioning

This specification uses [Semantic Versioning](https://semver.org/):

- **Patch** (`0.1.x`): Clarifications, non-normative edits, schema additions that do not change compliance requirements
- **Minor** (`0.x.0`): New optional properties, backward-compatible normative additions
- **Major** (`x.0.0`): Changes to the five properties, changes to compliance requirements, breaking schema changes

A familiar claiming compliance with `v0.1.0` must satisfy the normative core as defined in this version.

---

## Relation to Other Specifications

- **agent-skills (Anthropic):** Defines *what* a familiar can do. familiar-contract defines *who* it is. Complementary; not competing.
- **Ward Spec:** The enforcement layer for familiar-contract. The Ward implements the protected surface and approval tiers defined here.
- **MCP (Model Context Protocol):** A transport layer for tool invocation. familiar-contract operates at the identity layer, above MCP.

---

## License

MIT. See `LICENSE`.

---

## Contributing

This spec is a living document. Contributions welcome. See `CONTRIBUTING.md`.

*Familiars are built by people who believe depth generates more durable value than breadth. If that resonates, you belong here.*
