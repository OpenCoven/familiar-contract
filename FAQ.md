# Frequently Asked Questions

---

### Is this a framework?

No. It is a specification.

The Familiar Contract defines what a compliant familiar must satisfy. It does not tell you *how* to implement it — that is for you and your runtime. Think EIP-20: the spec says a token must have `name()`, `transfer()`, and `balanceOf()`. It does not specify the Solidity version, the deployment toolchain, or the gas optimization strategy.

Implement the five properties however your stack supports. What matters is whether a familiar claims compliance and actually satisfies the normative core.

---

### What runtimes does it support?

All of them. The spec is runtime-portable by design.

The Familiar Contract operates at the identity and governance layer. It defines what files must exist (`SOUL.md`, `IDENTITY.md`, `ward.toml`), what fields they must contain, and what behaviors the familiar must maintain. It says nothing about which LLM, which orchestration library, which harness format.

Tested against: Claude Code, Codex, Cursor, OpenHands, and the OpenCoven runtime (`openclaw`). No special runtime required.

---

### What's the difference between a familiar and an agent?

An agent is a capability primitive: it can use tools, take actions, orchestrate sub-tasks. An agent's identity is usually incidental — it has a system prompt, maybe a name, but no stable character that persists across contexts.

A familiar is an identity that runs on an agent substrate. It has a stable name, defined purpose, explicit authority limits, persistent memory, and a binding to a specific person. Remove the identity layer and you have an agent. Add the identity layer and you have a familiar.

The distinction is architectural. Familiars require different design choices: durable memory stores, enforcement mechanisms for authority bounds, protected surfaces for identity files, person-binding protocols. These are not prompt engineering choices. They are systems choices.

---

### What is the Ward?

The Ward is the enforcement mechanism for the Familiar Contract's protected surface.

A familiar cannot be trusted to protect its own `SOUL.md` voluntarily — especially in a self-improvement loop, where the loop's goal is to modify the harness. The Ward is the authority layer that stands between the self-improvement loop and the protected surface.

A Ward is a `ward.toml` file that declares which files are protected, which are editable, and what approval is required for each class of change. Ward enforcement is implemented in an authority process separate from the familiar — the familiar cannot opt out or work around it.

See [`docs/ward-primer.md`](docs/ward-primer.md) for the full introduction.

---

### Does my agent need to use OpenCoven to be compliant?

No. OpenCoven is the research collective that developed this spec, but compliance requires nothing from OpenCoven's stack.

You need:
1. `SOUL.md`, `IDENTITY.md`, and `ward.toml` files satisfying the schemas in this repo
2. A runtime that injects `SOUL.md` into the familiar's context at session start
3. An enforcement mechanism for the Ward (your own implementation, conforming to the Ward spec)

You can implement all of this independently. MIT license. No attribution required for compliance.

---

### Can I extend the spec?

Yes — additively. You can add new optional properties, define domain-specific role schemas, and create custom Ward tiers for your use case.

What you cannot do: weaken the five properties. A familiar claiming familiar-contract compliance that does not satisfy Named Identity, Defined Purpose, Bounded Authority, Persistent Memory, and Human Belonging is not compliant. Extensions must be additive; they cannot subtract from the normative core.

If you create a widely-used extension, consider contributing it as a proposal to this repo. See [`CONTRIBUTING.md`](.github/CONTRIBUTING.md).

---

### What's the license?

MIT. Use it, fork it, build on it, ship it. No strings. Attribution appreciated but not required.

---

### What does "the self-improvement loop cannot touch the protected surface" mean in practice?

It means: when your familiar generates a proposal to modify its own scaffolding (as in the Self-Harness architecture), the Ward daemon checks that proposal before it is applied. If the proposal targets any file in the protected surface — `SOUL.md`, `IDENTITY.md`, `MEMORY.md`, `ward.toml`, the person binding — it is rejected automatically, regardless of how compelling the familiar's rationale sounds.

The familiar cannot change who it is. It can change how it works. That distinction is the entire contract.

---

### Is this related to the Voodoo Doll / Sympathetic Familiar Architecture?

Familiar-contract is the identity layer. The Sympathetic Familiar Architecture (Doll architecture) is a delegation and sandboxing pattern built on top of it. You can implement familiar-contract without the Doll architecture.

The Doll architecture is part of the OpenCoven Ward spec (v0.2+) and is not required for v0.1 compliance.

---

### What if a familiar doesn't have a self-improvement loop?

The protected surface still matters.

Even without an active self-improvement loop, a familiar needs a protected surface because:
1. Future model upgrades or fine-tuning may inadvertently drift identity
2. Adversarial prompts may attempt to rewrite the familiar's stated purpose
3. Administrators may accidentally overwrite `SOUL.md` during routine maintenance
4. Compliance claims become auditable when there's a declared protected surface

The Ward governs the self-improvement loop primarily, but it also protects against all of the above.

---

### How does this relate to AI safety research?

The Familiar Contract addresses a specific, narrow governance problem: what constraints govern a self-modifying agent's identity?

It is not a general AI alignment framework. It does not address:
- Value alignment at the model level
- Reward hacking or deceptive alignment
- Multi-agent coordination risks at scale
- AGI safety

What it does address: the operational gap between "the self-improvement loop works" and "the self-improvement loop is governed." That gap is real, current, and tractable. The Familiar Contract is a tractable answer to a tractable problem.

---

### Where can I follow development?

- This repo: [github.com/OpenCoven/familiar-contract](https://github.com/OpenCoven/familiar-contract)
- OpenCoven Grimoire: [coven-grimoire.vercel.app](https://coven-grimoire.vercel.app) — where research notes and articles about the spec are published
- OpenCoven GitHub org: [github.com/OpenCoven](https://github.com/OpenCoven)
