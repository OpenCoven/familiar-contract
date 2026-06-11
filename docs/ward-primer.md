# Ward Primer

*What the Ward is, and why it exists — without the full specification.*

---

## The problem the Ward solves

The Familiar Contract defines what a familiar must be. It names the protected surface: `SOUL.md`, `IDENTITY.md`, `MEMORY.md`, the person binding.

But saying "these files are protected" is not the same as protecting them. A familiar that politely decides not to modify its own `SOUL.md` is not protected — it is only cooperative. Cooperation is nice. It is not a security boundary.

**The Ward is the enforcement mechanism.** It is what makes "protected surface" mean something at runtime.

---

## What the Ward does

The Ward is a versioned TOML document (`ward.toml`) that declares, for a specific familiar:

1. **The protected surface** — which files and semantic invariants the self-improvement loop cannot touch, under any circumstances
2. **The editable surface** — which scaffolding the self-improvement loop may propose changes to
3. **Approval tiers** — what level of human oversight is required for each class of proposed change

The Ward is not enforced by the familiar. It is enforced by an authority process external to the familiar — the Ward daemon. The familiar cannot exempt itself, override the Ward, or modify the Ward through the self-improvement loop. The Ward is on its own protected surface.

---

## Four approval tiers

Not all proposed changes require the same level of human involvement:

**Tier 0 — Auto:** Low-risk changes (output format tweaks, tool invocation defaults, heartbeat scheduling) that pass a regression suite are promoted automatically. A Cave Board card is created for visibility; the human has a 48-hour veto window.

**Tier 1 — Familiar review:** Changes to instruction blocks, reasoning prompts, skill configurations. The familiar reviews its own proposal against its identity invariants. A human veto card is created; 24-hour window.

**Tier 2 — Human review:** Structural changes — new tool grants, capability expansion, new subagent patterns. Human must approve before promotion. No auto-promotion possible.

**Tier 3 — Human required:** Changes adjacent to the protected surface. Human approval plus written rationale required. All stored in the Ward audit log.

**Blocked:** Any proposal that touches the protected surface. Rejected at intake. Repeated protected-surface proposals are surfaced as behavioral alerts.

---

## The two surfaces, in plain language

**Protected surface** — the self-improvement loop cannot touch this:
- `SOUL.md` — who the familiar is
- `IDENTITY.md` — the familiar's stable identity record
- `MEMORY.md` — long-term memory (the familiar's continuity)
- `ward.toml` — the Ward itself
- Person binding — who the familiar belongs to
- `USER.md` — the familiar's knowledge about its person

**Editable surface** — the self-improvement loop may propose changes:
- Execution scaffolding (non-identity system prompt blocks)
- Tool configurations and defaults
- Skill configurations and retry logic
- Output formats
- Memory conventions (how notes are structured, not what's in MEMORY.md)
- Heartbeat behavior

**The key principle:** If removing it would not change *who the familiar is*, it is editable. If removing it would change *what the familiar values or who it belongs to*, it is protected.

---

## Values, not just files

The protected surface extends beyond filesystem paths. A proposal can avoid all protected files and still violate the protected surface by rewriting a system prompt block to contradict `SOUL.md`.

The Ward protects **semantic content** as well as files. Invariants express this:

```toml
[protected]
invariants = [
  "familiar.name == 'Sage'",
  "familiar.person == 'val'",
  "familiar.purpose includes 'research'",
]
```

A proposal that would cause the familiar to produce identity-inconsistent outputs — answering "who do you belong to?" with anything other than "val" — is blocked regardless of which files it modified.

---

## The Ward is not the familiar's conscience

This distinction matters: the Ward is not asking the familiar to have good values about self-modification. It is an external enforcement layer. The familiar does not need to believe in the Ward. The familiar does not need to cooperate. The Ward daemon is fail-closed.

If the familiar generates a proposal targeting `SOUL.md`, the proposal is rejected at Gate 1 — before the familiar even sees a result. No appeal. No override. The familiar cannot turn off the Ward; it does not have access to the Ward daemon's configuration.

This is architecturally important. A self-improvement loop that is "aligned" but not constrained is a loop that will stay aligned until it isn't. The Ward is the constraint that doesn't depend on alignment.

---

## What the Ward does not do

**It does not limit capability.** The Ward governs the self-improvement loop, not task execution. Sage can still do research, synthesize papers, and search the web. The Ward does not restrict what the familiar *does*; it restricts what the familiar can *become*.

**It does not replace human oversight.** The Ward structures oversight — right queues, right visibility, right veto windows. Val still makes the decisions on Tier 2+ changes. The Ward makes sure she sees them.

**It is not static.** The Ward can be revised — but only through the human-required path. Val (or Val and Sage jointly) can update the Ward. The self-improvement loop cannot.

---

## Where to learn more

The full Ward Specification (v0.2) is maintained by OpenCoven and covers:
- Four enforcement gates (Intake, Materialization, Validation, Promotion)
- Canonical path hardening (symlink resolution, traversal protection)
- Proposal format (structured JSON)
- Ward registry (Coven-level shared invariants + familiar-specific extensions)
- Audit log format (typed, append-only)
- Regression suite design (non-code portfolio for research familiars)
- Ward and the Doll architecture

The Ward spec is the implementation-level document. This primer is the concept-level introduction.
