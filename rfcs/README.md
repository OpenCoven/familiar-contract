# RFCs — Familiar Contract

This directory contains the **Requests for Comments** that define the Familiar Contract as a formal, testable, citable specification.

## What an RFC is here

An RFC in this repository is a numbered, normative document that:

- **Defines** a piece of architecture (the contract, the Ward, a schema, a process)
- **Uses RFC 2119 keywords** (MUST, SHOULD, MAY, MUST NOT, SHOULD NOT, RECOMMENDED, OPTIONAL) so conformance is unambiguous
- **References** machine-readable artifacts (JSON schemas, TOML examples, validator code) where possible
- **Is versioned** using semantic versioning, with prior versions retained as `RFC-NNNN-vX.Y.md` for reproducibility
- **Is testable** — every normative requirement maps to a check in `tests/conformance/` or a schema constraint

The RFC is the spec. The schemas are the machine-readable form. The conformance suite is the spec made testable. The validator is the enforcement.

## Index

| Number | Title | Version | Status | Notes |
|---|---|---|---|---|
| [RFC-0001](RFC-0001-familiar-contract.md) | The Familiar Contract | v0.4.0 | Draft | Canonical current draft |

## Historical snapshots

Prior draft snapshots are preserved as exact immutable copies of the source git
objects they were extracted from. They exist for reproducibility and citation;
do not edit them in place.

| Snapshot | Version | Status | Source |
|---|---|---|---|
| [RFC-0001-v0.3](RFC-0001-v0.3.md) | v0.3.0 | Historical snapshot | PR #3 head (`15f470146d7a9ab127c916b66e264130e8c4d1bb`) |
| [RFC-0001-v0.2](RFC-0001-v0.2.md) | v0.2.0 | Historical snapshot | `808ae167d8bfea7f2162f84b6f4c9269d319a9b1` |

## Process

The RFC process for this repository is intentionally lightweight at this stage. As the project grows, this section will expand.

**Lifecycle:**

```
Proposed → Draft → Review → Accepted → (Superseded)
```

- **Proposed** — A new RFC document is opened as a PR against this directory. It carries an unassigned number (`RFC-XXXX-<title>.md`).
- **Draft** — Number assigned. The RFC is iterated in PRs. Status is `Draft`. May be substantially revised.
- **Review** — The maintainers signal the RFC is ready for community comment. Open a discussion in GitHub Discussions; gather feedback for at least 14 days.
- **Accepted** — The RFC is merged with `Status: Accepted` and a fixed version number. Backwards-incompatible changes require a new RFC that **Supersedes** the prior one.
- **Superseded** — A later RFC explicitly supersedes this one. The original document is preserved for reproducibility and citation.

**Numbering:** RFCs are numbered in the order they enter `Draft` status. Numbers are not reused.

**Draft versioning:** While an RFC remains `Draft`, it **MUST** stay below `1.0.0`. Draft minor versions (`0.y.0`) **MAY** introduce backward-incompatible conformance changes, but each such release **MUST** document migration impact and security rationale, and consumers **MUST** pin the exact version they implement. Once an RFC reaches `1.0.0` or higher, standard SemVer applies: major for incompatible changes, minor for backward-compatible additions, patch for clarifications and fixes.

**Conformance:** Every normative requirement (a sentence containing MUST or SHOULD) in an Accepted RFC SHOULD have a corresponding test in `tests/conformance/`. RFCs that lack conformance coverage may still be Accepted, but the gap is documented in the RFC itself under an "Open testing gaps" section.

## How to cite an RFC

```
Familiar Contract RFC-0001 v0.4.0, "The Familiar Contract."
OpenCoven, 2026. https://github.com/OpenCoven/familiar-contract/blob/main/rfcs/RFC-0001-familiar-contract.md
```

For academic citation, prefer the tagged release:

```
https://github.com/OpenCoven/familiar-contract/releases/tag/v0.4.0
```

## License

All RFCs in this directory are released under the same MIT license as the repository.
