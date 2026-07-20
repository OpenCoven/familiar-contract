# Familiar Contract v0.4 Conformance Suite

This directory is the testable form of the Familiar Contract: a set of fixture familiars that encode the five normative properties as executable validator expectations. It uses the current repository validator as the structural conformance oracle for the current RFC-0001 draft.

Run the full suite from the repository root:

```bash
bash tests/conformance/run-conformance.sh
```

Convention: `positive/<n>-<name>/` cases should PASS when run with `node validators/validate.js <case>`. `negative/<n>-<name>/` cases should FAIL for the documented reason in that case's `CASE.md`.

A claim of v0.4.0 structural compliance = passing every positive case and failing every negative case.
