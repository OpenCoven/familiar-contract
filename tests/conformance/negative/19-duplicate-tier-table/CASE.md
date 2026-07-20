# 19 Duplicate Tier Table

Expected: FAIL. ward.toml redeclares `[approval_tiers.auto]` using the quoted equivalent `[approval_tiers."auto"]`, so the validator must reject the duplicate approval-tier table instead of merging or overwriting it silently.
