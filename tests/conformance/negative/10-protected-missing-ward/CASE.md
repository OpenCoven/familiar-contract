# 10 Protected Missing Ward

Violated property: Bounded Authority. Validator check: `validateWard` should report `ward.toml › protected.files` because `ward.toml` is not included in `[protected].files`. Expected behavior: `node validators/validate.js <case>` exits non-zero with an error pattern like `ward.toml must be in the protected files list`.
