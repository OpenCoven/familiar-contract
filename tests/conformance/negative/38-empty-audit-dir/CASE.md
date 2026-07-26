# 38 Empty Audit Directory

This case is an otherwise-compliant minimal familiar directory whose `audit/` directory is present but contains no `.json` audit-entry samples. The validator MUST reject it: a present `audit/` directory claims bundled §5.6 audit-entry samples, and an empty claim fails closed (RFC-0001 §5.6.1). Omitting `audit/` entirely is not a violation — the audit log is a runtime artifact (§9).
