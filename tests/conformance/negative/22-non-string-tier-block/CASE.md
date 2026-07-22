# 22 Non-String Tier Block

Expected: FAIL. editable.harness_blocks and approval_tiers.auto.blocks both declare a bare `true`, so the validator must reject non-string block identifiers instead of stringifying them into a matching block name.
