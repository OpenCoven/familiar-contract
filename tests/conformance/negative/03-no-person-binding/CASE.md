# 03 No Person Binding

Violated property: Human Belonging. Validator check: `validateWard` should report `ward.toml › meta.person` because `[meta].person` is missing. Expected behavior: `node validators/validate.js <case>` exits non-zero with an error pattern like `meta.person is missing`.
