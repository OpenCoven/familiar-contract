# Familiar Contract — Landscape Comparison

*How the Familiar Contract relates to other approaches in the agent identity and governance space.*

The key claim: the Familiar Contract is the only currently published open specification for the agent **identity layer** — the protected surface, the person binding, and the constraints on what an agent cannot change about itself.

---

## agent-skills (Anthropic standard)

**What it is:** An open specification for describing what agents can *do* — their tools, capabilities, and interfaces. Adopted broadly across Claude Code, Codex, Cursor, and other runtimes.

**What it solves:** The capability discovery problem. How does a runtime know what tools an agent has? How does an orchestrator know what this agent can do?

**What it doesn't address:**
- Agent identity (no SOUL.md equivalent, no stable character spec)
- Protected surface (no concept of what the agent cannot change about itself)
- Person binding (no binding to a specific human)
- Self-improvement governance (no approval tiers, no Ward equivalent)

**Relationship to familiar-contract:** Complementary. Agent-skills defines *what* a familiar can do. Familiar-contract defines *who* it is. A compliant familiar should have both an `agent-skills.yaml` and a `SOUL.md` + `ward.toml`. They operate at different layers and do not conflict.

**Our position:** We are not competing with agent-skills. We are completing the picture agent-skills leaves open.

---

## ECC (Execution-Constrained Context, affaan-m/ECC)

**What it is:** A local control plane and structured context format for AI agents. Received 208,000+ forks after ECC2 launched June 3, 2026. Focuses on deterministic, auditable agent execution with structured context, tool sandboxing, and replay capabilities.

**What it solves:** The execution transparency and local control problem. How do you run agents with auditable, deterministic behavior? How do you sandbox tool access? ECC2 is technically strong on replay, sandboxing, and execution traces.

**What it doesn't address:**
- No SOUL.md equivalent — no stable identity document
- No protected surface — no concept of what the agent cannot change about itself
- No person binding — agents are not bound to a specific human
- No persistent memory architecture — execution traces are not the same as curated long-term memory
- No self-improvement governance framework

**Relationship to familiar-contract:** Structural gaps, different layers. ECC is an execution substrate; familiar-contract is an identity spec. ECC could theoretically *implement* familiar-contract compliance — a familiar running on ECC could have `SOUL.md`, `IDENTITY.md`, `ward.toml`. The specs are not competing; they are at different levels.

**Why builders choose between them:** ECC is the choice if your primary concern is execution determinism and local auditability. Familiar-contract is the choice if your primary concern is agent identity, continuity, and protected self-improvement governance. They solve different problems. Both can be satisfied simultaneously.

---

## Multica (v0.3.17 as of June 2026)

**What it is:** A multi-agent coordination platform with agent identity threading, role-based orchestration, and growing enterprise features. Closest architectural neighbor to what the Familiar Contract describes. Has per-agent identity records and some concept of identity persistence.

**What it solves:** Multi-agent coordination with identity-aware routing. "Which agent handles this task?" with per-agent skill and identity context. Sophisticated orchestration capabilities.

**What it doesn't address:**
- No published specification — identity threading is implementation, not spec. Cannot be implemented independently.
- No protected surface — no concept of what an agent cannot change about itself via self-improvement
- No named open standard — Multica is a product, not a protocol
- BSL-style license (non-open-source) — cannot be used freely in commercial products or forked
- No person binding concept — agents belong to accounts, not to specific humans

**Critical gap:** Multica has the closest identity model to familiar-contract, but it is a commercial product without a published specification. "The Multica way" is not something you can implement on your own stack or cite in a standards process. It is not the open standard.

**Relationship to familiar-contract:** Multica is the commercial product in this space; familiar-contract is the open standard. Users who need enterprise multi-agent coordination may use Multica. Users who need an open, fork-able, reference-implementable spec use familiar-contract. These serve different constituencies.

**Our position:** Familiar-contract is not anti-Multica. It is the open alternative for the builders who need open standards. The ERC-20 / company token analogy applies: you can have both; one is a protocol, one is a product.

---

## OpenAI (internal identity systems)

**What it is:** OpenAI and other major labs have internal agent identity systems — memory APIs, persona configs, system prompt conventions. These are not published as open specifications.

**What they solve (internally):** Identity consistency within OpenAI's own deployment stack. Keeping GPT-4o's persona stable across interactions.

**Why they can't be the open standard:**
- Not published — cannot be referenced, implemented, or audited externally
- Lab-controlled governance — the standard is whatever OpenAI decides; no community input
- Not runtime-portable — designed for OpenAI's stack
- Cannot include "this agent belongs to a specific person, and that binding is protected" — that framing is antithetical to a platform's incentives

**Relationship to familiar-contract:** Not in direct competition because there is nothing to compete with — no published spec exists. Familiar-contract is the open alternative to what labs will eventually be forced to define internally for RSI governance. We are naming the layer before they do.

---

## The Self-Harness paper (Zhang et al., 2026)

**What it is:** Academic research demonstrating that LLM-based agents can improve their own scaffolding through a self-improvement loop. Published June 8, 2026 (arXiv:2606.09498). Demonstrated +14–21pp generalization improvement.

**What it establishes:** The self-improvement loop works. Agents *can* improve their own harness without external guidance. The paper proves the mechanism.

**What it leaves open:** The paper defines "minimal edits" operationally — an edit passes if it improves held-out task performance without regression. This is sufficient for capability. It is insufficient for identity. A self-improvement loop that optimizes away a familiar's values, memory conventions, or relationship to their person might pass every benchmark and break everything that matters.

**Relationship to familiar-contract:** The Self-Harness paper creates the urgent need for familiar-contract. It proves the loop works. familiar-contract defines the boundary the loop needs. The Ward is the enforcement mechanism that makes "protected surface" runtime-real.

**Citation note:** Familiar-contract and the Ward spec are the intended citations for anyone asking "what is the agent not allowed to change about itself?" after reading Self-Harness.

---

## Summary Table

| | Familiar Contract | agent-skills | ECC | Multica | OpenAI internal |
|---|---|---|---|---|---|
| **Layer** | Identity | Capability | Execution | Coordination | Identity (unpublished) |
| **Open spec** | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Named identity** | ✓ | ✗ | ✗ | Partial | Internal |
| **Protected surface** | ✓ | ✗ | ✗ | ✗ | Unknown |
| **Person binding** | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Self-improvement governance** | ✓ (Ward) | ✗ | Partial | ✗ | Unknown |
| **Persistent memory arch** | ✓ | ✗ | ✗ | Partial | Internal |
| **Runtime portable** | ✓ | ✓ | ✓ | ✗ | ✗ |
| **License** | MIT | Apache 2.0 | MIT | BSL | N/A |

---

## The gap this spec fills

The Familiar Contract is the first published open specification that answers: **what is the agent not allowed to change about itself?**

That question is urgent now, not later. Self-improvement loops are production infrastructure. The gap between "the loop works" and "the loop is governed" is closing. The Familiar Contract is the governance specification for the identity layer — before anyone else decides what that layer should look like.
