# familiar-contract (Rust)

A Rust verifier for the `familiar.embodiment_binding.v1` profile. It ports
`node validators/validate.js --embodiment-binding`: for the same binding and
sidecars it reaches the same verdict and reports the same error codes.

`validate.js` and the schemas under [`schemas/`](../../schemas/) stay the
reference. If the two validators disagree, the Rust crate has the bug.

## Use

The crate reads its schemas from this repository, so it is consumed as a git
dependency pinned to a commit, never from crates.io:

```toml
[dependencies]
familiar-contract = { git = "https://github.com/OpenCoven/familiar-contract", rev = "<commit>" }
```

```rust
use familiar_contract::{verify, EmbodimentInputs};

let violations = verify(&EmbodimentInputs {
    binding: &binding_json,
    historical_bundle: Some(&bundle_json),
    trusted_ledger: Some(&ledger_json),
    post_commit_revocation: None,
});
assert!(violations.is_empty(), "{violations:?}");
```

A sidecar that is `Some` counts as supplied, whatever it contains, just as the
CLI treats a path it was given. Each `Violation` carries the reference error
code (`E_STALE_CACHE`, `E_LINEAGE`, …), the field, and the message.

The crate also exports the digest helpers that an issuer needs
(`binding_digest`, `bundle_digest`, `revocation_digest`, `transition_digest`,
`canonical_json`), plus `is_timestamp` and `spki_public_key`.

## Trust is your policy

The verifier proves that each document is consistent and verifies under the
Ed25519 key **it carries**. That alone does not make the document trusted:

- **Check the signer.** Use `spki_public_key` on `authentication.publicKey`,
  and on each transition's and revocation's key, and require that key to be
  one your system trusts for that `signerId`.
- **Supply your own ledger.** The trusted ledger sidecar must come from your
  own authoritative read, never from the request being verified.

The conformance vectors are signed with throwaway keys whose private halves
are not published, so they test the profile's rules, not your key policy. Test
your trusted-key check separately.

## Fidelity

These JavaScript behaviours are reproduced exactly:

- **Parsing:** JSON that `JSON.parse` accepts, with duplicate keys compared as
  decoded UTF-16. Lone surrogates and non-finite numbers are reported as
  `E_IJSON`, not as syntax errors.
- **Numbers:** each number is normalised to its JavaScript double, so `3.0` is
  the integer `3` and `9007199254740993` is `9007199254740992`.
- **Canonical JSON:** keys are sorted by UTF-16 code unit, and numbers and
  strings print as `JSON.stringify` prints them.
- **Timestamps:** `isTimestamp` uses ASCII digits and rejects years before
  0100. `new Date()` follows V8, which rolls `2026-02-30` over to March 2.
- **Base64:** decoded as Node decodes it, so padding is optional and trailing
  bits are ignored.

## Tests

From the repository root:

```bash
cargo test                                   # unit tests and all 87 vectors
npm ci && bash tests/conformance/run-rust-parity.sh
```

`run-rust-parity.sh` runs every vector, and the CLI misuse cases, through both
validators and requires the same exit status and the same set of codes. It
then runs `rust-differential.js`, which requires the two validators to agree
on mutants of the vectors:

- **Default:** every vector gets text-level mutants: number forms, duplicate
  keys, lone surrogates, and deep nesting. The 22 positive vectors and their
  sidecars are also mutated member by member, and each mutated binding or
  revocation event is re-signed with a fresh key.
- **`--all`:** member-level mutation of all 87 vectors as well. It takes a few
  minutes and about 1.5 GB of scratch space:

  ```bash
  bash tests/conformance/run-rust-parity.sh --all
  ```

Parsing, canonicalization and teardown are iterative, so nesting depth is
limited only by input size. The reference has no stated limit, but its
recursive functions fail at engine-dependent depths. Its parse fails near
4,500 levels with Node 24's default stack, and its `canonicalJson` fails
somewhere between 1,000 and 3,000. Below those depths the two agree; above
them the reference's result depends on the JavaScript engine.
