# 21 Prototype Tier

Expected: FAIL. ward.toml declares `[approval_tiers.__proto__]`, so the validator must fail closed with an unknown-tier violation instead of crashing on JavaScript prototype lookup.
