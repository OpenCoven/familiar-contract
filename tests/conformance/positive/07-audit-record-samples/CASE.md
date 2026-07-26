# 07 Audit Record Samples

This case extends the full-compliant Sage fixture with bundled RFC-0001 §5.6 audit-record samples under `audit/`, exercising the §5.6.1 canonical encodings end to end. The three samples form a minimal provenance chain — `ward_updated` → `principal_authorized_write` → `memory_entry_admitted`, with the admission's `source_attestation` resolving to the write event — and their hash values are worked test vectors a second implementation can recompute:

- `01-ward-updated.json` `ward_hash` = `blake3("coven-threads:empty:v1")` = `c8fe4585008aa1d49980d18c5cc991bc6d42891bd2117dd24360dc05b36518d9` — the §5.6.1 empty-weave commitment `H(EMPTY_TAG)`, computed from the reference construction in `coven-threads-core`.
- `03-memory-entry-admitted.json` `entry_hash` = SHA-256 of the admitted entry's exact appended bytes — the final line of this fixture's `MEMORY.md`, `- 2026-07-26: Hash canonicalization closes A-6; provenance chains now verify across implementations.` including its trailing newline, with no other normalization = `16b7213c9fa7abbf93a96a9f34b6d753a9cac83309004a4f2576c76f07220d67`. Verify with `tail -1 MEMORY.md | shasum -a 256`.
- `02-principal-authorized-write.json` `diff_hash` = SHA-256 of the exact post-write surface bytes — this fixture's entire `MEMORY.md` = `88c02753a1c204cec6957621be6573c05f219190428fb15432b20650f90ddf2c`. Verify with `shasum -a 256 MEMORY.md`.

All hashes use the canonical textual encoding: exactly 64 lowercase hexadecimal characters, no algorithm prefix.
