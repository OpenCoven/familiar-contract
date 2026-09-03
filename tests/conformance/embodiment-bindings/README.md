# Embodiment-binding conformance vectors

Each JSON file is one independently consumable
`familiar.embodiment_binding.v1` document. Run an individual vector with:

```bash
node validators/validate.js --embodiment-binding path/to/vector.json
```

The `positive/` vectors are dispatch-eligible bindings or non-authority
historical records that must validate. The `negative/` vectors must fail
closed. The full set runs under `npm test`.
