# 02 Missing ward.toml

Violated property: Bounded Authority and Human Belonging. Validator check: `validateWard` should report `ward.toml › file` because `ward.toml` is absent. Expected behavior: `node validators/validate.js <case>` exits non-zero with an error pattern like `ward.toml does not exist`.
