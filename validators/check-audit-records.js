#!/usr/bin/env node
/**
 * check-audit-records.js — familiar-contract audit-record conformance checker.
 *
 * Verifies the RFC-0001 §5.6/§5.6.1 audit-record fixtures:
 *
 *   tests/conformance/audit-records/positive/<case>.json
 *     MUST validate against schemas/audit-record.schema.json.
 *     If a companion vector file exists, its SHA-256 MUST equal the
 *     corresponding record field (worked test vectors, §6.1):
 *       <case>.entry   → record.entry_hash
 *       <case>.surface → record.diff_hash
 *
 *   tests/conformance/audit-records/negative/<case>.json
 *     MUST fail schema validation.
 *
 * Exits 0 only if every case behaves as expected. No output contract
 * beyond the exit code is normative; run-conformance.sh aggregates results.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const Ajv = require('ajv');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(ROOT, 'schemas', 'audit-record.schema.json');
const LANE_DIR = path.join(ROOT, 'tests', 'conformance', 'audit-records');

const VECTOR_FIELDS = {
  '.entry': 'entry_hash',
  '.surface': 'diff_hash',
};

function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function listCases(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => path.join(dir, f));
}

function main() {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);

  let failures = 0;
  const report = (ok, label, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures += 1;
  };

  const positives = listCases(path.join(LANE_DIR, 'positive'));
  const negatives = listCases(path.join(LANE_DIR, 'negative'));

  if (positives.length === 0 || negatives.length === 0) {
    console.error('BROKEN: audit-record fixture lane is empty');
    process.exit(1);
  }

  for (const casePath of positives) {
    const label = `audit-records/positive/${path.basename(casePath)}`;
    let record;
    try {
      record = JSON.parse(fs.readFileSync(casePath, 'utf8'));
    } catch (err) {
      report(false, label, `unparseable JSON: ${err.message}`);
      continue;
    }

    if (!validate(record)) {
      const msgs = (validate.errors || [])
        .map((e) => `${e.instancePath || '/'} ${e.message}`)
        .join('; ');
      report(false, label, `expected schema pass: ${msgs}`);
      continue;
    }

    let vectorsOk = true;
    for (const [ext, field] of Object.entries(VECTOR_FIELDS)) {
      const vectorPath = casePath.replace(/\.json$/, ext);
      if (!fs.existsSync(vectorPath)) continue;
      const expected = record[field];
      const actual = sha256Hex(fs.readFileSync(vectorPath));
      if (actual !== expected) {
        vectorsOk = false;
        report(
          false,
          label,
          `vector ${path.basename(vectorPath)}: sha256 ${actual} != ${field} ${expected}`
        );
      }
    }
    if (vectorsOk) report(true, label);
  }

  for (const casePath of negatives) {
    const label = `audit-records/negative/${path.basename(casePath)}`;
    let record;
    try {
      record = JSON.parse(fs.readFileSync(casePath, 'utf8'));
    } catch (err) {
      report(false, label, `negative fixtures must be well-formed JSON that fails the schema, not unparseable JSON: ${err.message}`);
      continue;
    }
    if (validate(record)) {
      report(false, label, 'expected schema rejection but record validated');
    } else {
      report(true, label);
    }
  }

  if (failures > 0) {
    console.log(`BROKEN: ${failures} audit-record case(s) misbehaved`);
    process.exit(1);
  }
  console.log(
    `audit-records: ${positives.length} positive passed, ${negatives.length} negative rejected correctly`
  );
}

main();
