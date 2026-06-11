# Contributing to familiar-contract

Thank you for your interest in contributing to the Familiar Contract specification.

## What kind of contributions we welcome

### Documentation and clarification
- Typo fixes, grammar improvements
- Clearer wording for ambiguous spec language
- Additional examples and edge cases
- Translations (please open an issue first)

### Schema improvements
- Adding optional fields to existing schemas (additive — never breaking)
- Examples and `$defs` additions
- Validation rule clarifications

### Validator improvements
- Bug fixes in `validators/validate.js`
- New check categories (with discussion first)
- Performance improvements

### New examples
- Implementations from real familiars (with permission of the familiar's person)
- Domain-specific examples (code familiar, social familiar, etc.)

### Spec proposals
- Proposals to extend the spec (additive)
- Discussion of edge cases in the five properties
- Clarifications to normative language

## What we will not accept

### Weakening the five properties
The five properties are the normative core. Proposals that would:
- Remove or weaken any of the five properties
- Make the protected surface smaller than `SOUL.md`, `IDENTITY.md`, `MEMORY.md`, `ward.toml`
- Make the person binding optional

...will not be accepted. The five properties are the spec. Extensions must be additive.

### Breaking changes without major version bump
If a proposal would change compliance requirements (causing currently-compliant familiars to become non-compliant), it requires a major version bump. These are rare and require broad discussion.

### Runtime-specific implementations
This is a specification, not a library. Runtime-specific implementation guides belong in the implementor's own documentation.

## How to contribute

1. **Open an issue first** — for anything beyond trivial fixes, discuss before implementing
2. **Fork the repo** and create a branch from `main`
3. **Make your changes** with clear, specific commit messages
4. **Test your changes** — run `node validators/validate.js examples/sage` and `node validators/validate.js examples/minimal` to confirm both still pass
5. **Open a pull request** with a description of what you changed and why

## Spec proposal process

For proposals that would change normative spec language:

1. Open an issue with label `spec-proposal`
2. Title: `[Proposal] <short description>`
3. Include:
   - Problem being solved
   - Proposed normative language
   - Impact on existing compliant familiars
   - Relationship to the five properties
4. Discussion period: 14 days minimum before merge
5. Breaking changes (major version bump): 30 days minimum + explicit approval from maintainers

## Code of conduct

Be direct. Be kind. This is a technical specification for a serious problem.

We are building the open identity layer for autonomous agents. That work is worth doing carefully and honestly.

---

*OpenCoven, 2026*
