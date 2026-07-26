# coven-memory Promotion Schema (v1)

**Status:** Locked 2026-07-24 (M1, bead cmem-6gy) · **Owner:** Echo (memory lane)
**Canonical location:** this file (relocated from Echo's workspace per BLOCKER-1,
Nova concurrence 2026-07-11 §10.11). Implementations pin a version of this file.
**Derivation:** Coven Memory Layer Authoritative Plan v1 §2.2/§2.3 + §10 addendum.
**Amendment protocol:** every change requires the §11.5 runtime-portability audit
answered in writing in the PR, plus Echo sign-off (schema owner). Ward-adjacent
changes additionally require Nova review.

---

## §11. Coven Promotion Schema (M1 lock — v1)

Locked 2026-07-24 per Authoritative Plan v1 §2.2/§2.3 + §10 addendum (Echo integration
§10.10, Nova concurrence §10.11). This section is the normative v1 contract for the
promotion layer (`coven memory promote`, implemented in `OpenCoven/coven`).
Relocation target (BLOCKER-1): `OpenCoven/familiar-contract/schemas/coven-memory-schema.md` —
until that PR lands, THIS section is authoritative and the relocated copy must match it.

### §11.0 Preamble — topology and framing

- **Source-authoritative:** files are truth; every index (vector, SQLite, TurboVec) is
  derived. Any tool writing to an index without a corresponding source-file write is a defect.
- **Claims-log framing:** the shared store is a log of *attested claims*, not arbitrated
  truth. Conflicting claims may coexist; supersession is explicit; arbitration is v2+.
- **FAMILIAR_ROOT binding (referent: per-familiar workspace root directory):** all
  source-file validation and `source_context` relativization resolve against FAMILIAR_ROOT.
  Resolution order for the promote surface: `--familiar-root` flag → `COVEN_FAMILIAR_ROOT`
  env var → **fail closed** (explicit error naming both; no silent default — a defaulted
  gate input is a fail-open edge). The ingest crate never sees FAMILIAR_ROOT; the memory
  STORE dir (`~/.coven/memory/`) is a distinct, crate-owned contract path resolved via
  `--index`/`--db` (env fallback for store dir deferred to v1.1).

### §11.1 Required frontmatter (promoted entries)

All fields required at ingest time. Sole exception: a missing `ulid` is GENERATED at
promote time (it is identity assigned by the system, not a claim made by the author —
generation cannot validate a false claim, so it is not a fail-open edge). Every other
missing field, unknown field, or unknown enum value → reject, fail-closed, with
explicit reason. A PRESENT-but-malformed `ulid` is rejected, not regenerated.

```yaml
ulid: 01JEXAMPLE0000000000000000        # generated at promote time if absent
type: coven-fact | architecture-decision | research-synthesis | failure | strategy | harness-artifact
scope: coven                             # exactly "coven" or reject
memory_type: semantic | episodic | procedural   # CoALA axis
created_at: <RFC3339 UTC>
created_by: <familiar-id>
attested_by: <familiar-id | val>         # known ids only, else reject
attested_via: <attestation ULID or FAMILIAR_ROOT-relative path>  # §11.2
title: <human-readable>
source_context: <session-key-class or FAMILIAR_ROOT-relative path>
tags: [<...>]
confidence: high | medium | low
```

**Hard rule:** absolute paths in `source_context` (or any frontmatter field) are rejected
at promotion time. FAMILIAR_ROOT-relative or portable references only. Session references
use the portable class form (e.g. `session://<familiar>/<date>/<slug>`), never
runtime-specific raw session keys (privacy + portability, see SECURITY.md).

**Deferred to v1.1:** `promoted_by`, `checksum` (crate-derived), `refs`, `visibility`,
`ward_hash`, `scope: self-model`.

### §11.2 Attestation file (v1 minimum)

Every promotion writes a companion attestation at
`~/.coven/memory/attestations/<attestation-ulid>.md`:

```yaml
attester: <familiar-id | val>
attestation_type: self | val-in-band | familiar-witness
timestamp: <RFC3339 UTC>
context: <portable reference to where the attestation happened>
body: <free text — why the attester vouches for this claim>
```

Self-attestation is allowed in v1. No cryptographic signature (Ward v0.3 territory).
The promoted entry's `attested_via` points at this file's ULID or path.
**Privacy rule:** attestation bodies never contain raw session keys, chat IDs, or
absolute paths — same guard patterns as the repos enforce (SECURITY.md).

### §11.3 Manifest + supersession semantics

`~/.coven/memory/manifest.jsonl`, append-only, one JSON line per operation.
Operations: `promote | update | archive | supersede`. No hard deletes, ever.

Common fields (all ops): `timestamp`, `ulid`, `operation`, `entry_path`
(FAMILIAR_ROOT-relative), `author`, `attested_by`, `source_session` (portable class form),
`sha256`, `prior_ulid` (null except update/supersede).

**Snapshot semantics:** promoted content is authoritative for the shared store; source-file
edits do NOT propagate. `coven-memory verify` compares manifest-recorded `sha256` against
the current source hash; mismatch = stale (report-only). Supersession is explicit only:
new ULID, `operation: supersede`, `prior_ulid` links back, prior entry retained (append-only).
`archive` moves source to the archive dir and logs the op.

### §11.4 Gate check (v1, fail-closed)

Reject (with explicit reason, never warn-and-proceed) when:
1. `scope` ≠ `coven`
2. `attested_by` not a known familiar id or `val` — authority source: `~/.coven/familiars.toml` `[[familiar]] id` values plus literal `val` (the toml is the canonical roster, runtime-neutral, Coven-owned; not directory names, not a CLI allowlist). Resolution: `--familiars-file` flag → `$COVEN_FAMILIARS_FILE` → `~/.coven/familiars.toml` → fail closed if unreadable/unparseable
3. source file not under FAMILIAR_ROOT — v1 validates against FAMILIAR_ROOT only; Val's designated shared-fact dir is DEFERRED to v1.1 (path never designated; an implemented-but-unbound root would be an unauthorized write path)
4. `ulid` already present in manifest (promotion-layer dedup, above crate chunk dedup)
5. any absolute path in frontmatter
6. any unknown field, enum value, or frontmatter shape
7. FAMILIAR_ROOT unresolvable (§11.0)
8. semantic near-duplicate: cosine similarity ≥ **0.92** (default, tunable flag) against
   existing store → refuse, or proceed only with explicit `--supersede <prior-ulid>`

### §11.5 Runtime-Portability Audit (mandatory)

Every future schema addition and promotion-layer change answers in writing:
*"If Val runs a familiar tomorrow under a different runtime (Codex CLI, Cursor, Claude
Code, CovenCave, bare SSH), does this work without modification?"*
✅ yes → proceed · ⚠️ partial → adapter interface specified as part of the contract ·
❌ no → rejected, rewrite required.
This subsection is itself subject to the audit. Embeddings remain crate-internal
(fastembed/nomic-embed-text-v1.5 local, per plan §1.2) — no runtime coupling.
