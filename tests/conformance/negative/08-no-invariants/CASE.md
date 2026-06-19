# 08 No Invariants

Violated property: Bounded Authority and Human Belonging. Validator check: `validateWard` should report `ward.toml › protected.invariants` because `[protected].invariants` is empty. Expected behavior: `node validators/validate.js <case>` exits non-zero with an error pattern like `No invariants declared`.
