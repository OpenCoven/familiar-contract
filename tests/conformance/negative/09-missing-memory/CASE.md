# 09 Missing MEMORY.md

Violated property: Persistent Memory. Validator check: `checkMemory` rejects this because `MEMORY.md` is absent (promoted from warning to violation in v0.2.0; RFC-0001 §3.4 makes file presence a MUST). Expected behavior: `node validators/validate.js <case>` exits non-zero with an error pattern like `MEMORY.md does not exist`.
