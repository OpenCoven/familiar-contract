#!/bin/bash
# Runs the full conformance suite.
# For each positive/<case>: `node validators/validate.js <case>` MUST exit 0
# For each negative/<case>: `node validators/validate.js <case>` MUST exit non-zero
# The audit-record lane: `node validators/check-audit-records.js` MUST exit 0
# (positive records validate + worked vectors recompute; negative records fail).
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

  output_file=$(mktemp "${TMPDIR:-/tmp}/familiar-conformance.XXXXXX")
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

audit_records_status="READY"
if ! node "$ROOT_DIR/validators/check-audit-records.js"; then
  audit_records_status="BROKEN"
  unexpected=$((unexpected + 1))
  details="${details}
audit-record lane misbehaved (see check-audit-records.js output above)"
fi

embodiment_status="READY"
if ! node "$ROOT_DIR/validators/check-embodiment-binding.js"; then
  embodiment_status="BROKEN"
  unexpected=$((unexpected + 1))
  details="${details}
embodiment-binding lane misbehaved (see check-embodiment-binding.js output above)"
fi

printf '\nResults:\n'
printf '  positive: %s/%s passed\n' "$positive_passed" "$positive_total"
printf '  negative: %s/%s failed correctly\n' "$negative_failed" "$negative_total"
printf '  audit-records: %s\n' "$audit_records_status"
printf '  embodiment-binding: %s\n' "$embodiment_status"
printf '  unexpected: %s\n' "$unexpected"

if [ "$unexpected" -eq 0 ]; then
  printf 'READY\n'
  exit 0
fi

printf 'BROKEN: %s unexpected%s\n' "$unexpected" "$details"
exit 1
