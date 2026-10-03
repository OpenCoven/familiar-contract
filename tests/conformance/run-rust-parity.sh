#!/bin/bash
# Runs every embodiment-binding vector through both validators and requires
# the same verdict and the same set of error codes from each:
#   node validators/validate.js --embodiment-binding ...
#   crates/familiar-contract (example `validate-embodiment`)
# Sidecars are wired exactly as run-conformance.sh wires them. The two CLI
# misuse cases must be refused by both. Then rust-differential.js compares
# the two on mutants of the vectors (pass --all for every vector's mutants).
# Needs Node (after `npm ci`) and Cargo.

set -u

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SUITE_DIR="$ROOT_DIR/tests/conformance/embodiment-bindings"
VALIDATOR="$ROOT_DIR/validators/validate.js"

cargo build --quiet --locked --manifest-path "$ROOT_DIR/Cargo.toml" \
  --example validate-embodiment --example verify-batch || exit 1
RUST_VALIDATOR="$ROOT_DIR/target/debug/examples/validate-embodiment"

compared=0
mismatched=0

codes() {
  grep -o '\[E_[A-Z_]*\]' | sort -u | tr '\n' ' '
}

compare() {
  label=$1
  shift
  node_output=$(node "$VALIDATOR" "$@" 2>&1)
  node_status=$?
  rust_output=$("$RUST_VALIDATOR" "$@" 2>&1)
  rust_status=$?
  node_codes=$(printf '%s\n' "$node_output" | codes)
  rust_codes=$(printf '%s\n' "$rust_output" | codes)
  compared=$((compared + 1))
  if [ "$node_status" -ne "$rust_status" ] || [ "$node_codes" != "$rust_codes" ]; then
    mismatched=$((mismatched + 1))
    printf 'MISMATCH %s\n  node (exit %s): %s\n  rust (exit %s): %s\n' \
      "$label" "$node_status" "$node_codes" "$rust_status" "$rust_codes"
  else
    printf 'same %s (exit %s) %s\n' "$label" "$node_status" "$node_codes"
  fi
}

for kind in positive negative; do
  for vector_path in "$SUITE_DIR/$kind"/*.json; do
    name=$(basename "$vector_path")
    args=(--embodiment-binding "$vector_path")
    [ -f "$SUITE_DIR/bundles/$name" ] && args+=(--historical-bundle "$SUITE_DIR/bundles/$name")
    [ -f "$SUITE_DIR/ledgers/$name" ] && args+=(--trusted-ledger "$SUITE_DIR/ledgers/$name")
    [ -f "$SUITE_DIR/revocations/$name" ] && args+=(--post-commit-revocation "$SUITE_DIR/revocations/$name")
    compare "$kind/$name" "${args[@]}"
  done
done

misuse_refused() {
  label=$1
  shift
  compared=$((compared + 1))
  if node "$VALIDATOR" "$@" >/dev/null 2>&1 || "$RUST_VALIDATOR" "$@" >/dev/null 2>&1; then
    mismatched=$((mismatched + 1))
    printf 'MISMATCH %s: CLI misuse was accepted\n' "$label"
  else
    printf 'same %s (both refused)\n' "$label"
  fi
}

misuse_refused "cli/missing-sidecar-value" \
  --embodiment-binding "$SUITE_DIR/positive/16-missing-historical-bundle.json" --historical-bundle
misuse_refused "cli/unknown-sidecar-option" \
  --embodiment-binding "$SUITE_DIR/positive/15-revocation-after-commit.json" \
  --post-commit-revokation "$SUITE_DIR/revocations/15-revocation-after-commit.json"
misuse_refused "cli/duplicate-sidecar-option" \
  --embodiment-binding "$SUITE_DIR/positive/15-revocation-after-commit.json" \
  --trusted-ledger "$SUITE_DIR/ledgers/15-revocation-after-commit.json" \
  --trusted-ledger "$SUITE_DIR/ledgers/15-revocation-after-commit.json"

printf '\nParity: %s compared, %s mismatched\n\n' "$compared" "$mismatched"

node "$ROOT_DIR/tests/conformance/rust-differential.js" \
  "$ROOT_DIR/target/debug/examples/verify-batch" "$@"
differential=$?

[ "$mismatched" -eq 0 ] && [ "$differential" -eq 0 ]
