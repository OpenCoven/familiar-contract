# 04 No Protected Section

Violated property: Bounded Authority. Validator check: `validateWard` should report `ward.toml › [protected]` because the protected surface section is missing. Expected behavior: `node validators/validate.js <case>` exits non-zero with an error pattern like `[protected] section missing`.
