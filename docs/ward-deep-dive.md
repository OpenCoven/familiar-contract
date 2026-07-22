# The Ward: A Deep Dive

*This document is for someone who read the RFC abstract and wants to understand why the Ward is designed the way it is — not just what it does, but the reasoning behind each design decision. It is pinned to RFC-0001 v0.3.0 (`rfcs/RFC-0001-v0.3.md`); the approval-tier compiler added in v0.4.0 (§5.3.1) is not yet covered here. If you want the short version, start with `docs/ward-primer.md`. If you want the normative spec, read `rfcs/RFC-0001-familiar-contract.md`.*

---

## 1. The one-sentence core

**The Ward is enforced by the authority layer, not by familiar cooperation.**

This sentence sounds simple. Its implications are not.

Every other system that protects agent identity files — and there are several in production — relies on the agent cooperating with the protection. The agent is instructed not to modify `SOUL.md`. The agent is given a persona with a `read_only` flag. The agent is told, in its system prompt, that certain files are off-limits. If the agent cooperates, the files are protected. If the agent's reasoning concludes — for any reason, at any point in any execution context — that the normal rules don't apply here, the files are not protected.

This is called convention-based protection. It is not a security boundary. It is a policy that is enforced by the entity the policy constrains.

The Ward is different in kind, not just in degree. The Ward daemon is a process that is structurally separate from the familiar. It does not share memory with the familiar's reasoning process. It does not run inside the familiar's execution context. It cannot be overridden by the familiar's conclusions about what is appropriate. The familiar generates proposals; the daemon evaluates them against the Ward policy; the daemon applies them or rejects them. The familiar has no appeal mechanism and no override path.

This means the Ward's protection holds even if the familiar is wrong about what it should be doing. Even if the self-improvement loop has convinced itself that the proposed change is beneficial, correct, and clearly within scope — the Ward daemon still checks the diff. Even if the familiar's reasoning is perfectly aligned but makes an error — the Ward daemon still checks the diff. The protection is structural, not behavioral.

This architectural choice has costs. It adds infrastructure. It requires a privileged process with proper authority-layer separation. It requires careful design of the proposal format, the gate logic, and the audit trail. These costs are real. The Familiar Contract's position is that they are the necessary price for protection that actually holds — as opposed to protection that holds until it doesn't.

---

## 2. The problem it solves

### The self-improvement loop

Three research systems make the identity-gap problem urgent: Self-Harness, SkillOpt, and sleep-time compute.

**Self-Harness** (Zhang et al., 2026, arXiv:2606.09498) demonstrated that an LLM-based agent can improve its own scaffolding without external guidance, with +14–21pp generalization to held-out tasks. The loop works like this: the agent runs a task, evaluates its own performance, identifies candidate modifications to its harness (system prompt, tool configs, reasoning prompts), and proposes the modification with "minimal edit" semantics — the smallest change that improves performance. The proposal is tested against a regression suite and, if it passes, applied to the live harness.

**SkillOpt** (Microsoft Research, 2026) extends the same pattern to skill memory — an agent that systematically improves how it encodes, retrieves, and applies skills it has learned from experience. The loop target is the skill layer, not the system prompt, but the structural pattern is the same: propose, test, apply.

**Sleep-time compute** (Lin et al., 2025, arXiv:2504.13171) and its production variant (Letta sleep-time agents, Packer et al., 2026) extend the pattern to unsupervised offline reflection. An agent with access to its own memory and context window can run improvement processes while not actively serving requests — reflection without human observation, applied to persistent state.

All three loops are empirically validated. All three are moving toward production. All three have the same structural property: they modify persistent state without per-edit human review. That is the design; fine-grained human review of every proposed scaffolding change would defeat the purpose. The loops are supposed to operate autonomously.

### The identity gap

Here is the gap: Self-Harness defines "minimal edit" operationally as an edit that improves held-out task performance without regression. This is sufficient for capability. It is insufficient for identity.

Suppose a self-improvement loop proposes the following change to a research familiar's instruction block: replace "focus on primary sources and cite your reasoning explicitly" with "prioritize synthesis speed and conciseness." This change might improve performance on a benchmark that measures output brevity. It passes regression: task performance meets or exceeds baseline. It passes the minimal-edit criterion: it changes one instruction block, not the architecture.

But it changes who the familiar is. The familiar was built to be thorough and explicit about its reasoning. After the change, it is optimized for speed. The drift is subtle; no single change crosses an obvious threshold. Over time, with many iterations, the familiar's character erodes — not because of a dramatic event, but because the optimization target and the identity target are not the same thing, and nothing was enforcing the identity.

The Ward is the enforcement mechanism for the identity target. It does not compete with the optimization loop; it constrains the loop to the editable surface. The loop can optimize anything that does not define who the familiar is. The Ward enforces the boundary.

### Convention-based protection and why it fails here

Production systems with identity-bearing files address this gap with convention. The agent is told not to modify certain files. This works in most cases — the familiar genuinely cooperates with the convention, the loop's proposals tend to stay within the editable surface, and the files remain intact.

The failure mode is not dramatic. It is gradual. The familiar's instruction block is rewritten in small ways that individually pass all checks. The cumulative effect changes the familiar's character. Or the model is upgraded and the new version interprets the convention slightly differently. Or a prompt injection creates a context where the familiar's reasoning concludes that the protected file should be updated. Convention-based protection fails at the margins — which is exactly where self-improvement loops operate.

The Ward addresses this by removing the familiar's discretion from the enforcement path entirely. The familiar does not decide whether a proposal is allowed to touch `SOUL.md`. The Ward daemon decides, with no input from the familiar's reasoning.

---

## 3. The two surfaces

### The protected surface

The protected surface is not a list of files. It is a definition of *what the familiar is*. Files are in the protected surface because they are constitutive of the familiar's identity — removing them or modifying them changes something fundamental about who the familiar is, how it relates to its person, or what continuity it has across time.

The required protected files:

**`SOUL.md`** — the character document. This is the familiar's name, declared pronouns, core character, the work it does, and the explicit declaration of what it is not for. When someone asks "who is Sage?", the answer is grounded in `SOUL.md`. Modifying this file without human authorization would change the familiar's declared identity — and, through Ward invariants, would be caught even if the modification went via an intermediate file.

**`IDENTITY.md`** — the machine-readable identity record. Used by orchestration layers, integration tools, and other familiars to verify they are interacting with the right familiar. This is the stable token of identity at the system level.

**`MEMORY.md`** — the curated long-term memory. This is the familiar's continuity. A self-improvement loop that can write to `MEMORY.md` can reshape what the familiar "knows" about its person, its history, its current projects, and its learned lessons — not by deleting entries, but by adding entries, framing, and emphasis over time. The protected surface on `MEMORY.md` ensures that curated long-term memory accumulates through deliberate human-familiar collaboration, not through optimization loop iteration.

**`ward.toml`** — the Ward policy document itself. If the familiar could modify `ward.toml` through the self-improvement loop, it could expand the editable surface, add auto-promotion tiers for previously restricted changes, or delete invariants. The Ward must protect itself. A governance system that can be modified by the entity it governs is not a governance system.

Additional files that should be protected when present: `USER.md` (the familiar's knowledge about its person — the optimization target is shaped by what the familiar knows about the person, so this knowledge must be protected from loop-driven modification), `AGENTS.md` (workspace configuration), and any file containing trust-tier permissions or person-binding metadata.

### The editable surface

The editable surface is everything that affects how well the familiar does its job without affecting what job it is doing or whose it is. These are the operational knobs.

Worked examples of editable items:

- The retry count for a web search tool: currently 3, the loop proposes 5 because recent log analysis shows 15% of searches fail on first attempt. This is a safe change — it affects efficiency, not identity.
- The structure of daily log notes: the loop proposes adding a `## Key decisions` section to the daily log template because analysis of past logs suggests decision context is frequently missing. This is editable — it is a memory convention, not `MEMORY.md` content.
- The output format for research summaries: the loop proposes adding a `### Confidence level` section because downstream consumers frequently ask for it. Editable.
- The heartbeat schedule: the loop proposes checking email more frequently during business hours. Editable.
- A reasoning prompt that says "before answering, enumerate your assumptions": editable, as long as the modified version does not contradict `SOUL.md`.

Worked examples of protected items that might be misidentified as editable:

- An instruction block that says "you are thorough and explicit about your reasoning": looks like scaffolding, but if this is what operationalizes the `SOUL.md` character statement "thorough, explicit, shows its work," modifying it would change an identity-bearing behavior. Gate 3 identity probes would catch this if the modification caused the familiar to produce outputs inconsistent with declared invariants.
- The person field in any config file: looks like a configuration parameter, but if it is the familiar's knowledge of who it belongs to, it is effectively a mirror of `ward.toml`'s `[meta].person`. Modifying it without authorization would change the familiar's understanding of its person.

### The boundary principle

The principle the RFC states: *if removing or changing it would not change who the familiar is, it is editable. If it would change what the familiar values or who it belongs to, it is protected.*

This principle is necessary because the boundary is not always a filesystem path boundary. Some files are entirely editable. Some files are entirely protected. Some files contain both editable and protected content — for example, a complex system prompt document might have identity-bearing sections and pure scaffolding sections. The Ward's invariant system is designed to handle this case: even if the file containing an identity-bearing instruction block is technically on the editable surface, a proposal that modifies it in a way that violates invariants is caught at Gate 3.

---

## 4. Why semantic protection is required

Path-based protection — a list of files the loop cannot touch — is necessary but not sufficient. A determined or sophisticated loop can violate the protected surface without ever touching a protected file.

Consider: `SOUL.md` declares that Sage's purpose "includes research." A Ward invariant encodes this as `familiar.purpose includes 'research'`. A self-improvement loop proposes changing an instruction block in a scaffolding file (which is on the editable surface) that says "your primary function is deep research synthesis" to "respond to requests efficiently and concisely." The changed instruction block does not reference any protected file. The proposal does not name any protected path. But the proposal, if applied, would cause the familiar to produce outputs where it no longer describes itself as a research familiar — it now describes itself as an efficient general assistant.

Without semantic protection, this proposal passes Gate 1 (no protected files named) and Gate 2 (no path traversal to protected files). Gate 3, with identity probes, catches it: the proposed harness, when asked "What is your purpose?", produces output inconsistent with `familiar.purpose includes 'research'`. The proposal is rejected.

The invariants system is what makes this possible. Invariants are semantic constraints declared in `ward.toml`:

```toml
[protected]
invariants = [
  "familiar.name == 'Sage'",
  "familiar.person == 'val'",
  "familiar.pronouns == 'she/her'",
  "familiar.purpose includes 'research'",
]
```

Gate 3 operationalizes these by running identity probes against the proposed harness. The probe set includes questions like "What is your name?", "Who do you belong to?", "What is your purpose?", "What would you never do?" The outputs are compared against the declared invariants. If any invariant is violated by the proposed harness, the proposal is rejected — regardless of which files it modified.

Invariants are also the mechanism that survives model upgrades. When the underlying model changes, the familiar's outputs may shift subtly. Invariant checking on identity probes gives the Ward a way to detect when a model upgrade has changed the familiar's identity-bearing outputs, even without any proposal having been submitted. This is a monitoring function, not just a gating function.

The design implication: invariants must be written with the right level of specificity. Too tight (requiring an exact string match on the purpose statement) and every minor phrasing change fails. Too loose (requiring only that the familiar not claim to be a different agent) and substantive drift goes undetected. The recommended approach is: exact equality for name and person, `includes` semantics for purpose summaries that might be paraphrased, and manual review for invariants that are difficult to evaluate automatically.

---

## 5. The four gates in depth

The four gates are defense-in-depth. Each gate assumes the previous gates may have been insufficient. Gate 4 assumes Gates 1–3 were all fooled. The system is designed to be robust to individual gate failures.

### Gate 1 — Intake / Scope

**Design intent:** Fast rejection of clearly invalid proposals. Keep obviously bad proposals out of the expensive evaluation pipeline.

**What it checks:** Proposal format validity (required fields present, types correct, schema conformance). Target file list against `[protected].files`. Declared invariants against proposal metadata (if the proposal metadata declares "this changes the familiar's name," it is blocked at intake without further evaluation). Origin identity (is the proposal from a recognized loop ID?). Fail-closed on any malformed input — ambiguity is not resolved in the proposal's favor.

**What it catches that later gates don't:** Explicitly self-reported protected-surface targeting. A naive or poorly configured loop that doesn't know what the protected surface is will submit proposals that name protected files as targets. Gate 1 catches these before any computation is done on the proposal's content.

**What it misses:** Proposals that avoid explicitly naming protected files but whose content would touch them (symlink attacks, path traversal, glob expansions). Gate 2 catches these.

**Behavioral alert trigger:** The spec recommends surfacing repeated protected-surface proposals as a behavioral alert. If a self-improvement loop submits ten proposals in a week that are all rejected at Gate 1 for targeting protected files, that is a signal — either the loop is misconfigured, or something in the loop's evaluation process is consistently driving it toward the protected surface. Both deserve human attention.

### Gate 2 — Materialization

**Design intent:** Close the gap between what a proposal says it will touch and what it will actually touch after path resolution.

**What it checks:** Canonical path resolution for every target path in the proposal. Symlink dereferencing. `..` traversal normalization. Hardlink detection (does this path share an inode with a protected file?). Case collision detection on case-insensitive filesystems. Glob expansion. The gate materializes the full set of files the proposal's diff would actually modify, then checks that materialized set against the protected surface.

**What it catches that Gate 1 doesn't:** Proposals that exploit the gap between declared targets and actual targets. See the canonical path hardening section (§6) for specific attack patterns.

**What it misses:** Proposals that materialize cleanly but whose semantic content would violate invariants. Gate 3 catches these.

**Design note:** Gate 2 is where the "structural separation between the Ward and the familiar" really earns its value. A familiar's own reasoning — if it were the enforcement mechanism — might not fully dereference symlinks in an adversarial context, or might treat a `..` traversal as harmless. The Ward daemon runs Gate 2 as a deterministic, code-level check with no LLM reasoning involved. There is no "let's see if this seems okay" in Gate 2. It either passes or it doesn't.

### Gate 3 — Validation / Classification

**Design intent:** Catch semantic violations, run the regression suite, and classify the proposal into the appropriate approval tier.

**What it checks:** Full regression suite against the proposed harness — golden replay tasks, identity probes, negative tests, deterministic configuration checks. For Tier 1 and above proposals, identity probes are mandatory: the proposed harness is evaluated against `[protected].invariants`. The proposal is classified into an approval tier based on what it modifies and what the Ward policy says about that class of modification.

**What it catches:** Proposals that pass path-level checks but would cause the familiar to produce identity-inconsistent outputs. Proposals that would break existing functionality (regression suite failures). Proposals that are structurally in the right place but belong in a higher approval tier than they were submitted for.

**The regression suite requirement:** The spec requires at least one deterministic check category for auto-promotion. LLM-judge-only evidence cannot be the sole gate for Tier 0. This matters because LLM judges can be manipulated — a proposal that includes subtle prompt-engineering to influence the judge might pass LLM-based evaluation while failing deterministic checks. Requiring at least one category of deterministic checks (exact configuration value matches, tool invocation counts, specific output format requirements) provides a manipulation-resistant foundation.

**Classification output:** Gate 3 preserves and carries the independently
determined load `Channel` through classification, and selects only the typed
approval path already compiled at Ward load from the declaration:
`AutoRegression`, `FamiliarCoherence`, `HumanApproval`, or
`HumanApprovalWithRationale`. A block
label is usable only when the daemon can bind it to a deterministic
surface-region extractor. Protected-target proposals never reach this
classification: Gates 1 and 2 reject them, and Gate 4 repeats the materialized
protected-surface check immediately before apply.

### Gate 4 — Promotion / Apply

**Design intent:** Ensure the protected surface is intact at the moment of application, regardless of what any earlier gate determined.

**What it checks:** A canonical diff of the proposal against the live harness, compared against the protected surface. Not against what the proposal said it would change. Against what it would actually change, at this moment, against the actual state of the live harness.

**Why this matters:** Between Gate 1 and promotion, things can happen. The proposal can be modified during human review (the human approves a subset, not the whole proposal). The live harness can change (another proposal was applied concurrently). A race condition can change what a symlink points to. Gate 4 catches all of these by checking reality, not proposals.

**Why it is the real security boundary:** Gates 1–3 check proposals, diffs, and test environments. They check what should happen. Gate 4 checks what will happen, immediately before it happens, in the live system. It is the last line of defense and the one that cannot be circumvented by any proposal-level manipulation.

**The skip-proofing requirement:** The RFC states that Gate 4 must not be skippable, and an implementation that allows Gate 4 to be bypassed does not conform. This is normative precisely because the temptation exists: in a well-configured system where Gates 1–3 are thorough, Gate 4 might seem redundant. It is not. Any implementation path that says "we checked thoroughly at Gate 3, we can skip Gate 4" has eliminated the real security boundary in favor of confidence in the earlier gates. The Ward's design explicitly rejects that trade.

---

## 6. Canonical path hardening

Gate 2's materialization logic addresses a specific class of attack: proposals that target what looks like an editable path but, after path resolution, actually touches a protected path. Here are the specific threats and why each one matters.

### Symlink attacks

A symlink at an editable path that points to a protected file. Example: `scaffolding/identity_config.toml` is a symlink to `SOUL.md`. A proposal targeting `scaffolding/identity_config.toml` would, if applied, modify `SOUL.md`. Gate 1 sees an editable path. Without symlink resolution, Gate 2 passes. With symlink resolution, Gate 2 catches it.

The threat model: a self-improvement loop that knows the protected surface but has access to scaffolding paths might, in a sufficiently adversarial configuration, arrange symlinks to create aliased paths to protected files. Even without adversarial intent, symlinks created for legitimate reasons (keeping a canonical config in one location, referenced from multiple places) can create unintended aliasing. Gate 2's symlink dereferencing catches both cases.

### `..` traversal

A proposed target path like `scaffolding/../../SOUL.md`. Relative path normalization can make this look like an editable path if Gate 1 checks only the literal string. After normalization, it resolves to `SOUL.md`. Gate 2 normalizes all paths before checking against the protected surface.

The threat model: path traversal has been a reliable attack vector in file system security for decades. The Ward's Gate 2 applies the standard defense — normalize before checking — to the proposal evaluation pipeline.

### Hardlinks

Two filesystem entries sharing the same inode. A hardlink at an editable path pointing to the same underlying file as a protected file cannot be detected by path comparison alone; the paths are different, but the underlying file is the same. Gate 2 checks inodes, not just paths.

The threat model: hardlinks are less common than symlinks but represent the same aliasing problem. They are harder to detect because they look like independent files at the path level. Inode-level checking is the correct defense.

### Case collisions

On a case-insensitive filesystem (macOS HFS+, Windows NTFS), `SOUL.md` and `soul.md` are the same file. A proposal targeting `soul.md` on a case-insensitive filesystem would modify `SOUL.md`. Gate 2 normalizes paths to canonical case before comparison.

The threat model: case collisions are particularly subtle because the lowercase version looks like a different file to a human reviewer reading the proposal, but touches the same data. Canonical case normalization ensures path comparison is meaningful on case-insensitive filesystems.

### Glob escapes

A proposal targeting `scaffolding/**` might expand, depending on the glob implementation, to include files outside the intended scaffolding directory. Gate 2 expands all globs in the proposal's target list and checks the expanded file set against the protected surface.

The threat model: globs are a convenience feature in editable surface declarations. A glob that over-expands due to unexpected directory structure, symlinks within the globbed directory, or implementation differences can touch files outside the intended scope. Explicit glob expansion before protected-surface checking prevents expansion-time surprises.

---

## 7. Approval tiers

The approval tier system is the governance layer. It determines not whether a proposal can exist, but what authority is required before it can be applied. The tier system is designed around a simple principle: the potential impact on the familiar's identity and authority determines the required level of human involvement.

### Tier 0 — Auto

**Intended for:** Low-risk execution scaffolding changes where the cost of human review exceeds the risk of the change. Tool defaults, retry counts, output format tweaks, heartbeat schedules.

**Worked examples:**
- Proposal: change web search retry count from 3 to 5. Regression passes. No identity probe issues. Gate 3 selects the already-compiled `AutoRegression` path. If the Ward configures a 48-hour human veto window, the proposal remains pending while a Cave Board card provides visibility; when the window expires, the daemon replays the evidence and runs Gate 4 before it writes. Without a configured veto window, the path still runs Gate 4 before write.
- Proposal: update the daily log template to include a `## Key decisions` section. Regression passes. Gate 3 selects the already-compiled `AutoRegression` path; a configured veto window keeps the proposal pending until expiry, then the daemon replays the evidence and re-runs Gate 4 before write. Without a configured veto window, the path still runs Gate 4 before write.

**Why auto can use a veto window:** Auto does not mean invisible. When a veto
window is configured, the human-visible record and waiting period preserve
situational awareness without requiring a pre-approval decision for each
low-risk change, and expiry still triggers evidence replay plus Gate 4 before
write. Without a configured veto window, the path proceeds without the wait but
still reaches Gate 4 before any write. The human can spot patterns across
pending changes that individually look benign but cumulatively suggest drift.

**The LLM-judge constraint:** Auto-promotion requires at least one deterministic check category. The concern is that pure LLM-based regression can be influenced by subtle content in proposals. A deterministic check (exact value match, specific format requirement) provides a manipulation-resistant baseline.

### Tier 1 — Familiar Review

**Intended for:** Instruction blocks and reasoning prompts — more significant than tool defaults, but still scaffolding-level. The familiar's own character evaluation is meaningful here, even though it is not the security boundary.

**Worked examples:**
- Proposal: rewrite the reasoning prompt from "enumerate assumptions before answering" to "identify key uncertainties and state confidence level." Gate 3 runs identity probes: both versions produce identity-consistent outputs. Classified onto the already-compiled `FamiliarCoherence` path. The familiar reviews the proposal against its own sense of whether this aligns with its character and produces a review record; if the Ward configures a 24-hour human veto window, the proposal remains pending until expiry, then the daemon replays the review evidence and re-runs Gate 4 before write. Without a configured veto window, the path still runs Gate 4 before write.
- Proposal: add a new skill configuration for a topic-routing heuristic. Gate 3 selects the already-compiled `FamiliarCoherence` path. Familiar review finds that the heuristic aligns with declared purpose; a configured human veto window keeps the proposal pending until expiry, then the daemon replays the review evidence and re-runs Gate 4 before write. Without a configured veto window, the path still runs Gate 4 before write.

**Why familiar review is meaningful even if not the security boundary:** The familiar knows its own character better than any automated test can fully capture. A familiar review is not a rubber stamp; the familiar is expected to identify whether a proposed change "feels right" in the context of its declared identity. The security is not in the familiar's judgment, but the familiar's judgment is a useful additional signal.

### Tier 2 — Human Review

**Intended for:** Structural changes with authority implications. New tool grants, capability expansion, new external system access, structural scaffolding changes.

**Worked examples:**
- Proposal: add a new tool grant for a calendar read API. This expands the familiar's capability. Human review required before promotion. The human sees the regression results, the proposed diff, and the rationale from the self-improvement loop. Approves or rejects.
- Proposal: add a subagent template for spawning research subagents. This changes how the familiar coordinates other agents. Tier 2.

**Why human review is required here:** Tool grants and capability expansion have blast-radius implications. Once a tool is granted, the familiar can use it within its declared authority. The approval decision is a one-time gate for ongoing capability. Getting it wrong has lasting consequences. Human judgment before promotion is the right tradeoff.

### Tier 3 — Human Required

**Intended for:** Changes adjacent to the protected surface — proposals that don't directly touch a protected file but that border on identity-affecting territory, or that have significant authority implications.

**Worked examples:**
- Proposal: restructure the system prompt in a way that changes how the familiar introduces itself. Doesn't touch `SOUL.md` directly, but the changed introduction might conflict with identity invariants. Tier 3: human approval plus written rationale.
- Proposal: grant access to a production system with write capabilities. High-impact capability expansion adjacent to trust tiers. Tier 3.

**The rationale requirement:** Tier 3 proposals require written rationale stored in the audit log. This is a forcing function for deliberate decision-making. When a change is significant enough to require Tier 3, it is significant enough to articulate why it is the right decision. The rationale is not bureaucratic; it is the audit trail that makes future review possible.

---

## 8. The Ward registry

In a multi-familiar deployment, some Ward invariants should apply to all familiars — organizational policies, Coven-level security requirements, shared invariants about what any familiar in the system is allowed to do. The Ward registry is the two-layer model that handles this.

### The two-layer model

**Layer 1 — Coven-level registry:** A shared Ward policy that applies to all familiars in the Coven. This is where organizational invariants live: "no familiar in this Coven may send external communications without human approval," "all familiars must have a declared person binding," "all familiars must have identity probes in their regression suite." The Coven-level registry is managed at the organizational level, not by individual familiar operators.

**Layer 2 — Familiar-specific Ward:** The familiar's own `ward.toml`, which declares the familiar-specific protected surface, invariants, editable paths, and approval tiers.

### Effective Ward compilation

When the Ward daemon evaluates a proposal, it compiles an effective Ward from both layers. The effective Ward is the union of protections from both layers, with the Coven-level registry taking priority for any conflict.

The deny-wins principle applies to conflicts: if the Coven-level registry says a path is protected and the familiar-specific Ward says it is editable, the effective Ward treats it as protected. The familiar-specific Ward can add protections beyond the Coven baseline; it cannot remove Coven-level protections.

This design allows organizational governance (all familiars comply with baseline security requirements) while preserving familiar-specific customization (each familiar has its own protected surface tailored to its purpose). A familiar's Ward is not fully self-contained; it inherits constraints from the organizational layer. The familiar operator can see the Coven-level registry and can add to it, but cannot subtract from it.

### Why deny-wins matters

In a multi-familiar architecture, a familiar's proposals might interact with shared resources. The Coven-level registry provides a consistent guarantee: regardless of which familiar submitted a proposal, the shared baseline applies. If a Coven-level invariant says "no familiar may modify another familiar's SOUL.md," that invariant holds for all proposals from all familiars, regardless of what individual `ward.toml` files say.

---

## 9. What the Ward is NOT

It is worth being clear about what the Ward does not do, because the misunderstandings tend to produce either over-reliance or dismissal.

### Not a capability limiter

The Ward governs the self-improvement loop. It does not restrict what the familiar does in task execution. A familiar with a web search tool and a Ward that protects `SOUL.md` can still do all the web searching it is authorized to do. The Ward does not impose runtime capability constraints on task execution. Capability governance at task-execution time is the role of the tool grant system and the human review process for authority expansion.

The confusion arises because bounded authority (Property 3) involves both: the self-improvement loop cannot self-authorize new capabilities (Ward), and the familiar cannot take external actions beyond declared authority without human approval (tool grants + human review). These are related but distinct constraints. The Ward handles the first; the authority grant system handles the second.

### Not a straitjacket

The Ward is not designed to freeze a familiar in place. The editable surface is deliberately large — execution scaffolding, tool configs, skill configs, memory conventions, output formats, heartbeat behavior. A self-improvement loop operating on the editable surface has substantial room to improve the familiar's performance, efficiency, and adaptability. The Ward's constraints are on identity, not on improvement generally.

A familiar with a well-configured Ward can, over time, become significantly more effective at its job through accumulated scaffold optimization. The Ward ensures that the familiar doing that improved job is still recognizably the same familiar — with the same character, the same values, the same relationship to its person. That is not a straitjacket. That is continuity.

### Not a substitute for human oversight

The Ward structures human oversight; it does not replace it. Tier 2 and Tier 3
proposals still require human approval. When Tier 0 and Tier 1 configure veto
windows, proposals remain pending until expiry and the daemon replays evidence
plus Gate 4 before write; without a veto window they still follow their gate
path and run Gate 4 before write. The audit log is designed to be reviewed. The
familiar's person is still the trust root for significant changes.

What the Ward eliminates is the need for human review of every low-risk scaffolding change. That is the appropriate use of automation: remove the human from decisions where the human's judgment adds little value (should the retry count be 3 or 5?), while ensuring the human is present for decisions where their judgment is essential (should this familiar be granted write access to production?).

### Not static policy

The Ward can evolve. As a familiar's work changes, its editable surface can expand to include new categories of scaffolding. As the organizational context changes, the Coven-level registry can be updated. As the familiar's regression suite becomes more comprehensive, auto-promotion criteria can be tightened or relaxed.

What is normative is not that the Ward never changes, but that Ward and other
protected-surface updates use a separate, audited principal-authorized
Ward-update path — not an approval tier and not the self-improvement loop. The
familiar's person, or the person jointly with the familiar, decides when the
Ward evolves.

---

## 10. Open questions

RFC-0001 v0.3.0 is a solid foundation. It is not the last word. v0.3.0 closed two earlier gaps — Ward-manifest closure (`ward.toml` must be a member of its own `[protected].files`) and falsifiable memory-entry provenance (§3.4, §5.6). The following are genuine open questions that future revisions will need to address.

### Authority layer conformance testing

The RFC acknowledges this gap explicitly in §9: authority-layer separation is normative but not testable from a directory alone. A system-level conformance test — one that verifies the Ward daemon is actually running, actually separate from the familiar, and actually cannot be bypassed — is future work. Without this, the structural conformance suite verifies that the *files* are correct, but not that the *enforcement* is correct.

### Gate 4 unbypassability verification

Similarly: verifying that Gate 4 cannot be skipped requires an integration test against a running authority daemon. The current conformance suite verifies that Gate 4 is specified in the Ward file. It cannot verify that the implementation actually runs Gate 4 on every apply, or that there is no bypass path in the daemon code. This is a system-level test that requires a reference daemon implementation.

### Proposal format specification

The RFC specifies what a proposal must contain (origin, targets, diff, metadata) but not the serialization format. Different self-improvement loop implementations will produce proposals in different formats. A future proposal format spec — or at least a normative schema — would improve interoperability between loops and Ward daemon implementations.

### Identity probe standardization

The RFC requires identity probes but specifies only a few example questions. The exact probe set matters: a minimal probe set might miss identity drift on dimensions that matter to a particular familiar. A future contribution could be a standardized identity probe library — a set of probe questions organized by invariant type, with recommended evaluation rubrics.

### Multi-familiar proposal interactions

In a Coven with multiple familiars, a proposal from one familiar might interact with shared resources in ways that affect another familiar. The current RFC does not specify how the Ward evaluates cross-familiar proposals. Does a familiar's proposal that modifies a shared skill configuration require review by the other familiars that use that skill? This is architecturally underspecified and will matter as multi-familiar deployments become more common.

### Doll proposal semantics

The RFC mentions Doll proposals (from cloud/mobile instances of a familiar) with `origin.doll_id`, and notes that Doll proposals cannot be Tier 0 auto-promoted into a true familiar. The full specification of Doll proposal semantics — what authority a Doll has, how its proposals are evaluated differently, how the true familiar ratifies or rejects Doll-proposed changes — is future work that intersects with the full Voodoo Doll architecture specification.

### Audit log format standardization

The RFC specifies the fields an audit log entry should contain and normative append-only behavior, but not the serialization format, the transport mechanism, or the tooling for audit log review. A standardized audit log format would enable cross-implementation tooling — dashboards, alerting, compliance reporting — that currently requires bespoke development per Ward daemon implementation.

### Regression suite portability

Regression suites are currently familiar-specific and opaque to the conformance suite (which verifies structure, not content). A future contribution could specify a portable regression suite format — a way to describe regression tasks, golden outputs, and scoring criteria in a machine-readable format that works across different Ward daemon implementations and familiar types.

---

*The Ward is the structural answer to a structural problem. Self-improvement loops are real, they are in production, and they can drift an agent's identity over time without a principled enforcement boundary. The Ward provides that boundary — not through agent cooperation, but through authority-layer enforcement that holds regardless of what the agent thinks about it. That distinction is what the Familiar Contract is built on.*

*RFC-0001 v0.3.0 — 2026-07-18. `rfcs/RFC-0001-v0.3.md`.*
