#!/usr/bin/env node
/**
 * check-embodiment-binding.js — familiar-contract embodiment-binding conformance checker.
 *
 * Verifies the Familiar Embodiment Binding profile fixtures (issue #17):
 *
 *   tests/conformance/embodiment-binding/positive/<case>.json
 *     MUST validate against the schema named by the record's `schema`
 *     discriminator:
 *       familiar.embodiment_binding.v1        → schemas/familiar-embodiment-binding.schema.json
 *       familiar.embodiment_verification.v1   → schemas/familiar-embodiment-verification.schema.json
 *     Binding records MUST recompute their bindingIntegrityDigest: SHA-256 over
 *     the fc-canonical-json:v1 encoding of the record with the
 *     bindingIntegrityDigest member removed (profile §7.3).
 *     If a companion vector file exists, its SHA-256 MUST equal the record's
 *     identityDeclarationDigest (worked test vector):
 *       <case>.identity-declaration → record.identityDeclarationDigest
 *     Companion bytes MUST themselves be canonical (fc-canonical-json:v1,
 *     profile §7.1). The lane fails closed unless at least one
 *     identity-declaration companion vector was found and verified per run:
 *     a deleted or renamed companion file breaks the run instead of silently
 *     skipping the canonicalization demonstration.
 *
 *   tests/conformance/embodiment-binding/negative/<case>.json
 *     MUST fail schema validation (against the discriminator-matched schema).
 *
 *   tests/conformance/embodiment-binding/vectors/EBV-NN.json
 *     The profile §11 golden vectors (issue #17 conformance vectors).
 *     Coverage is fail-closed: exactly EBV-01..EBV-18 must be present.
 *     Each vector MUST carry vectorId, title, given, and a non-empty expect
 *     list of {question, verdict, reason} triples drawn from the schema
 *     vocabularies (read from the schemas, so vocabulary cannot drift).
 *     Embedded binding/verification records MUST validate against their
 *     schemas; embedded bindings MUST recompute their integrity digest; an
 *     embedded verification's (question, verdict, reason) MUST appear in the
 *     vector's expect list.
 *
 * Exits 0 only if every case behaves as expected. No output contract beyond
 * the exit code is normative; run-conformance.sh aggregates results.
 *
 * Runtime obligations (that a real resolver returns the vector verdicts,
 * cache-freshness enforcement, atomic snapshot/commit, bundle retrieval,
 * privacy enforcement) are normative in schemas/familiar-embodiment-binding.md
 * §5–§10 and are NOT testable at file level (profile §10.1).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const Ajv = require('ajv');

const ROOT = path.resolve(__dirname, '..');
const LANE_DIR = path.join(ROOT, 'tests', 'conformance', 'embodiment-binding');
const POSITIVE_DIR = path.join(LANE_DIR, 'positive');
const NEGATIVE_DIR = path.join(LANE_DIR, 'negative');
const VECTORS_DIR = path.join(LANE_DIR, 'vectors');

const BINDING_DISCRIMINATOR = 'familiar.embodiment_binding.v1';
const VERIFICATION_DISCRIMINATOR = 'familiar.embodiment_verification.v1';
const VECTOR_IDS = Array.from({ length: 18 }, (_, i) => `EBV-${String(i + 1).padStart(2, '0')}`);

function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

// fc-canonical-json:v1 — UTF-8, recursively key-sorted members, no insignificant
// whitespace, integers only (schemas/familiar-embodiment-binding.md §7.1).
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
    return out;
  }
  return value;
}

function canonicalJson(obj) {
  return JSON.stringify(canonicalize(obj));
}

function bindingIntegrityRecompute(record) {
  const rest = { ...record };
  delete rest.bindingIntegrityDigest;
  return sha256Hex(Buffer.from(canonicalJson(rest), 'utf8'));
}

function listFiles(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .sort()
    .map((f) => path.join(dir, f));
}

function main() {
  const bindingSchema = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'schemas', 'familiar-embodiment-binding.schema.json'), 'utf8')
  );
  const verificationSchema = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'schemas', 'familiar-embodiment-verification.schema.json'), 'utf8')
  );
  const validateBinding = new Ajv({ allErrors: true, strict: false }).compile(bindingSchema);
  const validateVerification = new Ajv({ allErrors: true, strict: false }).compile(verificationSchema);

  const QUESTION_VOCAB = verificationSchema.properties.question.enum;
  const VERDICT_VOCAB = verificationSchema.properties.verdict.enum;
  const REASON_VOCAB = verificationSchema.properties.reason.enum;

  let failures = 0;
  const report = (ok, label, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures += 1;
  };
  const ajvErrors = (validate) =>
    (validate.errors || []).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');

  // ---------- positive lane ----------
  const positives = listFiles(POSITIVE_DIR, '.json');
  let identityVectorsVerified = 0;

  for (const casePath of positives) {
    const label = `embodiment-binding/positive/${path.basename(casePath)}`;
    let record;
    try {
      record = JSON.parse(fs.readFileSync(casePath, 'utf8'));
    } catch (err) {
      report(false, label, `unparseable JSON: ${err.message}`);
      continue;
    }

    if (record.schema === BINDING_DISCRIMINATOR) {
      if (!validateBinding(record)) {
        report(false, label, `expected schema pass: ${ajvErrors(validateBinding)}`);
        continue;
      }
      // Profile §7.3: integrity digest MUST recompute over the canonical
      // encoding of the record minus the bindingIntegrityDigest member.
      const actual = bindingIntegrityRecompute(record);
      if (actual !== record.bindingIntegrityDigest) {
        report(
          false,
          label,
          `bindingIntegrityDigest recompute mismatch: ${actual} != ${record.bindingIntegrityDigest}`
        );
        continue;
      }
      // Worked vector: companion .identity-declaration bytes must hash to the
      // identityDeclarationDigest, and must themselves be canonical bytes.
      const declPath = casePath.replace(/\.json$/, '.identity-declaration');
      if (fs.existsSync(declPath)) {
        const declBytes = fs.readFileSync(declPath);
        const declHash = sha256Hex(declBytes);
        if (declHash !== record.identityDeclarationDigest) {
          report(
            false,
            label,
            `identity vector ${path.basename(declPath)}: sha256 ${declHash} != identityDeclarationDigest ${record.identityDeclarationDigest}`
          );
          continue;
        }
        let decl;
        try {
          decl = JSON.parse(declBytes.toString('utf8'));
        } catch (err) {
          report(false, label, `identity-declaration companion is not JSON: ${err.message}`);
          continue;
        }
        const canonicalBytes = Buffer.from(canonicalJson(decl), 'utf8');
        if (!canonicalBytes.equals(declBytes)) {
          report(false, label, `identity-declaration companion is not fc-canonical-json:v1 canonical`);
          continue;
        }
        identityVectorsVerified += 1;
      }
      report(true, label);
    } else if (record.schema === VERIFICATION_DISCRIMINATOR) {
      if (!validateVerification(record)) {
        report(false, label, `expected schema pass: ${ajvErrors(validateVerification)}`);
        continue;
      }
      report(true, label);
    } else {
      report(false, label, `unknown or missing schema discriminator: ${String(record && record.schema)}`);
    }
  }

  if (positives.length === 0) {
    report(false, 'embodiment-binding/positive/*', 'positive lane is empty — structural coverage required');
  }

  // Fail-closed worked-vector coverage (§6.1 lesson from the audit-record lane):
  // a passing run must actually have demonstrated identity-declaration
  // recomputation, so a missing or renamed companion file breaks the run.
  if (identityVectorsVerified === 0) {
    report(
      false,
      'embodiment-binding/positive/*.identity-declaration',
      'no .identity-declaration companion vector found and verified against identityDeclarationDigest — the profile §7.2 canonicalization demonstration is required'
    );
  }

  // ---------- negative lane ----------
  const negatives = listFiles(NEGATIVE_DIR, '.json');
  if (negatives.length === 0) {
    report(false, 'embodiment-binding/negative/*', 'negative lane is empty — fail-closed coverage required');
  }
  for (const casePath of negatives) {
    const label = `embodiment-binding/negative/${path.basename(casePath)}`;
    let record;
    try {
      record = JSON.parse(fs.readFileSync(casePath, 'utf8'));
    } catch (err) {
      report(false, label, `negative fixtures must be well-formed JSON that fails the schema, not unparseable JSON: ${err.message}`);
      continue;
    }
    const validate = record && record.schema === VERIFICATION_DISCRIMINATOR ? validateVerification : validateBinding;
    if (validate(record)) {
      report(false, label, 'expected schema rejection but record validated');
    } else {
      report(true, label);
    }
  }

  // ---------- golden vectors ----------
  const vectorPaths = listFiles(VECTORS_DIR, '.json');
  const seenIds = [];

  for (const casePath of vectorPaths) {
    const label = `embodiment-binding/vectors/${path.basename(casePath)}`;
    let vector;
    try {
      vector = JSON.parse(fs.readFileSync(casePath, 'utf8'));
    } catch (err) {
      report(false, label, `unparseable JSON: ${err.message}`);
      continue;
    }
    const vectorId = vector.vectorId;
    if (typeof vectorId !== 'string' || !/^EBV-\d{2}$/.test(vectorId)) {
      report(false, label, 'missing or malformed vectorId');
      continue;
    }
    seenIds.push(vectorId);
    if (path.basename(casePath) !== `${vectorId}.json`) {
      report(false, label, `file name must be ${vectorId}.json`);
      continue;
    }
    if (!vector.title || typeof vector.given !== 'object' || vector.given === null) {
      report(false, label, 'vector must carry title and given');
      continue;
    }
    if (!Array.isArray(vector.expect) || vector.expect.length === 0) {
      report(false, label, 'vector must carry a non-empty expect list');
      continue;
    }
    let vectorOk = true;
    vector.expect.forEach((exp, i) => {
      if (!exp || typeof exp !== 'object') {
        report(false, label, `expect[${i}] is not an object`);
        vectorOk = false;
        return;
      }
      if (!QUESTION_VOCAB.includes(exp.question)) {
        report(false, label, `expect[${i}].question "${exp.question}" outside schema vocabulary`);
        vectorOk = false;
      }
      if (!VERDICT_VOCAB.includes(exp.verdict)) {
        report(false, label, `expect[${i}].verdict "${exp.verdict}" outside schema vocabulary`);
        vectorOk = false;
      }
      if (!REASON_VOCAB.includes(exp.reason)) {
        report(false, label, `expect[${i}].reason "${exp.reason}" outside schema vocabulary`);
        vectorOk = false;
      }
    });
    if (vector.binding !== undefined && vector.binding !== null) {
      if (!validateBinding(vector.binding)) {
        report(false, label, `embedded binding must validate: ${ajvErrors(validateBinding)}`);
        vectorOk = false;
      } else {
        const actual = bindingIntegrityRecompute(vector.binding);
        if (actual !== vector.binding.bindingIntegrityDigest) {
          report(
            false,
            label,
            `embedded binding integrity digest does not recompute (${actual} != ${vector.binding.bindingIntegrityDigest})`
          );
          vectorOk = false;
        }
      }
    }
    if (vector.verification !== undefined && vector.verification !== null) {
      if (!validateVerification(vector.verification)) {
        report(false, label, `embedded verification must validate: ${ajvErrors(validateVerification)}`);
        vectorOk = false;
      } else {
        const triple = [
          vector.verification.question,
          vector.verification.verdict,
          vector.verification.reason,
        ].join('|');
        const covered = vector.expect.some(
          (e) => e && `${e.question}|${e.verdict}|${e.reason}` === triple
        );
        if (!covered) {
          report(false, label, `embedded verification triple ${triple} is not covered by the expect list`);
          vectorOk = false;
        }
      }
    }
    if (vectorOk) report(true, label);
  }

  const expectedSet = new Set(VECTOR_IDS);
  const seenSet = new Set(seenIds);
  const missing = VECTOR_IDS.filter((id) => !seenSet.has(id));
  const extra = seenIds.filter((id) => !expectedSet.has(id));
  if (missing.length > 0) {
    report(
      false,
      'embodiment-binding/vectors/*',
      `missing golden vectors: ${missing.join(', ')} — fail-closed coverage requires all of EBV-01..EBV-18`
    );
  }
  if (extra.length > 0) {
    report(
      false,
      'embodiment-binding/vectors/*',
      `unexpected vector ids: ${extra.join(', ')} — golden coverage is exactly EBV-01..EBV-18; new vectors require a profile amendment`
    );
  }

  if (failures > 0) {
    console.log(`BROKEN: ${failures} embodiment-binding case(s) misbehaved`);
    process.exit(1);
  }
  console.log(
    `embodiment-binding: ${positives.length} positive passed, ${negatives.length} negative rejected correctly, vectors EBV-01..EBV-18 coverage complete, ${identityVectorsVerified} identity-declaration vector(s) recomputed`
  );
}

main();
