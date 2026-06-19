# 05 Protected Missing SOUL.md

Violated property: Bounded Authority. Validator check: `validateWard` should report `ward.toml › protected.files` because `SOUL.md` is not included in `[protected].files`. Expected behavior: `node validators/validate.js <case>` exits non-zero with an error pattern like `SOUL.md must be in the protected files list`.
