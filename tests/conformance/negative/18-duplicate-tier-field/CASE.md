# 18 Duplicate Tier Field

Expected: FAIL. approval_tiers.auto repeats the canonical `gate` field across bare and quoted spellings, so the validator must reject the ambiguous duplicate authority field instead of accepting the later value.
