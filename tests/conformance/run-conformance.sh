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

  output_file="$SUITE_DIR/.conformance-output.$$"
  node "$VALIDATOR" --embodiment-binding "$vector_path" >"$output_file" 2>&1
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
    if [ "$status" -ne 0 ]; then
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

for vector_path in "$SUITE_DIR"/embodiment-bindings/positive/*.json; do
  [ -f "$vector_path" ] || continue
  run_binding_case "$vector_path" "pass" "embodiment-bindings/positive/$(basename "$vector_path")"
done

for vector_path in "$SUITE_DIR"/embodiment-bindings/negative/*.json; do
  [ -f "$vector_path" ] || continue
  run_binding_case "$vector_path" "fail" "embodiment-bindings/negative/$(basename "$vector_path")"
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
