# 35 Malformed Ward TOML

`ward.toml` contains an invalid array with two consecutive commas. A standards-compliant TOML parser must reject it as a syntax violation without crashing the validator.
