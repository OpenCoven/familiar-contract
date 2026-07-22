# 09 Missing MEMORY.md

Violated property: Persistent Memory. Validator check: `checkMemory` rejects this because `MEMORY.md` is absent — RFC-0001 §3.4 requires `MEMORY.md` to exist (it MAY be empty or a bootstrap stub) so it can be a member of `[protected].files`. Expected behavior: `node validators/validate.js <case>` exits non-zero with an error pattern like `MEMORY.md does not exist`.
