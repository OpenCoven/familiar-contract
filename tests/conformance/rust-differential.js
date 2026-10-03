#!/usr/bin/env node
// Differential test of the Rust embodiment-binding verifier against
// validators/validate.js. Every conformance vector, and its sidecars, is
// mutated member by member; each mutant runs through both validators, which
// must report the same set of error codes. Mutated bindings and revocation
// events are also re-signed with a fresh key, so the checks behind the digest
// and signature are reached with those passing.
//
// Usage: node tests/conformance/rust-differential.js <verify-batch binary> [--all]
//
// By default the 22 positive vectors are mutated member by member and the
// negative vectors run with text-level mutants only; enum swaps on the
// positives already reach the negatives' states. `--all` mutates every vector
// and its sidecars, which takes a few minutes and about 1.5 GB of scratch.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const SUITE = path.join(__dirname, 'embodiment-bindings');
const reference = require(path.join(ROOT, 'validators', 'validate.js'));
const batch = process.argv[2];
const everyVector = process.argv.includes('--all');
if (!batch) {
  console.error('usage: rust-differential.js <verify-batch binary> [--all]');
  process.exit(2);
}

const ROLES = [
  ['binding', null],
  ['historicalBundle', 'bundles'],
  ['trustedLedger', 'ledgers'],
  ['postCommitRevocation', 'revocations']
];
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

// Every enum in the profile's schemas: a string member holding one value is
// mutated to each other value of its enum.
const enums = [];
for (const file of ['familiar-embodiment-binding', 'familiar-identity-bundle', 'familiar-embodiment-revocation']) {
  (function collect(node) {
    if (Array.isArray(node)) return node.forEach(collect);
    if (node && typeof node === 'object') {
      if (Array.isArray(node.enum)) enums.push(node.enum);
      Object.values(node).forEach(collect);
    }
  })(JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas', `${file}.schema.json`), 'utf8')));
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const sign = digest => crypto.sign(null, Buffer.from(digest, 'hex'), privateKey).toString('base64');

function resignBinding(binding) {
  try {
    const digest = reference.bindingDigest(binding);
    binding.integrity.bindingDigest = digest;
    binding.commit.verifiedBindingDigest = digest;
    binding.authentication.publicKey = PUBLIC_KEY;
    binding.authentication.signature = sign(digest);
    return binding;
  } catch (_) {
    return null;
  }
}

function resignRevocation(event) {
  try {
    const digest = reference.revocationDigest(event);
    event.integrity.eventDigest = digest;
    event.authentication.publicKey = PUBLIC_KEY;
    event.authentication.signature = sign(digest);
    return event;
  } catch (_) {
    return null;
  }
}

function* nodes(value, at = []) {
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      const here = [...at, Array.isArray(value) ? Number(key) : key];
      yield [here, item, Array.isArray(value)];
      yield* nodes(item, here);
    }
  }
}

function replaced(root, at, update) {
  const copy = JSON.parse(JSON.stringify(root));
  let parent = copy;
  for (const key of at.slice(0, -1)) parent = parent[key];
  update(parent, at[at.length - 1]);
  return copy;
}

function iso(ms) {
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function alternatives(value) {
  if (typeof value === 'string') {
    const out = ['', 'x', 'a:b'];
    for (const list of enums) if (list.includes(value)) out.push(...list.filter(item => item !== value));
    if (/^[0-9a-f]{64}$/.test(value)) out.push(value.slice(0, -1) + (value.endsWith('0') ? '1' : '0'));
    if (TIMESTAMP.test(value)) {
      const ms = new Date(value).getTime();
      out.push('2026-02-30T00:00:00Z', '2026-01-01T24:00:00Z', '0099-01-01T00:00:00Z', '2026-13-01T00:00:00Z');
      // Either side of each boundary the checks use: equal instants, and the
      // 300-second freshness and ledger-age limits.
      for (const delta of [-301000, -300000, -299000, -1000, -1, 1, 1000, 299000, 300000, 301000, 86400000]) {
        out.push(iso(ms + delta));
      }
      // The same instant, written differently.
      out.push(iso(ms).replace('Z', '+00:00'));
    }
    return out.filter(item => item !== null && item !== value);
  }
  if (typeof value === 'number') return [value + 1, value - 1, 3.5, 0, -1, 300, 301];
  if (typeof value === 'boolean') return [!value, 'true'];
  if (value === null) return ['x', 0];
  if (Array.isArray(value)) return [[], value.length ? [...value, value[0]] : ['x:y']];
  return [{}, null];
}

// Mutants of one document: each member deleted, or replaced by each
// alternative value.
function* documentMutants(document) {
  for (const [at, value, inArray] of nodes(document)) {
    if (!inArray) yield replaced(document, at, (parent, key) => { delete parent[key]; });
    for (const alternative of alternatives(value)) {
      yield replaced(document, at, (parent, key) => { parent[key] = alternative; });
    }
  }
}

// Text-level mutants that JSON.stringify cannot produce.
function* textMutants(text) {
  yield text.replace(/("lineagePosition":\s*)(\d+)/, '$1$2.0');
  yield text.replace(/("lineagePosition":\s*)(\d+)/, '$1$2e0');
  yield text.replace(/("authoritativeLedgerGeneration":\s*)\d+/, '$19007199254740993');
  yield text.replace(/("generation":\s*)\d+/, '$19007199254740993');
  yield text.replace(/("generation":\s*)(\d+)/, '$1$2.5');
  yield text.replace(/("generation":\s*)\d+/, '$11e400');
  yield text.replace(/"(\w+)":/, '"$1": "dup", "$1":');
  yield text.replace(/("bindingId":\s*")/, '$1\\ud800');
  yield text.replace(/("policyVersion":\s*")/, '$1\\u00e9\\u0000');
  yield text.replace(/^\s*\{/, '{"__proto__": {},');
  yield `﻿${text}`;
  yield `${text}x`;
}

// Cases stream to a JSON Lines file for verify-batch, with the reference
// codes computed as each one is generated; only digests of the inputs stay
// in memory.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'familiar-differential-'));
const casesPath = path.join(scratch, 'cases.jsonl');
const casesFile = fs.openSync(casesPath, 'w');
const expected = [];
const labels = [];
const offsets = [];
const seen = new Set();
let label = '';
let written = 0;
function add(texts) {
  const line = Buffer.from(JSON.stringify(texts) + '\n');
  const key = crypto.createHash('sha256').update(line).digest('hex');
  if (seen.has(key)) return;
  seen.add(key);
  offsets.push([written, line.length - 1]);
  written += fs.writeSync(casesFile, line);
  expected.push(referenceCodes(texts));
  labels.push(label);
}

for (const kind of ['positive', 'negative']) {
  for (const file of fs.readdirSync(path.join(SUITE, kind)).filter(name => name.endsWith('.json')).sort()) {
    const base = {};
    for (const [role, dir] of ROLES) {
      const at = dir ? path.join(SUITE, dir, file) : path.join(SUITE, kind, file);
      if (fs.existsSync(at)) base[role] = fs.readFileSync(at, 'utf8');
    }
    label = `${kind}/${file}`;
    add(base);
    for (const [role] of ROLES) {
      if (base[role] === undefined) continue;
      for (const text of textMutants(base[role])) add({ ...base, [role]: text });
      if (kind === 'negative' && !everyVector) continue;
      let document;
      try { document = JSON.parse(base[role]); } catch (_) { continue; }
      if (!document || typeof document !== 'object') continue;
      for (const mutant of documentMutants(document)) {
        add({ ...base, [role]: JSON.stringify(mutant) });
        const resign = role === 'binding' ? resignBinding : role === 'postCommitRevocation' ? resignRevocation : null;
        const signed = resign && resign(JSON.parse(JSON.stringify(mutant)));
        if (signed) add({ ...base, [role]: JSON.stringify(signed) });
      }
      // Each sidecar also runs absent.
      if (role !== 'binding') add(Object.fromEntries(Object.entries(base).filter(([key]) => key !== role)));
    }
  }
}

fs.closeSync(casesFile);

// Reference codes, computed in process from temporary files.
function referenceCodes(texts) {
  const files = {};
  for (const [role] of ROLES) {
    if (texts[role] === undefined) continue;
    files[role] = path.join(scratch, `${role}.json`);
    fs.writeFileSync(files[role], texts[role]);
  }
  const violations = reference.validateEmbodimentBindingFile(
    files.binding, files.historicalBundle, files.trustedLedger, files.postCommitRevocation
  );
  const codes = new Set(violations.map(violation => (/^\[(E_[A-Z_]+)\]/.exec(violation.field) || [])[1] || null));
  return JSON.stringify([...codes].sort((a, b) => (a === null ? -1 : b === null ? 1 : a < b ? -1 : a > b ? 1 : 0)));
}

const input = fs.openSync(casesPath, 'r');
const run = spawnSync(batch, [], { stdio: [input, 'pipe', 'inherit'], maxBuffer: 1 << 30 });
fs.closeSync(input);
if (run.status !== 0) {
  console.error(`verify-batch exited with ${run.status}`);
  process.exit(1);
}
const actual = run.stdout.toString().trimEnd().split('\n');
if (actual.length !== expected.length) {
  console.error(`verify-batch answered ${actual.length} of ${expected.length} cases`);
  process.exit(1);
}

let mismatched = 0;
const covered = new Set();
const casesRead = fs.openSync(casesPath, 'r');
function caseAt(index) {
  const [offset, length] = offsets[index];
  const buffer = Buffer.alloc(length);
  fs.readSync(casesRead, buffer, 0, length, offset);
  return JSON.parse(buffer.toString('utf8'));
}
for (let index = 0; index < expected.length; index++) {
  for (const code of JSON.parse(expected[index])) covered.add(code);
  if (expected[index] !== actual[index]) {
    mismatched++;
    if (mismatched <= 20) {
      console.log(`MISMATCH case ${index} (from ${labels[index]})\n  node: ${expected[index]}\n  rust: ${actual[index]}`);
      for (const [role, text] of Object.entries(caseAt(index))) console.log(`  ${role}: ${text.slice(0, 400)}`);
    }
  }
}
fs.closeSync(casesRead);
fs.rmSync(scratch, { recursive: true, force: true });
console.log(`Differential: ${expected.length} cases from ${new Set(labels).size} vectors, ${mismatched} mismatched`);
console.log(`Codes exercised: ${[...covered].map(String).sort().join(' ')}`);
process.exit(mismatched === 0 ? 0 : 1);
