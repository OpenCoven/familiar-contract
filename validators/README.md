# Validator — familiar-contract

A Node.js CLI that checks one claimant directory for the familiar-contract v0.7.0 structural requirements. It parses `ward.toml` with `@iarna/toml` and validates the resulting object against `schemas/ward.schema.json` with Ajv before evaluating Ward semantics.

## Requirements

- Node.js 16+
- `npm install` from the repository root

## Usage

```bash
node validators/validate.js <path-to-familiar-directory>
node validators/validate.js --embodiment-binding <path-to-binding.json> \
  --historical-bundle <path-to-bundle.json> \
  --trusted-ledger <path-to-ledger.json>

# Optionally verify a separately signed revocation recorded after commit:
node validators/validate.js --embodiment-binding <path-to-binding.json> \
  --historical-bundle <path-to-bundle.json> \
  --trusted-ledger <path-to-ledger.json> \
  --post-commit-revocation <path-to-revocation.json>
```

Embodiment options are parsed strictly. Unknown or duplicate flags, trailing
arguments, and sidecar flags without a value fail closed.

All profile signatures use Ed25519 over the 32 raw SHA-256 digest octets. The
lowercase hexadecimal digest strings carried in JSON are decoded before
verification; their UTF-8 text is not the signature message.

### Examples

```bash
# Validate the canonical Sage example
node validators/validate.js examples/sage

# Validate the minimal Lumen example
node validators/validate.js examples/minimal

# Validate your own claimant directory
node validators/validate.js /path/to/your/familiar
```

### Help

```bash
node validators/validate.js --help
```

## What It Checks

| File | Required Fields | Property |
|---|---|---|
| `SOUL.md` | `## I am <Name>`, `## Core Work`, `## What I Am Not`, `## My Boundaries`, purpose declaration | Named Identity, Defined Purpose |
| `IDENTITY.md` | Name, `**Creature:**` field, purpose description | Named Identity |
| `ward.toml` | Standards-compliant TOML syntax and JSON Schema validation, then `[meta]` with familiar + person + version, `[protected]` with SOUL.md/IDENTITY.md/MEMORY.md/ward.toml + invariants, `[editable]` with paths, `[approval_tiers]` with auto + human_review | Bounded Authority, Human Belonging |
| `MEMORY.md` | Existence | Persistent Memory (required; missing is a violation) |
| `audit/*.json` | Optional §5.6 audit-record samples validated against `schemas/audit-record.schema.json` (§5.6.1 hash encodings); absence of `audit/` is not a violation, a present-but-empty `audit/` is | Bounded Authority, Persistent Memory |
| Cross-file | Name consistency between SOUL.md and ward.toml | Consistency |
| Embodiment binding | `familiar.embodiment_binding.v1` schema, canonical digest, lineage, dispatch eligibility, principal, alias, revocation, and immutable-commit semantics | Exact execution embodiment |

## Output

The Property Coverage block attributes every violation to the five properties fail-closed: a FAIL run always marks at least one property ✗, and a violation no attribution rule recognizes marks every property its source file underwrites (e.g. an unreadable `ward.toml` marks both Bounded Authority and Human Belonging).

```
familiar-contract validator v0.7.0
Checking: /path/to/familiar

Property Coverage:
  ✓ Named Identity
  ✓ Defined Purpose
  ✓ Bounded Authority
  ✓ Persistent Memory
  ✗ Human Belonging

✗ FAIL — 1 violation:

  ✗ ward.toml › meta.person
    meta.person is missing. Human Belonging requires a declared person binding.
```

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | PASS — all checks pass |
| `1` | FAIL — one or more violations |

There are no warnings for missing required files; `MEMORY.md` absence is a failure.

## What It Does Not Check

- Whether SOUL.md's values are coherent or meaningful (it checks structure, not quality)
- Whether the Ward is actually enforced at runtime (that requires a Ward daemon)
- Whether the familiar's behavior matches its declared purpose (behavioral compliance requires runtime evaluation)

This validator checks whether one claimant directory satisfies the required file-level declarations for v0.7.0. That claimant-directory run is necessary, but not sufficient, for a structural-conformance claim: you must also run `bash tests/conformance/run-conformance.sh` so the bundled reference validator is shown to accept the positive fixtures and reject the negative fixtures for the same contract version. Full conformance additionally requires runtime Ward enforcement beyond this file-level check, and missing `MEMORY.md` is a violation, not a warning.

The explicit embodiment-binding mode validates one portable JSON record. It
fails closed for non-unique aliases, stale or non-active revisions, non-verified
history used as current authority, principal mismatches, digest tampering, and
pre-commit revocation. Historical evidence is classified deterministically:
retained supplied bytes are verified, live redacted evidence is unverifiable,
tombstoned or erased evidence is unavailable, a missing bundle is degraded,
and a denied read is unavailable. None of the non-verified states grants
authority.

Pass a detached, independently consumable historical identity bundle to
recompute the retained component and bundle digests and verify the binding:

```bash
node validators/validate.js --embodiment-binding binding.json \
  --historical-bundle historical-bundle.json
```

Bindings use an Ed25519 DER/SPKI public key and base64 signature over a
SHA-256 JCS binding digest. The digest excludes the complete `integrity` and
`authentication` members, so verification is non-circular; no private key is
accepted or stored in the profile.

Each predecessor transition separately signs the relationship, predecessor
bundle digest, and successor root/revision. This lets the validator distinguish
continuation, restoration, fork/new-root, and succession without trusting
unstructured lineage prose.

## For CI Integration

```yaml
# .github/workflows/familiar-validate.yml
- name: Validate claimant directory
  run: npm ci && node validators/validate.js ./my-familiar-directory

- name: Run bundled conformance suite
  run: npm test
```

Both steps must pass for a reproducible v0.7.0 structural-conformance claim. The first checks the claimant directory; the second verifies the bundled reference validator and fixtures. Exit code 1 on either step will fail CI.
