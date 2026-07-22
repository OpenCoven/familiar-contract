# Hash Algorithm and Entry Canonicalization Design

**Status:** Proposed — survey and design; normative text deferred to a v0.5.0 draft minor
**Date:** 2026-07-22
**Bead:** `threads-5vn`
**Target:** RFC-0001 §5.6 amendment (draft minor, after `threads-vfk` freezes §6.3)

## Purpose

Resolve the A-6 residual from the v0.3.0 provenance review: RFC-0001 §5.6
requires attestation referents to resolve against the append-only audit log,
but never specifies the hash algorithm or the canonical byte encoding of the
things being hashed. Two independent conforming implementations therefore
cannot verify each other's provenance chains — each can only verify chains it
wrote itself.

This document surveys what the reference implementations already do, proposes
the normative choices, and defines the conformance surface. It is
non-normative. Under §6.3's Draft-stage rule the normative amendment is a
**draft minor (v0.5.0)** because it adds MUST-level requirements; it must land
after `threads-vfk` freezes §6.3 so the version rule it lands under is itself
ratified.

## Survey: hashing as deployed (2026-07-22)

Two repositories implement the contract today: `coven-threads`
(`coven-threads-core`, the gate validator crate) and `coven` (the daemon that
imports it). Their practice is consistent in shape: **BLAKE3 for structural
commitments, SHA-256 for raw content fingerprints.**

### Structural commitments (BLAKE3, domain-tagged, length-prefixed)

| Artifact | Construction | Site |
| --- | --- | --- |
| `ward_hash` (§5.6) | `weave_hash` = Merkle root over thread leaf commitments in canonical `(surface_path, writer_id)` order | `coven-threads-core/src/weave.rs` |
| Merkle interior | `H(NODE_TAG ‖ left ‖ right)`; leaves `H(LEAF_TAG ‖ u64-BE len ‖ payload)`; odd node promoted unchanged; `EMPTY_TAG` for the empty weave | `coven-threads-core/src/manifest.rs` |
| Ward-manifest entry hash | `H(LEAF_TAG ‖ "manifest-entry\n" ‖ surface_id ‖ NUL ‖ content)` — binds surface identity into the entry | `coven-threads-core/src/manifest.rs`, daemon `threads_gate.rs` |
| Evidence replay hash | domain tag `coven-threads:proposal-evidence:v2`, sorted entries (order-independent), **u64-LE** length prefixes | `coven-threads-core/src/surface_regions.rs` |
| Materialized-diff commitment | `coven-threads:materialized-diff-commitment:v1`, per-surface before/after as `0x01 ‖ len ‖ blake3(bytes)` or `0x00` absent | same |
| Proposal recovery commitment | BLAKE3 over `serde_json::to_vec(config)` + authority JSON + sorted targets, length-prefixed | daemon `api.rs` |
| Serialization-contract hash | `blake3(SERIALIZATION_CONTRACT)` — `PortabilityMarker::contract_hash` | `coven-threads-core/src/portability.rs`, daemon `threads_gate.rs` |

Domain tags in use: `coven-threads:leaf:v1`, `coven-threads:node:v1`,
`coven-threads:empty:v1`, `coven-threads:proposal-evidence:v2`,
`coven-threads:materialized-diff-commitment:v1`, plus the `thread:v2` leaf
commitment tag. Field framing is `put_field` = length-prefix-then-bytes
("delimiter framing is forgeable" — `manifest.rs`).

### Content fingerprints (SHA-256, lowercase hex)

| Artifact | Construction | Site |
| --- | --- | --- |
| `diff_hash` on apply rows (§5.6) | `next_sha256` = SHA-256 of post-write surface bytes; `prev_sha256` rides in `detail` JSON | `coven-threads-core/src/audit.rs`, daemon `ward.rs` |
| Proposal revision hash | SHA-256 over canonical JSON (recursively sorted object keys via `BTreeMap`, `serde_json::to_vec`), bare lowercase hex | daemon `api.rs` |
| Travel profile content hash | `"sha256:<hex>"` — the only prefixed form in either repo | daemon `api.rs` |
| Memory chunk hash | SHA-256 of chunk text, lowercase hex | `coven-memory/src/ingest.rs` |
| Engine archive checksums | SHA-256 | daemon `engine_install.rs` |

### Typed algorithm support

`coven-threads-core::strand::HashAlgo = {Blake3 → "blake3", Sha256 →
"sha256"}` is already a frozen v0.1.1 enum carried by `Strand::ContentHash`.
The dual-algorithm reality is typed, not accidental.

### Storage encodings

- SQLite `ward_audit`: `ward_hash BLOB NOT NULL`, `diff_hash BLOB` — raw
  32-byte values, no hex.
- SQLite `ward_audit.detail` (TEXT/JSON): hex-encoded hashes as 64-char
  lowercase strings (`prev_sha256`, `evidence_replay_hash_hex`), guarded by
  schema SQL (`json_type` = text, `length` = 64).
- Wire/JSON: lowercase hex throughout; exactly one site uses a `sha256:`
  prefix.

### Inconsistencies found (to be resolved by the amendment)

1. **Length-prefix endianness**: `manifest.rs` frames with u64-**BE**;
   `surface_regions.rs` frames with u64-**LE**. Each is internally consistent
   and domain-tagged, so there is no collision risk today, but a normative
   spec must pick one for *new* constructions and grandfather the existing
   tagged forms (their domain tags already version them).
2. **Hex prefixing**: one site emits `sha256:<hex>`; everything else emits
   bare lowercase hex. The RFC should standardize bare lowercase hex and
   reserve prefixed forms for contexts that are algorithm-ambiguous.
3. **`entry_hash` name collision**: the daemon's `ward_manifest.entry_hash`
   (a BLAKE3 manifest-entry hash) and RFC §5.6's `entry_hash` on
   `memory_entry_admitted` events (a memory-entry fingerprint) are different
   objects with the same name. The amendment must define §5.6 `entry_hash`
   precisely enough that the collision cannot mislead implementers.

## Proposed normative design

### D-1. Algorithm assignment (two algorithms, by role)

- **Structural commitments** (`ward_hash`, manifest entry hashes, any Merkle
  or multi-field commitment): **BLAKE3**, 32-byte output. Rationale: already
  universal in both repos for this role; domain-tag discipline is established;
  keyed/derive modes available for future needs.
- **Raw content fingerprints** (`diff_hash`, §5.6 `entry_hash`, chunk and
  archive checksums): **SHA-256**, 32-byte output. Rationale: already
  universal in this role; ubiquitous external tooling (`shasum -a 256`) lets a
  human or foreign implementation verify a content fingerprint with no coven
  code at all — which is exactly the cross-implementation property A-6 asks
  for at the content layer.

The split is principled, not historical accident: fingerprints must be
reproducible by anything that can read bytes; commitments must be
collision-resistant *under adversarial framing*, which is what the
domain-tag + length-prefix discipline provides.

`HashAlgo` remains the extension point; implementations MUST reject
attestations naming an algorithm they do not support rather than skipping
verification (fail-closed, consistent with Gate 4).

### D-2. Canonical encodings per §5.6 field

| Field | Definition |
| --- | --- |
| `ward_hash` | The 32-byte weave commitment: BLAKE3 Merkle root per the `coven-threads:{leaf,node,empty}:v1` construction over thread leaf commitments in canonical `(surface_path, writer_id)` order. The existing implementation is adopted as the reference construction; its domain tags version it. |
| `diff_hash` | SHA-256 of the exact post-write bytes of the touched surface. Deployed practice populates it on apply rows only (`for_verdict` sets it to null); if a future amendment populates it on proposal verdict rows, it MUST be defined then as SHA-256 over the canonical materialized-diff bytes, not left implementation-defined. |
| `entry_hash` (memory) | SHA-256 of the admitted entry's canonical bytes: the exact UTF-8 byte sequence appended to the memory surface, without trailing-newline normalization. No JSON wrapper, no metadata — the bytes a foreign verifier can re-read from the surface and re-hash. |
| `source_attestation` | Resolves a referent by `(event_type, id)` in the audit log; verification MUST re-check the referent's own required hash fields (per §5.6 table) before accepting. |

### D-3. Encoding conventions

- Binary storage (BLOB columns, wire structs): raw 32 bytes.
- Textual encoding (JSON, TOML, logs): **lowercase hex, 64 chars, no
  prefix**. Where the algorithm is not fixed by the field's definition, the
  field is accompanied by an `algorithm` discriminator (`"blake3"` |
  `"sha256"` — the `HashAlgo` tags), never a prefixed string.
- New multi-field commitments MUST use domain tags of the form
  `coven-threads:<purpose>:v<N>` and u64-**BE** length prefixes (`put_field`
  framing). Existing v1/v2 tagged constructions are grandfathered as-is —
  their tags are their version.

### D-4. Cross-implementation verification statement (the A-6 closure)

The amendment adds to §5.6, in substance:

> A conforming implementation, given only the append-only audit log and the
> surface bytes it references, MUST be able to recompute and verify every
> `ward_hash`, `diff_hash`, and `entry_hash` in the log using the
> constructions above, regardless of which implementation wrote them. An
> entry whose recorded hash does not match recomputation MUST be treated as
> tamper evidence, not as a soft mismatch.

## Conformance coverage plan

New negative fixtures (split between structural schema/validator checks and runtime-only obligations per §8.2):

1. Structural (schema/validator): a `memory_entry_admitted` record whose `entry_hash` is not a 64-char lowercase-hex SHA-256 value → validator rejects.
2. Runtime (documented as runtime-only obligations, like Gate-1
   preconditions): recorded `entry_hash` ≠ recomputed hash of admitted bytes
   → admission chain verification fails; attestation naming an unsupported
   algorithm → rejected, not skipped.

Positive fixtures gain worked hash values so a second implementation can
check its own recomputation against known-good vectors (test-vector role).

## Migration impact

- `coven-threads-core` / daemon: **no behavioral change** — the proposal
  codifies deployed practice. The u64-LE evidence construction keeps its v2
  tag; the BE rule applies to future tags only.
- The `sha256:`-prefixed travel-profile hash is out of RFC scope (not a §5.6
  field) but should migrate to bare hex + discriminator for consistency.
- `WARD_AUDIT_SCHEMA` v020 already guards 64-char hex TEXT in `detail` and
  BLOB hash columns — no schema migration required.

## Sequencing

1. PR #7 (v0.4.1) merges and tags.
2. `threads-vfk` freezes §6.3 (so the draft-minor rule this lands under is
   previously ratified — the A-7 lesson).
3. v0.5.0 draft minor: §5.6 normative text per D-1..D-4, conformance
   fixtures, CHANGELOG. Breaking-change rationale per §6.3: new MUSTs on
   fields that were previously implementation-defined; migration is a no-op
   for the reference implementation and a documented recompute check for any
   other.
