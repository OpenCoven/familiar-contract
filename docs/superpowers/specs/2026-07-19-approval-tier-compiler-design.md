# Approval-Tier Compiler Contract Design

**Status:** Approved for implementation planning  
**Date:** 2026-07-19  
**Bead:** `threads-uqx.12`  
**Target:** Separate Familiar Contract pull request

## Purpose

Resolve the contradiction between RFC-0001's normative string-based
`approval_tiers` declaration and coven-threads Phase 5's typed, daemon-owned
`ApprovalPath` and `SurfaceRegion` semantics.

The existing TOML keys remain the declaration input for compatibility. They do
not become runtime authority objects. A conforming runtime must compile them
deterministically into typed policy or reject the Ward at load time.

## Normative compilation model

The RFC and `schemas/ward.schema.json` will define one compiler contract:

| Declaration | Typed result |
| --- | --- |
| `approval_tiers.auto` | `ApprovalPath::AutoRegression` |
| `approval_tiers.familiar_review` | `ApprovalPath::FamiliarCoherence` |
| `approval_tiers.human_review` | `ApprovalPath::HumanApproval` |
| `approval_tiers.human_required` | `ApprovalPath::HumanApprovalWithRationale` |
| `blocks[]` | Validated references to daemon-known `SurfaceRegionId` values |
| `gate` | Required constant for the enclosing approval path |
| `human_veto_window_hours` | Delayed-apply `VetoWindow` duration |

`human_veto_window_hours` is valid only for `auto` and `familiar_review`.
Veto windows never authorize provisional apply. Deadline expiry triggers
evidence replay and Gate-4 revalidation before any write.

The declaration does not derive `Channel`. `Channel` remains the independent
load and enforcement axis defined by coven-threads Phase 0.

## Fail-closed validation

Ward loading must reject:

- unknown approval-tier keys;
- unknown fields within a tier object;
- missing required tier definitions;
- missing or mismatched `gate` constants;
- duplicate or empty `blocks` entries;
- blocks without a daemon-known `SurfaceRegionId` mapping;
- veto fields on `human_review` or `human_required`;
- zero, negative, non-integer, or otherwise invalid veto durations;
- any declaration combination without one deterministic typed result.

Tier objects will use `additionalProperties: false`. The schema remains the
structural first line of defense; the RFC defines semantic checks that JSON
Schema cannot prove, especially daemon-known region resolution.

## Protected-surface boundary

Approval-path compilation applies only to proposal-eligible editable surfaces.
RFC-0001 Gates 1, 2, and 4 continue to reject proposals whose declared or
materialized diff touches the protected surface.

Principal-authorized Ward or protected-surface updates remain a separate,
audited authority path outside the proposal pipeline. No compiled
`ApprovalPath` can promote a protected-target proposal.

## Repository changes

The implementation PR will keep normative artifacts synchronized:

1. Amend RFC-0001 with the compiler table, fail-closed rules, veto semantics,
   and protected-surface exclusion.
2. Tighten `schemas/ward.schema.json` to reject unknown tier fields and invalid
   structural combinations.
3. Update explanatory Ward documentation where it describes approval tiers.
4. Add conformance fixtures and validator behavior for the new contract.
5. Add a changelog/version note explaining the compatible declaration surface
   and stricter load-time validation.

The reference validator uses `@iarna/toml` for TOML parsing and Ajv v8 for
JSON Schema validation. Contributors install these exact production
dependencies with `npm install` and run the suite with `npm test`.

The PR will not implement coven daemon types or scheduling. It defines the
upstream contract that `threads-uqx.8` must implement.

## Conformance coverage

Add one positive fixture containing all four approval paths, valid gates,
known block names, and valid veto windows.

Add negative fixtures for:

- unknown tier field;
- gate mismatch;
- veto field on a synchronous human tier;
- unknown block name;
- duplicate block name.

Tests must first fail against the current validator/schema behavior, then pass
after the minimum validator and schema changes. Existing positive and negative
fixtures must retain their expected outcomes.

## Compatibility and versioning

This is source-compatible for valid existing declarations because the TOML key
names remain unchanged. It is intentionally behavior-tightening: declarations
that relied on ignored fields, gate drift, unknown blocks, or invalid veto
placement become non-conformant and fail closed.

The PR must state that security rationale explicitly and update the draft RFC
version or changelog according to the repository's existing versioning pattern.

## Review and freeze gates

The separate PR remains draft until its conformance suite is green and a fresh
authority review finds no contradiction with RFC-0001's protected-surface
gates or coven-threads Phase 0.

`threads-uqx.12` closes only after independently attributable Nova and Val
approval and merge. Agent statements, commit trailers, and authorship claims
cannot satisfy those gates.
