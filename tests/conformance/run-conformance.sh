#!/bin/bash
# Runs the full conformance suite.
# For each positive/<case>: `node validators/validate.js <case>` MUST exit 0
# For each negative/<case>: `node validators/validate.js <case>` MUST exit non-zero
# The audit-record lane: `node validators/check-audit-records.js` MUST exit 0
# (positive records validate + worked vectors recompute; negative records fail).
# The embodiment-binding lane: every positive JSON vector MUST pass
# `node validators/validate.js --embodiment-binding`, while every negative one
# MUST fail.
# Reports counts and exits 0 only if all cases behave as expected.

set -u

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SUITE_DIR="$ROOT_DIR/tests/conformance"
VALIDATOR="$ROOT_DIR/validators/validate.js"

positive_total=0
positive_passed=0
negative_total=0
negative_failed=0
unexpected=0
details=""

run_case() {
  case_path=$1
  expected=$2
  label=$3

  output_file="$SUITE_DIR/.conformance-output.$$"
  node "$VALIDATOR" "$case_path" >"$output_file" 2>&1
  status=$?

  if [ "$expected" = "pass" ]; then
    positive_total=$((positive_total + 1))
    if [ "$status" -eq 0 ]; then
      positive_passed=$((positive_passed + 1))
      printf 'PASS expected: %s\n' "$label"
    else
      unexpected=$((unexpected + 1))
      details="${details}
positive expected pass but failed: ${label}"
      printf 'UNEXPECTED fail: %s\n' "$label"
      sed 's/^/  /' "$output_file"
    fi
  else
    negative_total=$((negative_total + 1))
    if [ "$status" -ne 0 ]; then
      negative_failed=$((negative_failed + 1))
      printf 'FAIL expected: %s\n' "$label"
    else
      unexpected=$((unexpected + 1))
      details="${details}
negative expected fail but passed: ${label}"
      printf 'UNEXPECTED pass: %s\n' "$label"
      sed 's/^/  /' "$output_file"
    fi
  fi

  rm -f "$output_file"
}

run_binding_case() {
  vector_path=$1
  expected=$2
  label=$3
  expected_code=$4

  output_file="$SUITE_DIR/.conformance-output.$$"
  bundle_path="$SUITE_DIR/embodiment-bindings/bundles/$(basename "$vector_path")"
  ledger_path="$SUITE_DIR/embodiment-bindings/ledgers/$(basename "$vector_path")"
  if [ -f "$bundle_path" ] && [ -f "$ledger_path" ]; then
    node "$VALIDATOR" --embodiment-binding "$vector_path" --historical-bundle "$bundle_path" --trusted-ledger "$ledger_path" >"$output_file" 2>&1
  elif [ -f "$bundle_path" ]; then
    node "$VALIDATOR" --embodiment-binding "$vector_path" --historical-bundle "$bundle_path" >"$output_file" 2>&1
  else
    node "$VALIDATOR" --embodiment-binding "$vector_path" >"$output_file" 2>&1
  fi
  status=$?

  if [ "$expected" = "pass" ]; then
    binding_positive_total=$((binding_positive_total + 1))
    if [ "$status" -eq 0 ]; then
      binding_positive_passed=$((binding_positive_passed + 1))
      printf 'PASS expected: %s\n' "$label"
    else
      unexpected=$((unexpected + 1))
      details="${details}
embodiment positive expected pass but failed: ${label}"
      printf 'UNEXPECTED fail: %s\n' "$label"
      sed 's/^/  /' "$output_file"
    fi
  else
    binding_negative_total=$((binding_negative_total + 1))
    if [ "$status" -ne 0 ] && grep -Fq "[$expected_code]" "$output_file"; then
      binding_negative_failed=$((binding_negative_failed + 1))
      printf 'FAIL expected: %s\n' "$label"
    else
      unexpected=$((unexpected + 1))
      details="${details}
embodiment negative expected fail but passed: ${label}"
      printf 'UNEXPECTED pass: %s\n' "$label"
      sed 's/^/  /' "$output_file"
    fi
  fi

  rm -f "$output_file"
}

printf 'Familiar Contract conformance suite\n\n'

for case_path in "$SUITE_DIR"/positive/*; do
  [ -d "$case_path" ] || continue
  run_case "$case_path" "pass" "positive/$(basename "$case_path")"
done

printf '\n'

for case_path in "$SUITE_DIR"/negative/*; do
  [ -d "$case_path" ] || continue
  run_case "$case_path" "fail" "negative/$(basename "$case_path")"
done

printf '\n'

binding_positive_total=0
binding_positive_passed=0
binding_negative_total=0
binding_negative_failed=0

MANIFEST="$SUITE_DIR/embodiment-bindings/manifest.json"
if ! node -e '
const fs = require("fs"), path = require("path"), manifest = JSON.parse(fs.readFileSync(process.argv[1]));
const root = path.dirname(process.argv[1]);
const expected = new Set([...manifest.positive, ...manifest.negative].map(v => `${v.expected}/${v.file}`));
const actual = new Set(["positive", "negative"].flatMap(kind => fs.readdirSync(path.join(root, kind)).filter(f => f.endsWith(".json")).map(f => `${kind}/${f}`)));
if (!manifest.positive.every(v => v.expected === "positive" && v.errorCode === null) || !manifest.negative.every(v => v.expected === "negative" && typeof v.errorCode === "string") || expected.size !== actual.size || [...expected].some(f => !actual.has(f)) || [...actual].some(f => !expected.has(f))) process.exit(1);
' "$MANIFEST"; then
  unexpected=$((unexpected + 1))
  details="${details}
embodiment manifest is missing, malformed, or does not exactly enumerate every vector"
  printf 'UNEXPECTED manifest: embodiment-bindings\n'
fi

binding_code() {
  node -e 'const m=require(process.argv[1]); const v=[...m.positive,...m.negative].find(v => v.expected === process.argv[2] && v.file === process.argv[3]); process.stdout.write(v ? (v.errorCode || "") : "E_MANIFEST")' "$MANIFEST" "$1" "$2"
}

for vector_path in "$SUITE_DIR"/embodiment-bindings/positive/*.json; do
  [ -f "$vector_path" ] || continue
  name=$(basename "$vector_path")
  run_binding_case "$vector_path" "pass" "embodiment-bindings/positive/$name" "$(binding_code positive "$name")"
done

for vector_path in "$SUITE_DIR"/embodiment-bindings/negative/*.json; do
  [ -f "$vector_path" ] || continue
  name=$(basename "$vector_path")
  run_binding_case "$vector_path" "fail" "embodiment-bindings/negative/$name" "$(binding_code negative "$name")"
done

printf '\n'

audit_records_status="READY"
if ! node "$ROOT_DIR/validators/check-audit-records.js"; then
  audit_records_status="BROKEN"
  unexpected=$((unexpected + 1))
  details="${details}
audit-record lane misbehaved (see check-audit-records.js output above)"
fi

printf '\nResults:\n'
printf '  positive: %s/%s passed\n' "$positive_passed" "$positive_total"
printf '  negative: %s/%s failed correctly\n' "$negative_failed" "$negative_total"
printf '  embodiment positive: %s/%s passed\n' "$binding_positive_passed" "$binding_positive_total"
printf '  embodiment negative: %s/%s failed correctly\n' "$binding_negative_failed" "$binding_negative_total"
printf '  audit-records: %s\n' "$audit_records_status"
printf '  unexpected: %s\n' "$unexpected"

if [ "$unexpected" -eq 0 ]; then
  printf 'READY\n'
  exit 0
fi

printf 'BROKEN: %s unexpected%s\n' "$unexpected" "$details"
exit 1
