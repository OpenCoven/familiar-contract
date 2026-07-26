# 37 Bad Entry Hash

This case is an otherwise-compliant minimal familiar directory that bundles an audit-record sample whose `entry_hash` uses a prefixed form (`sha256:<hex>`) instead of the RFC-0001 §5.6.1 canonical textual encoding (exactly 64 lowercase hexadecimal characters, no algorithm prefix). The validator MUST reject it: prefixed hash strings are the survey-documented drift the encoding rule exists to close, and a `memory_entry_admitted` fingerprint that foreign implementations cannot parse uniformly breaks cross-implementation provenance verification.
