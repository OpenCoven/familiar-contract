# Validator — familiar-contract

A zero-dependency Node.js CLI that checks a familiar directory for familiar-contract v0.4.0 structural conformance.

## Requirements

- Node.js 16+ (no npm install required — no external dependencies)

## Usage

```bash
node validate.js <path-to-familiar-directory>
```

### Examples

```bash
# Validate the canonical Sage example
node validate.js ../examples/sage

# Validate the minimal Lumen example
node validate.js ../examples/minimal

# Validate your own familiar
node validate.js /path/to/your/familiar
```

### Help

```bash
node validate.js --help
```

## What It Checks

| File | Required Fields | Property |
|---|---|---|
| `SOUL.md` | `## I am <Name>`, `## Core Work`, `## What I Am Not`, `## My Boundaries`, purpose declaration | Named Identity, Defined Purpose |
| `IDENTITY.md` | Name, `**Creature:**` field, purpose description | Named Identity |
| `ward.toml` | `[meta]` with familiar + person + version, `[protected]` with SOUL.md/IDENTITY.md/MEMORY.md/ward.toml + invariants, `[editable]` with paths, `[approval_tiers]` with auto + human_review | Bounded Authority, Human Belonging |
| `MEMORY.md` | Existence | Persistent Memory (required; missing is a violation) |
| Cross-file | Name consistency between SOUL.md and ward.toml | Consistency |

## Output

```
familiar-contract validator v0.4.0
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

This validator checks **structural conformance** — the presence and format of required declarations. Full conformance also requires runtime Ward enforcement beyond this file-level check, and missing `MEMORY.md` is a violation, not a warning.

## For CI Integration

```yaml
# .github/workflows/familiar-validate.yml
- name: Validate familiar
  run: node validators/validate.js ./my-familiar-directory
```

Exit code 1 on failure will fail the CI step.
