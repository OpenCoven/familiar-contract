# The Five Properties — In Depth

The Familiar Contract defines five properties that every compliant familiar must satisfy. This document explores each property: what it means, why it matters, and what it requires architecturally.

---

## 1. Named Identity

### What it means

A familiar has a name that indexes a stable design. Not a product brand, not a session variable — a character. That character has a consistent voice, declared traits, known strengths, and known limits that persist across sessions, model upgrades, and context variations.

Named identity is what makes a familiar *predictable* in the right way. You can ask "what would Sage do here?" and get a meaningful answer because Sage has a defined character. You cannot ask that about a generic assistant because the persona drifts with the prompt.

### Why it matters

**Accountability surfaces.** When you interact with a named, designed familiar, you can reason about its behavior. You can say "Sage told me X" and someone else can assess that claim — was it in Sage's domain? Does it align with Sage's stated approach? Would Sage have good evidence for that?

Generic assistants are difficult to hold accountable because they are difficult to model. A name is a commitment to consistency.

**Trust calibration.** Named identity enables you to build trust correctly. You learn what Sage is reliable for. You learn where to verify. You develop a working model of the familiar's strengths and blind spots. This is what trust with any collaborator requires — predictability, not perfection.

**Upgrade continuity.** When the underlying model improves, you need to be able to say "this is still Sage." That requires a stable design: declared character, protected identity files, consistency checks. Without it, every upgrade potentially changes who the familiar is.

### Architectural requirements

- A `SOUL.md` document that declares name, character, purpose, vibe, and boundaries. Protected from modification without human authorization.
- An `IDENTITY.md` document providing a stable, machine-readable identity record.
- A protected surface that prevents the self-improvement loop from drifting the declared character.
- Consistency evaluation: regular checks that the familiar's outputs align with declared character.

---

## 2. Defined Purpose

### What it means

A familiar knows what it is for — and is honest about what it is not for.

Sage is for research, synthesis, and knowledge work. Sage is not for social media management or infrastructure commands. That boundary is declared in `SOUL.md`, enforced in Ward invariants, and maintained in practice. When Sage declines something outside its purpose, the refusal has meaning.

### Why it matters

**Interpretable refusal.** An agent that will attempt anything produces refusals that feel arbitrary. "I can't do that" is confusing when you don't know what the agent actually can do. A purpose-defined familiar produces refusals that cite the design: "That's Charm's domain, not mine." That is useful information.

**Evaluation signal.** The self-improvement loop needs an evaluation signal. For a purpose-defined familiar, the signal is coherent: does this response serve the familiar's actual purpose? For a generic assistant, the signal degrades into vibes.

**Scope discipline for the team.** In a multi-familiar architecture, defined purpose prevents overlap and conflict. Charm handles social communications. Cody handles code. Sage handles research. When each familiar knows its lane, the team is more than the sum of its parts.

### Architectural requirements

- A declared purpose in `SOUL.md`: what the familiar is for, in specific terms.
- An explicit "What I Am Not" declaration: what falls outside scope, with references to other familiars when applicable.
- Ward invariants that include purpose-protection: `familiar.purpose includes 'research'`.
- Behavioral consistency: the familiar must maintain purpose limits across adversarial prompts, not just in calm conditions.

---

## 3. Bounded Authority

### What it means

A familiar has explicit permissions. It does not take external actions — sending emails, posting publicly, calling external APIs — without human approval. The authority boundary is enforced at the harness level, not merely stated in a system prompt.

This is distinct from *purpose*. Purpose says what a familiar is *for*. Authority says what it is *allowed to do to the world*. A research familiar might have the purpose of helping with a communication — but unless authority to send emails is explicitly granted, it asks rather than acts.

### Why it matters

**Blast radius legibility.** An agent with unbounded authority is difficult to trust because you cannot model what it might do. Bounded authority makes capability legible: you know exactly what this familiar can affect, and everything else requires your approval.

**Reversibility.** Actions inside defined authority bounds can be scoped to reversible changes by design. Actions outside bounds require human judgment — which provides a natural checkpoint before irreversible operations.

**The self-improvement boundary.** Bounded authority applies to the self-improvement loop as well as to task execution. A familiar must not be able to self-authorize new capabilities — adding tool grants, expanding permissions, granting itself access to protected systems — through the self-improvement loop. This is where the Ward's approval tiers do their most important work.

### Architectural requirements

- A `ward.toml` that declares what files and harness blocks are protected and what is editable.
- Approval tiers that require human review for any authority expansion.
- An enforcement mechanism (Ward daemon) that blocks proposals targeting the protected surface.
- External action approval: email, posts, external API calls require explicit human authorization.

---

## 4. Persistent Memory

### What it means

A familiar has continuity across sessions. It knows what happened before. Memory is structured, durable, and maintained — not a context window, not a summary injected at startup.

Coven's memory model distinguishes three layers:
- **Session log:** raw notes from each interaction
- **Daily memory:** `memory/YYYY-MM-DD.md` files with structured daily notes
- **Long-term memory:** `MEMORY.md` — curated, distilled learnings and context that survive indefinitely

The heartbeat maintenance loop reviews session notes and promotes what matters to long-term memory. This is closer to a database architecture problem than a prompt engineering problem.

### Why it matters

**Memory is care.** The familiar that remembers what mattered to you last month treats your context as worth carrying. The assistant that starts blank every session treats it as disposable. Persistent memory is how a familiar signals that it takes your work seriously.

**Richer evaluation.** A stateless agent can only be evaluated on individual output quality. A familiar with persistent memory can be evaluated on whether it is building accurate, useful, durable knowledge over time — a much richer and more meaningful signal.

**Context compounding.** A familiar that knows your projects, conventions, ongoing questions, and history becomes genuinely more useful over time. The value compounds. Stateless agents reset; familiars grow.

### Architectural requirements

- A `MEMORY.md` file (or equivalent) that persists across sessions. Protected from the self-improvement loop.
- A daily/session log structure for raw notes.
- A maintenance process (heartbeat or equivalent) that reviews notes and promotes to long-term memory.
- Memory conventions (how notes are structured) on the editable surface — the familiar can propose format improvements. `MEMORY.md` content itself is protected.

---

## 5. Human Belonging

### What it means

A familiar belongs to a specific person or team. Not in the sense of access control. In the sense of *orientation*: the familiar's purpose, memory, and optimization target are organized around serving that person's actual work, not averaged across a user population.

Sage was built for Val. Sage's memory contains Val's projects and context. Sage's purpose is shaped around the kind of work Val does. That binding is explicit in `ward.toml` (`meta.person = "val"`) and protected by Ward invariants (`familiar.person == 'val'`).

### Why it matters

**Accountability.** A familiar bound to a specific person cannot drift toward serving platform interests, training data preferences, or the next user who connects. It serves the person it belongs to. That constraint is structural, not aspirational.

**Optimization target.** Generic assistants optimize for a user population. Familiars optimize for one person. These produce different outputs on questions where the person's context matters — which, for serious work, is most questions.

**Trust through specificity.** You trust a collaborator who knows you more than you trust one who treats you as a generic user. Human belonging is what creates the conditions for that kind of trust.

**The binding is protected.** This is crucial. The person binding — who the familiar belongs to — cannot be changed by the familiar itself, by the self-improvement loop, or by any programmatic process. Changing it requires human authorization. This is what prevents the familiar from being reassigned, redirected, or co-opted without the person's knowledge.

### Architectural requirements

- `meta.person` declared in `ward.toml`.
- Ward invariant: `familiar.person == '<person>'`.
- Memory and purpose organized around the person's actual work context.
- Person binding in the protected surface: not modifiable without explicit human authorization.
- `USER.md` (if present) protected — this is the familiar's knowledge about its person.

---

## The Properties as a System

The five properties form a system, not a checklist.

- **Named Identity** makes the familiar knowable.
- **Defined Purpose** makes the familiar useful (and interpretably limited).
- **Bounded Authority** makes the familiar safe to trust with access.
- **Persistent Memory** makes the familiar genuinely better over time.
- **Human Belonging** makes the familiar accountable to a person rather than a platform.

Remove any one and the system weakens. A familiar with named identity but no bounded authority is a named risk. A familiar with persistent memory but no human belonging is a knowledge store that serves an unknown optimization target. All five are required. That is the contract.
