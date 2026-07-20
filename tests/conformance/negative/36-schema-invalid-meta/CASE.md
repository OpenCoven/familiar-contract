# 36 Schema-Invalid Ward Metadata

`meta.version` is a TOML float rather than the required semantic-version string. The TOML is syntactically valid, but it must fail JSON Schema validation.
