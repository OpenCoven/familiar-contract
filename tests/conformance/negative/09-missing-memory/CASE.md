# 09 Missing MEMORY.md

Violated property: Persistent Memory. Validator check: `checkMemory` should reject this because `MEMORY.md` is absent, but the current implementation reports it as a warning only. Expected behavior for v0.2 conformance: `node validators/validate.js <case>` exits non-zero with an error pattern like `MEMORY.md does not exist`.
