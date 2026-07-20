# 18 Duplicate Tier Field

Expected: FAIL. approval_tiers.auto repeats the `gate` field with conflicting values, so the validator must reject the ambiguous duplicate authority field instead of accepting the later value.
