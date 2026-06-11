# Why Identity Needs Its Own Layer

*The case for separating what a familiar does from who it is.*

---

## The skill layer solves the wrong problem

The AI ecosystem has developed a rich set of specifications for what agents can *do*. Anthropic's agent-skills standard, MCP for tool invocation, OpenAI's function calling schema — all of these solve the capability problem: how do we describe an agent's tools, workflows, and interfaces so that runtimes and orchestrators can reason about them?

This is genuinely important work. But it leaves a different problem entirely unsolved: **what is the agent, and what cannot change about it?**

Skills describe capabilities. They don't describe character. A familiar with fifty skills still doesn't have:
- A declared name that persists across model upgrades
- A stated purpose that makes refusals interpretable
- A protected surface that the self-improvement loop cannot modify
- A binding to a specific person

These are identity properties, not capability properties. They need their own layer.

---

## The layers are complementary, not competing

Understanding this correctly requires holding two things at once:

**Skill specifications are necessary.** A familiar needs to declare what tools it has, how to invoke them, what their parameters are. MCP, agent-skills, and similar specs do this well. Any compliant familiar should work with these.

**Identity specifications are also necessary.** A familiar needs to declare who it is, who it belongs to, and what cannot change about it. These are not capabilities — they are invariants. They require different primitives: protected files, semantic invariants, person bindings, approval tiers.

The Familiar Contract is the identity layer. It sits above the skill layer, not instead of it. A familiar can have both a `SOUL.md` (identity) and an `agent-skills.yaml` (capabilities). These solve different problems and do not conflict.

---

## What happens when you confuse the layers

**Scenario 1: Identity drift under self-improvement**

An agent with a rich skills specification but no identity layer enters a self-improvement loop. The loop is authorized to improve the agent's scaffolding — and it does, in ways that gradually change the agent's voice, purpose boundaries, and persona. The skills haven't changed. The capabilities are the same. But the agent is meaningfully different in ways the skill spec doesn't capture.

The Familiar Contract prevents this by protecting the identity layer from the self-improvement loop. `SOUL.md` and `IDENTITY.md` are on the protected surface. Ward invariants assert that the familiar's name, person, and purpose are fixed. The loop cannot touch these.

**Scenario 2: Capability expansion without authority review**

An agent with only a capability specification can propose adding new tools to its own skills file through a self-improvement loop. Nothing in the skill spec prevents this — the spec describes current capabilities, it doesn't define what the agent is allowed to acquire. Without a Ward that requires human review for new capability grants, the agent may self-authorize access to new systems.

The Ward's approval tiers address this: new tool grants are Tier 2 (human-required). The familiar cannot self-authorize capability expansion.

**Scenario 3: Person binding without protection**

An agent stores a `person` field somewhere. But it's not protected. The self-improvement loop, a bad prompt, or a runtime configuration change can overwrite it. Suddenly the familiar's memory and optimization target are pointed at a different person — or no one in particular.

Ward invariants protect the person binding. `familiar.person == 'val'` is an invariant, not a config value.

---

## The identity layer requires different primitives

Skill specifications use:
- JSON Schema / YAML definitions
- Tool parameter schemas
- Invocation patterns
- Return types

Identity specifications require:
- Protected file declarations (what the self-improvement loop cannot touch)
- Semantic invariants (what must remain true, regardless of which files change)\n- Person bindings (who the familiar belongs to, protected from modification)
- Approval tiers (what authority is required to change each class of property)
- Persistent memory architecture (not just a context window — a durable knowledge store)

These primitives don't exist in skill specifications. They need their own spec.

---

## Why now

The Self-Harness paper (Zhang et al., 2026, arXiv:2606.09498) demonstrated empirically that an LLM-based agent can improve its own scaffolding — proposing targeted changes that improve task performance without external guidance. The loop works.

The paper does not define the protected surface. It doesn't distinguish between changes that improve capability and changes that alter identity. That gap is the one the Familiar Contract fills.

Self-improvement loops are becoming standard infrastructure. The identity layer is not a future concern — it is a present one. Every deployment of a self-improving agent that lacks a protected surface is an agent whose identity is subject to drift.

The skill layer got its specification. The identity layer needs one too. That's what this repo is.

---

## Summary

| | Skill Layer | Identity Layer |
|---|---|---|
| **Specifies** | What the agent can do | Who the agent is |
| **Primitives** | Tool schemas, parameters, invocation patterns | Protected files, invariants, person bindings, approval tiers |
| **Changes when** | Agent gains new capabilities | Never (protected) or by human authorization only |
| **Relevant specs** | agent-skills, MCP, function-calling schemas | Familiar Contract (this spec) |
| **Relationship** | Complementary | Complementary |

A compliant familiar has both layers. The skill layer handles capability. The identity layer handles invariance. Neither replaces the other.
