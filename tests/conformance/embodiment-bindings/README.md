# Embodiment-binding conformance vectors

Each JSON file is one independently consumable
`familiar.embodiment_binding.v1` document. Run an individual vector with:

```bash
node validators/validate.js --embodiment-binding path/to/vector.json \
  --historical-bundle path/to/bundle.json \
  --trusted-ledger path/to/ledger.json
```

The `positive/` vectors are dispatch-eligible bindings or non-authority
historical records that must validate. The `negative/` vectors must fail
closed. The full set runs under `npm test`.

Historical bundle lifecycle results are deterministic:

| Detached bundle evidence | Required history state |
| --- | --- |
| Supplied, live, and all component content retained | `verified` |
| Supplied, live, with one or more components redacted | `unverifiable` |
| Supplied and tombstoned or erased, with no component content | `unavailable` |
| Missing while access was authorized or not requested | `degraded` |
| Missing because verifier access was denied | `unavailable` |

Every supported state has a positive vector. Contradictory component,
retention, tombstone, purge, and history-state combinations are mandatory
negative vectors with an asserted semantic error code in `manifest.json`.
Historical-verification positives also prove that superseded, expired, and
revoked revisions remain auditable records without regaining current authority.

Dispatch vectors also supply verifier-trusted ledger sidecars. Their
observation must be at least as recent as the cache observation, no later than
the final validity check, and at most 300 seconds old at that check. Stale and
future-dated trusted-ledger vectors must fail closed. The effective cache age
is the stricter of the signed `freshnessBoundSeconds` and the fixed 300-second
verifier maximum.

Post-commit revocation is represented only by a separately signed
`familiar.embodiment_revocation.v1` event passed with
`--post-commit-revocation`. The event references the immutable binding digest
and cannot alter the binding's committed preimage.

Bindings, lineage transitions, and revocation events sign the 32 raw SHA-256
digest octets decoded from the lowercase hexadecimal digest. They do not sign
the UTF-8 hexadecimal text.
