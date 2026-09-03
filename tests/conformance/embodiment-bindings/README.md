# Embodiment-binding conformance vectors

Each JSON file is one independently consumable
`familiar.embodiment_binding.v1` document. Run an individual vector with:

```bash
node validators/validate.js --embodiment-binding path/to/vector.json
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
