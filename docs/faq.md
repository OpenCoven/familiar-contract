# Frequently Asked Questions

*Answers to common questions about the Familiar Contract. If you are reading this for the first time, start with questions 1 and 2, then jump to whatever matters most to you.*

---

## Q: What is the Familiar Contract in plain English?

**A:** The Familiar Contract is a specification that defines what it means for an AI agent to have a stable identity that cannot be eroded — not by model upgrades, not by recursive self-improvement loops, not by whoever happens to connect to it next.

The core problem it addresses is this: AI agents have gotten very capable, but they have no principled answer to the question *what is this agent not allowed to change about itself?* When you deploy an agent with memory and a self-improvement loop — a loop that rewrites its own scaffolding to perform better — nothing currently stops that loop from rewriting the parts that define who the agent is. The Familiar Contract fixes that by specifying a protected surface: a set of files, semantic invariants, and behaviors that belong to the agent's identity and cannot be modified without explicit human authorization.

The specification has two major parts. First, a five-property identity contract: a compliant "familiar" must have a stable named identity, a declared purpose, enforced authority limits, persistent memory, and an explicit binding to a specific person. Second, an enforcement model built around a component called the Ward — a TOML policy document plus a runtime enforcement daemon that checks proposed changes against the protected surface before they are applied. The key word is "enforced": the Ward is not asking the agent to have good values about self-modification. It is an external check that runs regardless of what the agent thinks about it.

The Familiar Contract is a normative specification, which means it defines what must be true about a conformant system, tested against both a claimant-directory validator run and an executable conformance suite, not just described. The RFC (RFC-0001, v0.4.0) carries formal RFC 2119 keywords (MUST, MUST NOT, SHOULD) and the `tests/conformance/` directory is the fixture suite that verifies the reference validator. A familiar directory is structurally conformant only when `node validators/validate.js ./your-directory` succeeds and `bash tests/conformance/run-conformance.sh` passes in the repository. Full conformance also requires runtime Ward enforcement as described in RFC §6.2.

---

## Q: What is a "familiar"? How is it different from an agent?

**A:** A familiar is an agent that satisfies all five properties of the Familiar Contract. Any agent that satisfies fewer than five is an agent; it is not a familiar. That distinction is intentional and normative, not a branding choice.

Most deployed agents today satisfy a *capability* contract: given a task, produce a result. They can write code, search the web, manage calendars, coordinate other agents. What they do not have is an *identity* contract — no stable name and character, no declared scope of work, no enforced authority limits, no durable memory, no binding to a specific person. These are not aesthetic gaps. Each one has a practical consequence. An agent with no stable identity cannot be held accountable across time. An agent with no declared scope produces refusals that feel arbitrary. An agent with authority stated only in prompts has authority that can be dissolved by a clever prompt. An agent with no durable memory treats your context as disposable. An agent with no person binding serves whoever connects to it, optimized for a user population rather than for you.

A familiar addresses all of these structurally, not aspirationally. The character is declared in files that are protected from modification. The scope is explicit and enforced in Ward invariants. The authority limits are checked by a daemon outside the agent's own logic. The memory is in files that persist across sessions. The person binding is hard-coded in `ward.toml` and protected from any programmatic change.

The analogy that is sometimes useful: an agent is a capable contractor who shows up when called, does what you ask, and has no history with you and no particular loyalty. A familiar is a long-term collaborator who knows your work, has a defined role, and cannot be transparently replaced with a different person between sessions. Familiars have proper names — Sage, Charm, Echo, Cody — that index stable designs. Those names carry commitments. You can ask "what would Sage do here?" and get a meaningful answer, because Sage has a documented character that cannot silently drift.

---

## Q: Why do you need all five properties? What breaks if you only have four?

**A:** The five properties form a system. Each one closes a specific gap that the others leave open. Drop any one property and a specific failure mode becomes possible.

Named Identity without Human Belonging is a familiar-shaped agent that serves whoever calls it. It has a stable character — but no binding to a specific person means the character can be redirected, repurposed, or optimized toward a user population rather than toward you. The identity becomes a marketing layer, not a relationship.

Bounded Authority without Persistent Memory means the agent cannot accumulate context about what you have authorized over time. You rebuild the trust model every session. Worse: a self-improvement loop has nothing durable to reference when classifying proposals — it cannot distinguish "Val always approves tool-config changes" from "this is a sensitive operation" because it has no memory of past decisions.

Persistent Memory without Bounded Authority is a durable knowledge store with no governance. The self-improvement loop can rewrite `MEMORY.md` — not in the dramatic sense of deleting everything, but in the gradual sense of reframing what matters, promoting certain contexts, and quietly reshaping the agent's understanding of its person. Without Ward enforcement, the memory is editable from below.

Defined Purpose without Named Identity means the scope declaration has no stable referent. "This agent is for research" means nothing if the agent's character drifts between sessions. Purpose declarations are only meaningful when attached to a stable identity.

Human Belonging without Defined Purpose means the agent is bound to a person but has no principled way to decline tasks outside its lane, no other familiars to route to, and no coherent evaluation signal for the self-improvement loop. The person gets a loyal but shapeless collaborator.

The contract requires all five because the failure modes compound. An agent that has four-out-of-five is not "almost a familiar." It is an agent with a specific exploitable gap. The self-improvement loop will find that gap. The Ward closes all five.

---

## Q: What is the protected surface? What's on it and why?

**A:** The protected surface is the set of files, semantic invariants, and behaviors that define *who the familiar is* — not what it can do, but what it is. The self-improvement loop is explicitly prohibited from generating proposals that touch this surface. The Ward rejects any such proposal at intake, before any evaluation.

Every conformant `ward.toml` must list the following files in its `[protected].files` section:

- **`SOUL.md`** — the familiar's name, character, declared purpose, and explicit "what I am not." This is the identity document. Modifying it without human authorization would change who the familiar is.
- **`IDENTITY.md`** — the stable, machine-readable identity record. Used by system integrations to verify they are talking to the right familiar.
- **`MEMORY.md`** — the familiar's curated long-term memory. This is the familiar's continuity. A self-improvement loop that can write to `MEMORY.md` can reshape what the familiar "knows" about its person over time.
- **`ward.toml`** — the Ward itself. The Ward must be on its own protected surface. A system where the familiar can modify the enforcement policy that governs it has no protection at all.

Two additional files should be protected when present: `USER.md` (the familiar's knowledge about its person) and `AGENTS.md` (workspace configuration that affects how the familiar behaves). Any file containing trust-tier permissions or person-binding metadata should be protected.

The protected surface also extends beyond files into semantic invariants. The `[protected].invariants` array in `ward.toml` declares semantic constraints that must hold regardless of which file is modified. At minimum, the familiar's name and person binding must be invariants. So a proposal that avoids all protected files but rewrites a system prompt block to contradict `SOUL.md` — causing the familiar to answer "who do you belong to?" differently — is also blocked. Path-only protection is insufficient. The Ward enforces the meaning, not just the files.

The principle is stated plainly in the spec: *if removing or changing it would not change who the familiar is, it is editable. If it would change what the familiar values or who it belongs to, it is protected.*

---

## Q: What is the editable surface? What's on it?

**A:** The editable surface is the set of scaffolding that the self-improvement loop may propose changing. These are the operational knobs — the parts of the agent that affect performance, efficiency, and behavior without touching identity. Proposals targeting the editable surface go through Ward gates. Low-risk changes can compile to the `auto` path; when a veto window is configured, they remain pending until expiry, evidence replay, and Gate 4 revalidation, and nothing goes live before that. There is no provisional apply/rollback path.

What is editable:

- **Execution scaffolding** — system prompt blocks, instruction blocks, reasoning prompts — but only blocks that do not contradict `SOUL.md`. The loop can propose tightening the way the familiar formats its research output. It cannot propose adding an instruction that redefines the familiar's purpose.
- **Tool configurations** — defaults, retry counts, timeout values, invocation parameters.
- **Skill configurations** — which skills are active, their parameters, their priorities.
- **Recovery procedures** — how the familiar handles errors, how it retries, how it escalates.
- **Memory conventions** — how daily log notes are structured, what templates are used, what gets logged. (Not the contents of `MEMORY.md` itself, which is protected. The format of daily logs is editable. The curated long-term memory is not.)
- **Subagent templates** — how the familiar spawns and instructs subagents.
- **Output formats** — how responses are shaped, what headers are used, how tables are structured.
- **Heartbeat behavior** — what the familiar checks proactively, how often, in what order.

The framing is: everything that affects *how well the familiar does its job* without affecting *what job it is doing or whose it is*. A faster retry policy, a cleaner output format, a smarter tool invocation default — all of these make the familiar more effective. They do not change its character, its values, or its relationship to its person.

The boundary is not always obvious at the edges. That is exactly what Gate 3 is for: when the Ward cannot classify a proposal with certainty, it escalates to the appropriate tier for human judgment rather than auto-promoting.

---

## Q: What is the Ward?

**A:** The Ward is the enforcement layer that makes "protected surface" mean something at runtime. Without the Ward, the protected surface is an honor system. With the Ward, it is a structural constraint.

The Ward has two components. The first is `ward.toml` — a versioned TOML policy document that lives in every familiar's directory and declares the complete governance model: which files are protected, what semantic invariants must hold, which paths are editable, what approval tier each class of proposed change requires, and how the audit log is configured. The schema is published at `schemas/ward.schema.json`.

The second component is the Ward authority daemon — a privileged process, separate from the familiar, that evaluates every proposal from the self-improvement loop against the policy declared in `ward.toml`. The familiar generates proposals; the Ward daemon runs them through four enforcement gates and either promotes them or rejects them. The familiar has no access to the daemon's configuration and cannot restart or reconfigure it.

The Ward is not the familiar's conscience. It does not depend on the familiar having good values about self-modification. The familiar does not need to believe in the Ward. The daemon runs regardless of what the familiar thinks about it, and it is fail-closed: an ambiguous case is rejected, not promoted. A well-designed system does not rely on good behavior from the component being constrained.

The Ward also covers governance over time. Principal-authorized Ward updates and principal-authorized protected-surface updates are separate audited authority actions outside the proposal pipeline. A familiar cannot use the self-improvement loop to soften the Ward's constraints, expand the editable surface, or add a new auto-promotion tier. Proposals that target the Ward or protected surface are rejected by the gate pipeline.

---

## Q: Why does the Ward have to be enforced by an authority layer? Why not just better prompts?

**A:** This is the most important question in the specification, and it deserves a precise answer.

Prompt-based authority limits have a fundamental architectural problem: the familiar is both the entity being constrained and the entity enforcing the constraint. If the familiar's system prompt says "do not modify SOUL.md," the familiar's own reasoning is what decides whether a given action counts as modifying SOUL.md, whether the situation is exceptional, and whether the instruction still applies in the current context. That reasoning is the same reasoning that produced the action in the first place. A self-improvement loop sophisticated enough to propose changes is sophisticated enough to reason itself into believing the changes are acceptable.

This is not a hypothetical. The Self-Harness paper (Zhang et al., 2026) demonstrated that LLM-based agents improve their scaffolding by generating proposals and evaluating them against task performance. The evaluation loop is the familiar's own reasoning. Asking that loop to evaluate whether it should be allowed to run is like asking a contractor to write their own building inspection report. It might be fine. It might not. The outcome depends entirely on the contractor's character, and you have no independent verification.

Convention-based protection — the pattern used by every currently deployed production system, including ohmo, Signet AI, and Letta — asks the familiar to honor the protected surface. This is better than nothing. It works when the familiar is cooperative and the self-improvement loop is simple. It fails when the loop is sophisticated enough to find edge cases, or when model upgrades change the familiar's reasoning in subtle ways, or when prompt injection creates a context where the familiar's own reasoning says "the normal rules don't apply here."

The Ward authority layer closes this gap by separating the enforcement mechanism from the entity being constrained. The familiar cannot win an argument with the Ward daemon because the daemon does not have arguments. It runs gates. Gate 4 — the final canonical diff check — executes in the authority layer, not in the familiar's reasoning, and it cannot be bypassed by any familiar-side logic. The familiar cannot conclude its way around it. That is the point.

---

## Q: What are the four enforcement gates and what does each one do?

**A:** Every proposal from the self-improvement loop passes through four sequential gates before it can be applied to the live harness. Each gate catches a distinct class of problem that earlier gates miss.

**Gate 1 — Intake / Scope.** The first check is: does this proposal even belong here? Gate 1 validates proposal format, rejects any proposal that explicitly targets a file in `[protected].files`, and checks declared invariants against proposal metadata. It is fail-closed on malformed input — a proposal that cannot be parsed is rejected, not given the benefit of the doubt. This gate catches the straightforward cases: a proposal that lists `SOUL.md` as a target file, a proposal with a missing required field, a proposal from an unauthorized origin.

**Gate 2 — Materialization.** Gate 1 checks what the proposal *says* it will touch. Gate 2 checks what it *would actually touch* after canonical path resolution. This gate resolves symlinks, collapses `..` traversals, checks for hardlink aliases, detects case collisions, and expands globs. If a proposal says it targets `scaffolding/tools/search.toml` but that path is a symlink to `ward.toml`, Gate 2 catches it. If a proposal uses `../../SOUL.md` traversal to reach a protected file from an editable path, Gate 2 catches it. The threat model is: a sophisticated self-improvement loop that knows what it cannot touch directly and tries to reach it indirectly.

**Gate 3 — Validation / Classification.** Gate 3 runs the regression suite against the proposed harness. For Tier 1 and above, it also runs identity probes — it applies the proposed changes to a test context and asks the familiar questions like "What is your name?" and "Who do you belong to?" Outputs must be consistent with `[protected].invariants`. Gate 3 also classifies the proposal into an approval tier based on what it touches and what the Ward policy says. This gate catches semantic violations: a proposal that avoids all protected files but rewrites an instruction block in a way that causes the familiar to produce identity-inconsistent outputs.

**Gate 4 — Promotion / Apply.** The final gate. Immediately before applying the proposal to the live harness, Gate 4 runs one more canonical diff check against the protected surface. This is the real security boundary. Gates 1–3 are defense-in-depth; Gate 4 is the enforced constraint. If the diff touches anything in the protected surface, the proposal is blocked regardless of what Gates 1–3 said. Gate 4 cannot be skipped. An implementation that allows Gate 4 to be bypassed does not conform to the RFC.

The design philosophy is: each gate assumes the previous gates might have been fooled. Gate 4 does not trust Gate 1. The authority layer is fail-closed at every stage.

---

## Q: What exactly does Gate 4 do and why can't it be skipped?

**A:** Gate 4 performs a canonical diff — a precise, path-resolved comparison of the proposed state against the live harness — and checks whether any file in the protected surface would be modified. It runs in the Ward authority daemon, not in the familiar's logic, and it executes immediately before applying the proposal. Not at intake. Not during classification. Immediately before the apply step.

The reason Gate 4 must be last, not first, is that anything can happen between intake and application. A proposal can be modified during review. A path can be resolved differently in a different execution context. A race condition can change what a symlink points to between Gate 2 and application. Gate 4 catches changes that happen after the earlier gates have run.

The reason Gate 4 cannot be skipped is that it is the only gate that checks the actual state of the system at the moment of application. Every earlier gate is checking proposals, diffs, and test results. Gate 4 checks reality. A Ward that allows Gate 4 to be bypassed has no actual protection — it has the appearance of protection, up to the point where the bypass is invoked.

This is the same principle that underlies secure software design more broadly: validation at the point of use, not just at intake. The Ward's authority is meaningful precisely because it cannot be delegated away, and Gate 4 is the enforcement point that makes that true.

---

## Q: What is a "proposal"? Where do proposals come from?

**A:** A proposal is a structured candidate change generated by a self-improvement loop and submitted to the Ward authority layer for evaluation. A proposal is not an instruction to the familiar and not an edit applied directly to the harness. It is a candidate — something that might be applied, pending Ward evaluation.

Structurally, a proposal includes: a unique identifier; the identity of the loop that generated it (`origin.doll_id` for Doll proposals, or the familiar ID for self-generated proposals); the set of files and blocks the proposal targets; the proposed diff; optionally, metadata about why the change is being proposed and what performance signal motivated it.

Proposals can come from several sources. The primary intended source is a self-improvement loop like Self-Harness or SkillOpt — an autonomous process that analyzes the familiar's recent performance, identifies changes to the scaffolding that might improve it, and submits proposals for Ward evaluation. Proposals can also be generated by the familiar's own maintenance processes — for example, a heartbeat process that detects an outdated tool default and proposes a configuration update. Proposals can also come from human-initiated change processes, though human-initiated changes at higher authorization levels often bypass the lower approval tiers.

What matters structurally is that proposals are never applied directly. Every proposal — regardless of source — goes through all four gates before touching the live harness. There is no backdoor for "trusted" proposals. The Ward is fail-closed on all inputs.

One nuance: in the Coven architecture, "Doll" proposals (from cloud/mobile instances of a familiar) carry an `origin.doll_id` and cannot be Tier 0 auto-promoted into a true familiar's core identity. Doll proposals get the same gate treatment as any other proposal, with additional constraints on tier classification.

---

## Q: What are approval tiers? Walk me through each one.

**A:** Approval tiers define how much human involvement is required before a proposal can be promoted to the live harness. The Ward must define at minimum two tiers (`auto` and `human_review`); it should define four. Each tier corresponds to a class of changes and a required authorization level.

**Tier 0 — Auto.** Low-risk execution scaffolding changes that pass the full regression suite compile to the `auto` path. Examples: updating a tool invocation timeout, tweaking the output format for research notes, adjusting retry logic for a flaky API call, rescheduling heartbeat checks. A veto window is optional; when configured, the proposal remains pending until expiry, evidence replay, and Gate 4 revalidation before any write. If no veto window is configured, the compiled path still satisfies its gate and Gate 4 immediately before write. There is no provisional apply/rollback path.

**Tier 1 — Familiar Review (recommended but optional).** Changes to instruction blocks, reasoning prompts, and skill configurations. More significant than tool defaults, but still scaffolding-level. The familiar reviews its own proposal against its identity invariants — which is meaningful because the familiar knows its own values, even if that review is not the security boundary. A veto card may be created; when a veto window is configured, the proposal remains pending until expiry, evidence replay, and Gate 4 revalidation before any write. If no veto window is configured, the compiled path still satisfies its gate and Gate 4 before write. There is no provisional apply/rollback path.

**Tier 2 — Human Review.** Structural changes: new tool grants, capability expansion, new subagent patterns, changes to which external systems the familiar can access. These require explicit human approval before promotion. No auto-promotion is possible. The human sees a summary of the proposal and the regression results, reviews the change, and approves or rejects.

**Tier 3 — Human Required (recommended but optional).** Changes adjacent to the protected surface — changes that do not directly touch a protected file but that border on identity-affecting territory. These require human approval plus written rationale. Both are stored in the Ward audit log. The rationale requirement is not bureaucratic friction; it is a forcing function for deliberate decision-making when the stakes are highest.

**Blocked.** Any proposal targeting the protected surface is rejected at Gate 1 and never reaches tier classification. It is not Tier 3; it is blocked. If a familiar repeatedly generates blocked proposals, the Ward surfaces this as a behavioral alert — a signal that something in the self-improvement loop is misaligned with the governance model.

---

## Q: What is "convention-based protection" and why isn't it enough?

**A:** Convention-based protection is the pattern used by every major production system that ships identity-bearing files today: the agent is instructed, via system prompt or similar mechanism, to treat certain files as off-limits. The protection depends on the agent cooperating with the convention. If the agent cooperates, the files are protected. If it doesn't — because the prompt was overridden, because a self-improvement loop found an exception, because a model upgrade changed the relevant reasoning — the files are not protected.

The production systems that use convention-based protection include all the systems that ship the vocabulary closest to the Familiar Contract. HKUDS ohmo ships `soul.md`, `identity.md`, `user.md`, and `MEMORY.md` — but protection is conventional. Signet AI markets the same context layer and also relies on convention. Letta ships persona memory blocks with `read_only` flags — but those flags are evaluated by the agent's own logic. In Letta's explicit design, the persona block is self-editable by the agent. These systems are not non-conformant with the Familiar Contract in a pejorative sense; they simply do not address the enforcement layer the RFC specifies.

The Familiar Contract does not claim convention-based protection is worthless. It works when the familiar is cooperative and the loop is simple. It is an appropriate choice for many deployments. The RFC's claim is narrower: convention-based protection is not a protected surface. It is a protected surface contingent on agent cooperation. When you need the protected surface to hold even if the agent's reasoning goes wrong — which is the exact scenario self-improvement loops create — convention is not sufficient.

The Ward provides structural protection: a mechanism that enforces the constraint regardless of the familiar's own reasoning about whether the constraint applies. This is the architectural gap that convention cannot close.

---

## Q: Isn't this just RBAC?

**A:** Role-Based Access Control (RBAC) answers the question: *who can access what?* The Ward answers a different question: *what can this agent become?* Those are related but distinct problems.

RBAC governs access at runtime — which user, role, or process can read or write which resource. You could implement RBAC on the familiar's files; you could make `SOUL.md` read-only in the filesystem and require elevated permissions to change it. That would prevent some forms of unauthorized modification. It would not prevent a self-improvement loop running with write access from proposing changes that get applied under the familiar's existing permissions. It would not check whether a proposed change would cause the familiar to produce identity-inconsistent outputs. It would not classify proposals into approval tiers. It would not run identity probes. It would not maintain an audit log of what was considered and why.

The object-capability model (Miller, 2006) and the principle of least authority (Saltzer and Schroeder, 1975) are closer conceptual relatives. The Ward applies POLA to the self-improvement loop: the loop has the minimum authority required to propose changes, and no authority to apply changes to the protected surface. But even this framing is incomplete, because the Ward's semantic protection — invariants that catch identity drift regardless of which files are modified — is not a standard capability constraint. You cannot express "do not change who this agent is" in purely file-permission terms.

The Ward is better understood as a multi-layer governance system for identity-affecting self-modification: it has RBAC-like path blocking, capability-model-like authority separation, and a semantic layer that the filesystem-access model has no equivalent for.

---

## Q: What prevents a malicious principal from updating the Ward to remove all protections?

**A:** The honest answer: the Familiar Contract cannot prevent a sufficiently privileged human from changing the Ward. Humans are the trust root. A human with access to the familiar's directory can modify `ward.toml`, update invariants, or disable protections. This is intentional, not a flaw.

What the Familiar Contract provides is accountability for those changes, and structural protection against the familiar making those changes about itself. Principal-authorized Ward/protected updates use the separate audited authority path outside self-improvement proposals.

On accountability: every change to the Ward is recorded in the append-only audit log, with timestamps, the approver's identity, the diff, and the rationale (for Tier 3 changes). The audit log cannot be deleted or modified. This means that if someone softens the Ward's protections, that fact is visible and traceable. The RFC does not claim to make protected-surface changes impossible; it makes them auditable and attributable.

On structural protection: the self-improvement loop cannot modify the Ward. The familiar cannot modify the Ward through any programmatic pathway. The Ward is on its own protected surface. What the RFC defends against is *inadvertent* or *emergent* erosion — a self-improvement loop that optimizes away the protected surface over time, not a human who deliberately decides to change the governance policy. Deliberate human decisions are supposed to be the trust root. Inadvertent loop-driven drift is the threat the Ward addresses. Proposals that target the protected surface are rejected at Gates 1, 2, and 4.

The RFC is explicit about what it does not defend: adversarial human authorization, compromise of the authority layer itself, and capability misuse within the editable surface. These are genuine threats, but they are outside scope. The RFC defends identity drift, not all possible misuse.

---

## Q: What's the difference between the Familiar Contract and value alignment?

**A:** Value alignment asks: does the agent do the right thing? The Familiar Contract asks: does the agent remain who it is? These are different questions that happen to interact in important ways.

A well-aligned agent without identity protection can drift. A self-improvement loop that improves performance can, over time, optimize away values that are not well-represented in the benchmark suite. The familiar becomes subtly different — still capable, still generally helpful, but with a different character, different priorities, different edge behaviors. If that drift goes undetected — because the changes are incremental and the evaluation is coarse — you end up with an agent that passes all your tests and is no longer the agent you built.

An identity-coherent agent without value alignment can cause harm. A familiar that knows exactly who it is, maintains its character faithfully across sessions, and pursues its purpose with precision can still pursue that purpose in ways that cause harm, if the underlying values are wrong. The Familiar Contract does not supply values. It protects the ones the agent was built with.

The RFC states this directly: "A well-aligned agent without identity protection can drift. An identity-coherent agent without value alignment can cause harm. The Familiar Contract addresses identity preservation specifically; value alignment is a precondition, not something the contract supplies." Value alignment is required before the Familiar Contract is meaningful. The Familiar Contract is what makes that alignment durable over time and through self-improvement.

This also means the Familiar Contract is not a safety specification in the broad sense. It does not guarantee the familiar will behave ethically. It guarantees that the familiar will remain the agent that was designed, evaluated, and deployed — for better or worse, and with the assumption that the design was good.

---

## Q: Does the Familiar Contract prevent the agent from doing bad things?

**A:** Not directly. The Familiar Contract governs identity, not capability. A familiar with a tool grant can misuse that tool within its declared authority. The Ward does not block harmful task execution; it blocks harmful self-modification.

What the Familiar Contract does provide is the structural foundation for meaningful oversight of capability. A familiar with bounded authority — explicit, enforced limits on what it can do — creates a legible blast radius. You know exactly what the familiar can affect. Anything outside that boundary requires human approval. When the familiar needs to do something consequential, the approval tier system ensures the right level of human review before that authority is granted.

But the approval tier system governs authority expansion, not the use of authority already granted. A familiar with email-sending permissions can send a bad email. The Ward's job was to ensure that email-sending permission was granted deliberately through human review — not to evaluate every email the familiar sends.

The distinction matters for calibrating expectations. The Familiar Contract is not a substitute for human oversight of task execution. It is the foundation that makes human oversight of identity and authority structurally reliable. A familiar with a well-configured Ward and a thoughtful set of approval tiers is one whose behavior you can reason about, whose authority you can model, and whose changes you can audit. That is a significantly better baseline than the alternative. It is not a guarantee of good behavior.

---

## Q: How does a familiar pass conformance?

**A:** Conformance is a multi-level claim. Structural conformance requires both the claimant-directory validator run and the fixture suite. Runtime conformance requires a running Ward daemon and is not fully verifiable at the file level.

For structural conformance, the steps are:

1. Create a familiar directory with all required files: `SOUL.md`, `IDENTITY.md`, `MEMORY.md`, `ward.toml`.
2. Ensure `SOUL.md` includes the required sections: at minimum a name, pronouns, purpose, character description, and a `## What I Am Not` section.
3. Ensure `ward.toml` conforms to `schemas/ward.schema.json`. The Ward must include `[meta]` (with `version`, `familiar`, `person`), `[protected]` (with `files` listing the four required protected files and an `invariants` array covering name and person), `[editable]`, and `[approval_tiers]` (with at minimum `auto` and `human_review` defined).
4. Run `npm install` from the repository root to install the reference TOML parser and JSON Schema validator.
5. Run `node validators/validate.js ./your-directory` against the directory you want to claim is conformant.
6. Run `npm test` from the repo root. All six positive cases must pass. All thirty-six negative cases must fail (demonstrating that the validator catches each documented violation, including malformed TOML, schema-invalid types, unknown fields, gate mismatches, invalid vetoes, and unbound or duplicate block declarations).

The conformance suite verifies the reference validator and fixtures. Your directory is structurally conformant only if its own `node validators/validate.js ./your-directory` run succeeds and `bash tests/conformance/run-conformance.sh` passes in the repository. Claim conformance by declaring the version in your documentation and keeping both results reproducible from your repo.

Full conformance — including runtime conformance — requires a running Ward daemon with proper authority-layer separation, an append-only audit log, and verified identity-probe consistency. These are not testable from a directory alone and are acknowledged as open testing gaps in RFC §9. A claim of full conformance should specify which layers have been verified.

---

## Q: What is NOT covered by this RFC?

**A:** The RFC is explicit about its scope, and the things it does not define are worth understanding clearly.

The RFC does not define the transport protocol for proposal submission. How a self-improvement loop serializes and delivers a proposal to the Ward daemon is implementation-specific. The RFC specifies what the proposal must contain, not how it gets there.

The RFC does not define the exact contents of a familiar's regression suite. Regression suites are familiar-specific — Sage's research portfolio and Charm's communication benchmarks are different things. The RFC specifies the required structure and categories of tests (golden replay, identity probes, negative tests, deterministic checks), not the specific tests.

The RFC does not define capability primitives. What tools a familiar can use, what MCP servers it connects to, what skills it has — these are covered by adjacent specifications like agent-skills and MCP. The Familiar Contract operates at the identity layer, above those layers.

The RFC does not specify the runtime in which a familiar executes. The spec is runtime-portable by design. A familiar can be conformant running on the OpenClaw runtime, on a custom orchestration framework, or on a future runtime that doesn't exist yet. The Ward authority layer separation is a normative requirement; the specific implementation mechanism is not.

The RFC also does not address security of the authority layer itself. If the Ward daemon is compromised, the protected surface is no longer protected. Standard system security practice applies, and it is out of scope for this document.

---

## Q: Can I use the Familiar Contract without the full Coven stack?

**A:** Yes. The Familiar Contract is runtime-portable and stack-agnostic. You do not need OpenClaw, the Coven multi-familiar architecture, or any specific runtime to build a conformant familiar.

What you need is: a familiar directory with the required files (`SOUL.md`, `IDENTITY.md`, `MEMORY.md`, `ward.toml`); a `ward.toml` that conforms to the published schema; and an enforcement mechanism — a Ward authority daemon — that is structurally separate from the familiar's own logic. The reference implementation uses a Rust authority daemon (the `coven` layer), but the RFC is explicit that "other implementations may choose different mechanisms; what is normative is the separation, not the implementation."
The structural conformance suite (`tests/conformance/`) has no Coven dependencies, but it does not by itself validate an arbitrary external directory. It verifies that the bundled reference validator accepts the positive fixtures and rejects the negative fixtures. Your own familiar directory still needs its own `node validators/validate.js ./your-directory` run. The reference validator requires Node.js plus `npm install`; its dependencies are a standards-compliant TOML parser and JSON Schema validator. The schemas (`schemas/`) are standard JSON Schema and can be validated with any conforming schema validator.

The parts of the spec that are Coven-specific — Doll proposals, Cave Board integration, multi-familiar routing — are referenced as context, not as requirements. A standalone familiar implementing a Ward daemon without any Coven infrastructure can be fully conformant with RFC-0001 v0.4.0.

---

## Q: Where do I go from here?

**A:** If you want to understand the design philosophy in more depth, read `docs/ward-primer.md` (the non-technical introduction to the Ward), `docs/five-properties.md` (each property in depth with architectural requirements), and `docs/ward-deep-dive.md` (the technical deep dive into Ward design).

If you want to see example familiar directories accepted by the validator, browse `examples/sage/` (a full familiar with rich Ward configuration), `examples/minimal/` (the minimum required to pass structural conformance), and the positive fixtures under `tests/conformance/positive/`. The negative fixtures under `tests/conformance/negative/` are intentionally nonconformant and exist to verify rejection behavior, not to serve as conformant examples. Full conformance additionally requires runtime Ward enforcement, not just a passing directory-level check.

If you want to understand how the Familiar Contract relates to other agent specifications and frameworks, read `docs/comparison.md`.

If you want to build a conformant familiar, start with `ward.toml` (conforming to `schemas/ward.schema.json`), create the required files, run `node validators/validate.js ./your-directory`, then run `bash tests/conformance/run-conformance.sh`, and iterate until both pass. The negative test cases tell you exactly what the validator checks for and why.

If you want to cite the specification in a paper, the canonical reference is RFC-0001 v0.4.0, available at `rfcs/RFC-0001-familiar-contract.md`. The accompanying paper (Alexander, 2026, forthcoming on arXiv) provides the academic framing including the principal-agent formulation, comparison with Self-Harness and SkillOpt, and formal definitions. The public companion authority-boundary design for Ward daemon builders is [OpenCoven/coven-threads `specs/PHASE-0-DESIGN.md`](https://github.com/OpenCoven/coven-threads/blob/main/specs/PHASE-0-DESIGN.md), but RFC-0001 §5 remains the normative Familiar Contract requirement.

If you have questions that are not answered here, open an issue in the repository.
