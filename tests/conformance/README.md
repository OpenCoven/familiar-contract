# Familiar Contract v0.4 Conformance Suite

This directory is the testable form of the Familiar Contract: a set of fixture familiars that verify the reference validator against the bundled positive and negative cases for the current RFC-0001 draft. It does not validate a claimant directory by itself.

Run the full suite from the repository root:

```bash
npm install
npm test
```

Convention: `positive/<n>-<name>/` cases should PASS when run with `node validators/validate.js <case>`. `negative/<n>-<name>/` cases should FAIL for the documented reason in that case's `CASE.md`. Structural conformance for a claimant directory additionally requires `node validators/validate.js <directory>` and `npm test`.

A claim of v0.4.0 structural conformance = the claimant directory passes `node validators/validate.js <directory>` and this fixture suite passes under `npm test`.
