#!/usr/bin/env node
/**
 * familiar-contract validator
 * 
 * Usage: node validate.js <path-to-familiar-directory>
 * 
 * Checks:
 *   - SOUL.md exists and contains required fields
 *   - IDENTITY.md exists and contains required fields
 *   - ward.toml exists and contains required fields
 * 
 * Output: PASS or list of violations with file + field + message
 * Exit code: 0 on pass, 1 on fail
 * 
 * Uses standards-compliant TOML parsing and JSON Schema validation for ward.toml.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const TOML = require('@iarna/toml');
const Ajv = require('ajv');
const crypto = require('crypto');

// ── Helpers ──────────────────────────────────────────────────────────────────

function red(s)    { return `\x1b[31m${s}\x1b[0m`; }
function green(s)  { return `\x1b[32m${s}\x1b[0m`; }
function yellow(s) { return `\x1b[33m${s}\x1b[0m`; }
function bold(s)   { return `\x1b[1m${s}\x1b[0m`; }
function dim(s)    { return `\x1b[2m${s}\x1b[0m`; }

function violation(file, field, message) {
  return { file, field, message };
}

// ── familiar.embodiment_binding.v1 validation ───────────────────────────────

const embodimentBindingSchema = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'schemas', 'familiar-embodiment-binding.schema.json'), 'utf8'
));
const validateEmbodimentBindingSchema = new Ajv({ allErrors: true, strict: false })
  .compile(embodimentBindingSchema);
const identityBundleSchema = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'schemas', 'familiar-identity-bundle.schema.json'), 'utf8'
));
const validateIdentityBundleSchema = new Ajv({ allErrors: true, strict: false })
  .compile(identityBundleSchema);
const MAX_CACHE_AGE_SECONDS = 300;

function bindingViolation(code, field, message) {
  return violation('embodiment-binding', `[${code}] ${field}`, message);
}

function parseJsonNoDuplicate(text) {
  let i = 0; let duplicate = false;
  const ws = () => { while (/\s/.test(text[i])) i++; };
  const string = () => { const start = i++; while (i < text.length) { if (text[i] === '\\') i += 2; else if (text[i++] === '"') break; } return JSON.parse(text.slice(start, i)); };
  const value = () => { ws(); if (text[i] === '"') return string(); if (text[i] === '{') return object(); if (text[i] === '[') return array(); while (i < text.length && !/[\s,\]}]/.test(text[i])) i++; };
  const array = () => { i++; ws(); while (text[i] !== ']') { value(); ws(); if (text[i] === ',') { i++; ws(); } else break; } i++; };
  const object = () => { const keys = new Set(); i++; ws(); while (text[i] !== '}') { const key = string(); if (keys.has(key)) duplicate = true; keys.add(key); ws(); if (text[i++] !== ':') throw new Error('expected colon'); value(); ws(); if (text[i] === ',') { i++; ws(); } else break; } i++; };
  value(); ws(); if (i !== text.length) throw new Error('trailing input'); if (duplicate) throw new Error('duplicate object key'); return JSON.parse(text);
}

function hasInvalidIJsonValue(value) {
  if (typeof value === 'number') return !Number.isFinite(value);
  if (typeof value === 'string') {
    for (let i = 0; i < value.length; i++) {
      const unit = value.charCodeAt(i);
      if (unit >= 0xd800 && unit <= 0xdbff) {
        if (++i >= value.length || value.charCodeAt(i) < 0xdc00 || value.charCodeAt(i) > 0xdfff) return true;
      } else if (unit >= 0xdc00 && unit <= 0xdfff) return true;
    }
  } else if (Array.isArray(value)) return value.some(hasInvalidIJsonValue);
  else if (isObject(value)) return Object.entries(value).some(([key, item]) => hasInvalidIJsonValue(key) || hasInvalidIJsonValue(item));
  return false;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function bindingDigest(binding) {
  const committed = JSON.parse(JSON.stringify(binding));
  delete committed.integrity;
  delete committed.authentication;
  delete committed.commit.verifiedBindingDigest;
  return crypto.createHash('sha256').update(canonicalJson(committed), 'utf8').digest('hex');
}

function isTimestamp(value) {
  if (typeof value !== 'string') return false;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|([+-])(\d{2}):(\d{2}))$/);
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const offsetHour = match[9] === undefined ? 0 : Number(match[9]);
  const offsetMinute = match[10] === undefined ? 0 : Number(match[10]);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  return month >= 1 && month <= 12 && hour <= 23 && minute <= 59 && second <= 59
    && offsetHour <= 23 && offsetMinute <= 59
    && calendar.getUTCFullYear() === year && calendar.getUTCMonth() === month - 1 && calendar.getUTCDate() === day;
}

function verifyEd25519(authentication, digest) {
  try {
    return crypto.verify(null, Buffer.from(digest, 'hex'), {
      key: Buffer.from(authentication.publicKey, 'base64'), format: 'der', type: 'spki'
    }, Buffer.from(authentication.signature, 'base64'));
  } catch (_) {
    return false;
  }
}

function digestObject(value) {
  return crypto.createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

function validTransition(transition, predecessor, familiar, relationship, bindingIdentityBundleDigest, bindingDeclarationDigest) {
  return transition && transition.relationship === relationship
    && transition.predecessorBundleDigest === predecessor.identityBundleRef.slice('urn:sha256:'.length)
    && transition.successorFamiliarRootId === familiar.familiarRootId
    && transition.successorIdentityRevisionId === familiar.identityRevisionId
    && transition.successorBundleDigest === bindingIdentityBundleDigest
    && transition.successorDeclarationDigest === bindingDeclarationDigest
    && verifyEd25519(transition.authentication, digestObject({
      relationship: transition.relationship,
      predecessorBundleDigest: transition.predecessorBundleDigest,
      successorFamiliarRootId: transition.successorFamiliarRootId,
      successorIdentityRevisionId: transition.successorIdentityRevisionId,
      successorBundleDigest: transition.successorBundleDigest,
      successorDeclarationDigest: transition.successorDeclarationDigest
    }));
}

function validateHistoricalBundle(bundle, binding) {
  const violations = [];
  if (!isObject(bundle) || !validateIdentityBundleSchema(bundle)) {
    return [bindingViolation('E_BUNDLE_SCHEMA', 'historicalBundle', 'The detached historical bundle is malformed.')];
  }
  if (!isTimestamp(bundle.recordedAt) || !isTimestamp(bundle.retention.recordedAt)) {
    violations.push(bindingViolation('E_TIMESTAMP', 'historicalBundle.timestamps', 'Historical bundle timestamps must be strict RFC 3339 calendar date-times with an offset or Z.'));
  }
  const idsMatch = bundle.familiarRootId === binding.familiar.familiarRootId
    && bundle.identityRevisionId === binding.familiar.identityRevisionId
    && bundle.lineagePosition === binding.familiar.lineagePosition;
  if (!idsMatch) violations.push(bindingViolation('E_BUNDLE_IDENTITY', 'historicalBundle', 'The detached bundle does not identify the bound root, revision, and lineage position.'));
  const seen = new Set();
  let redactedCount = 0;
  for (const component of bundle.components) {
    if (seen.has(component.componentId) || (component.redactionState === 'retained' && (!component.content || component.digest.value !== digestObject(component.content))) ||
      (component.redactionState === 'redacted' && (component.content || !component.redactionEvidence))) {
      violations.push(bindingViolation('E_COMPONENT_DIGEST', 'historicalBundle.components', 'Every unique retained component digest must recompute from its canonical content.'));
      break;
    }
    if (component.redactionState === 'redacted') redactedCount++;
    seen.add(component.componentId);
  }
  if (!seen.has('identity-declaration') || !seen.has('soul-declaration')) {
    violations.push(bindingViolation('E_COMPONENT_REQUIRED', 'historicalBundle.components', 'Historical bundles retain identity-declaration and soul-declaration components.'));
  }
  const copy = JSON.parse(JSON.stringify(bundle));
  delete copy.bundleDigest;
  const computedBundleDigest = digestObject(copy);
  if (bundle.bundleDigest.value !== computedBundleDigest ||
      binding.identityBundle.bundleDigest.value !== computedBundleDigest ||
      binding.identityBundle.declarationDigest.value !== bundle.components.find(c => c.componentId === 'identity-declaration')?.digest.value) {
    violations.push(bindingViolation('E_BUNDLE_DIGEST', 'historicalBundle.bundleDigest', 'The detached bundle and its retained identity declaration must recompute to the bound digests.'));
  }
  if (bundle.retention.verifierAccess !== 'authorized') {
    violations.push(bindingViolation('E_BUNDLE_ACCESS', 'historicalBundle.retention', 'A supplied detached bundle must be authorized for verifier access.'));
  }
  const allRetained = redactedCount === 0;
  const allRedacted = redactedCount === bundle.components.length;
  const { redactionState, tombstoneState, replicaPurgeState } = bundle.retention;
  const historyState = binding.historicalVerification.state;
  if (allRetained) {
    if (redactionState !== 'none' || tombstoneState !== 'live' ||
        replicaPurgeState !== 'not_requested' || historyState !== 'verified') {
      violations.push(bindingViolation('E_REDACTION', 'historicalBundle.retention', 'A fully retained supplied bundle must be live, unredacted, unpurged, and verified.'));
    }
  } else if (redactionState !== 'redacted') {
    violations.push(bindingViolation('E_REDACTION', 'historicalBundle.retention.redactionState', 'Any unavailable component content requires bundle-level redaction state.'));
  } else if (tombstoneState === 'live') {
    if (replicaPurgeState !== 'not_requested' || historyState !== 'unverifiable') {
      violations.push(bindingViolation('E_REDACTION', 'historicalBundle.retention', 'A live supplied redacted bundle must be unpurged and classified as unverifiable.'));
    }
  } else if (!allRedacted) {
    violations.push(bindingViolation('E_REDACTION', 'historicalBundle.components', 'A tombstoned or erased bundle cannot retain sensitive component content.'));
  } else if (tombstoneState === 'tombstoned') {
    if (!bundle.retention.erasureEvidence || !['pending', 'complete'].includes(replicaPurgeState) ||
        historyState !== 'unavailable') {
      violations.push(bindingViolation('E_REDACTION', 'historicalBundle.retention', 'A tombstoned supplied bundle requires erasure evidence, an active purge, and unavailable history.'));
    }
  } else if (tombstoneState === 'erased' &&
      (!bundle.retention.erasureEvidence || !bundle.retention.deviceRevocationEvidence ||
       replicaPurgeState !== 'complete' || historyState !== 'unavailable')) {
    violations.push(bindingViolation('E_REDACTION', 'historicalBundle.retention', 'An erased supplied bundle requires complete purge evidence and unavailable history.'));
  }
  return violations;
}

function validateEmbodimentBinding(binding, file, historicalBundle, trustedLedger, historicalBundleSupplied = false) {
  const violations = [];
  if (!isObject(binding)) return [bindingViolation('E_SCHEMA', 'shape', 'An embodiment binding must be one JSON object.')];
  if (binding.schemaVersion !== '1.0.0') return [bindingViolation('E_VERSION', 'schemaVersion', 'Only familiar.embodiment_binding.v1 schemaVersion 1.0.0 is supported.')];
  if (!validateEmbodimentBindingSchema(binding)) {
    return (validateEmbodimentBindingSchema.errors || []).map(error =>
      bindingViolation('E_SCHEMA', `schema ${error.instancePath || '/'} [${error.keyword}]`, error.message || 'schema violation')
    );
  }

  const { familiar, resolutionSnapshot, identityBundle, statusAtDecision, principal, target, historicalVerification, revocation, commit, integrity } = binding;
  const isAuthorityAttempt = ['dispatch', 'session_creation'].includes(binding.bindingPurpose);
  const times = [binding.revisionRecordedAt, binding.validTime.notBefore, binding.validTime.notAfter, resolutionSnapshot.resolvedAt,
    statusAtDecision.decisionTime, binding.issuedAt, binding.decisionAt, commit.finalValidityCheckAt, commit.committedAt,
    revocation.revokedAt, binding.privacy.recordedAt, resolutionSnapshot.cacheObservedAt].filter(Boolean);
  if (times.some(value => !isTimestamp(value))) violations.push(bindingViolation('E_TIMESTAMP', 'timestamps', 'All present timestamps must be strict RFC 3339 calendar date-times with an offset or Z.'));
  const at = value => new Date(value).getTime();

  if (identityBundle.historicalBundleRef !== `urn:sha256:${identityBundle.bundleDigest.value}`) {
    violations.push(bindingViolation('E_BUNDLE_REFERENCE', 'identityBundle.historicalBundleRef', 'The content-addressed historical bundle reference must exactly carry bundleDigest.value.'));
  }
  if (integrity.bindingDigest !== bindingDigest(binding)) {
    violations.push(bindingViolation('E_BINDING_DIGEST', 'integrity.bindingDigest', 'The SHA-256 digest of JCS-canonical binding bytes with the entire integrity/authentication members and redundant commit digest verification omitted does not match.'));
  }
  if (commit.verifiedBindingDigest !== integrity.bindingDigest) {
    violations.push(bindingViolation('E_COMMIT_DIGEST', 'commit.verifiedBindingDigest', 'The immutable commit must verify the exact committed binding digest.'));
  }
  if (!verifyEd25519(binding.authentication, integrity.bindingDigest)) violations.push(bindingViolation('E_AUTHENTICATION', 'authentication', 'The Ed25519 public key and signature do not verify the binding digest.'));
  if (resolutionSnapshot.snapshotId !== commit.snapshotId || resolutionSnapshot.familiarRootId !== familiar.familiarRootId ||
      resolutionSnapshot.identityRevisionId !== familiar.identityRevisionId || resolutionSnapshot.lineagePosition !== familiar.lineagePosition ||
      resolutionSnapshot.bundleDigest !== identityBundle.bundleDigest.value || resolutionSnapshot.status !== statusAtDecision.status) {
    violations.push(bindingViolation('E_SNAPSHOT', 'resolutionSnapshot', 'The immutable resolution snapshot must bind root, revision, lineage position, bundle digest, and decision status.'));
  }
  if (isAuthorityAttempt &&
      (resolutionSnapshot.authoritativeHeadRevisionId !== familiar.identityRevisionId ||
       (isTimestamp(resolutionSnapshot.cacheObservedAt) && isTimestamp(commit.finalValidityCheckAt) &&
        at(commit.finalValidityCheckAt) - at(resolutionSnapshot.cacheObservedAt) >
          Math.min(MAX_CACHE_AGE_SECONDS, resolutionSnapshot.freshnessBoundSeconds) * 1000))) {
    violations.push(bindingViolation('E_STALE_CACHE', 'resolutionSnapshot', 'Authority snapshots must name the current head revision and satisfy both the signed freshness bound and the verifier policy maximum.'));
  }
  if (isTimestamp(resolutionSnapshot.cacheObservedAt) && isTimestamp(commit.finalValidityCheckAt) &&
      at(resolutionSnapshot.cacheObservedAt) > at(commit.finalValidityCheckAt)) {
    violations.push(bindingViolation('E_CACHE_TIME', 'resolutionSnapshot.cacheObservedAt', 'Cache observation cannot be after the trusted final validity evaluation.'));
  }
  if (binding.aliasResolution) {
    const roots = binding.aliasResolution.resolvedRootIds;
    if (roots.length !== 1 || roots[0] !== familiar.familiarRootId) {
      violations.push(bindingViolation('E_ALIAS', 'aliasResolution', 'Aliases are non-authoritative evidence and must resolve to exactly the declared familiar root.'));
    }
  }
  if (principal.authenticatedPrincipalId !== target.authenticatedPrincipalId) {
    violations.push(bindingViolation('E_PRINCIPAL', 'target.authenticatedPrincipalId', 'The target principal must equal the authenticated binding principal.'));
  }
  if (isTimestamp(binding.revisionRecordedAt) && isTimestamp(binding.decisionAt) && at(binding.revisionRecordedAt) > at(binding.decisionAt)) {
    violations.push(bindingViolation('E_ORDERING', 'revisionRecordedAt', 'The revision cannot be recorded after the binding decision.'));
  }
  if (binding.validTime.notAfter && isTimestamp(binding.validTime.notBefore) && isTimestamp(binding.validTime.notAfter) &&
      at(binding.validTime.notBefore) > at(binding.validTime.notAfter)) {
    violations.push(bindingViolation('E_ORDERING', 'validTime', 'The valid-time interval cannot end before it begins.'));
  }
  if (isAuthorityAttempt && isTimestamp(binding.validTime.notBefore) && isTimestamp(commit.committedAt) && at(binding.validTime.notBefore) > at(commit.committedAt)) {
    violations.push(bindingViolation('E_STALE', 'validTime.notBefore', 'The revision is not yet valid at the decision time.'));
  }
  if (isAuthorityAttempt && binding.validTime.notAfter && isTimestamp(binding.validTime.notAfter) && isTimestamp(commit.committedAt) && at(binding.validTime.notAfter) < at(commit.committedAt)) {
    violations.push(bindingViolation('E_STALE', 'validTime.notAfter', 'The revision is stale at the decision time.'));
  }
  if (isTimestamp(commit.finalValidityCheckAt) && isTimestamp(commit.committedAt) && at(commit.finalValidityCheckAt) > at(commit.committedAt)) {
    violations.push(bindingViolation('E_ORDERING', 'commit', 'The final validity check cannot follow the immutable commit.'));
  }
  if (isTimestamp(resolutionSnapshot.resolvedAt) && isTimestamp(commit.finalValidityCheckAt) && isTimestamp(binding.decisionAt) && isTimestamp(commit.committedAt) &&
      !(at(resolutionSnapshot.resolvedAt) <= at(commit.finalValidityCheckAt) && at(commit.finalValidityCheckAt) <= at(binding.decisionAt) && at(binding.decisionAt) <= at(commit.committedAt) && at(commit.committedAt) <= at(binding.issuedAt)) ||
      statusAtDecision.decisionTime !== binding.decisionAt) {
    violations.push(bindingViolation('E_ORDERING', 'decisionAt', 'Snapshot resolution, final validity check, decision, commit, and issue must be ordered; statusAtDecision.decisionTime equals decisionAt.'));
  }
  if (isAuthorityAttempt && isTimestamp(commit.finalValidityCheckAt) && isTimestamp(binding.decisionAt) && isTimestamp(commit.committedAt) &&
      !(at(commit.finalValidityCheckAt) === at(binding.decisionAt) && at(binding.decisionAt) === at(commit.committedAt))) {
    violations.push(bindingViolation('E_ORDERING', 'commit', 'Authority eligibility check, decision, and immutable commit must share one transaction boundary.'));
  }

  const bindingIdentityBundleDigest = identityBundle.bundleDigest.value;
  const bindingDeclarationDigest = identityBundle.declarationDigest.value;
  const lineage = familiar.lineageEvidence;
  const predecessor = lineage.predecessor;
  if (predecessor && predecessor.identityRevisionId === familiar.identityRevisionId) {
    violations.push(bindingViolation('E_LINEAGE', 'familiar.lineageEvidence.predecessor', 'A lineage predecessor must be a distinct identity revision.'));
  }
  if (lineage.relationship === 'genesis' && (familiar.lineagePosition !== 0 || lineage.rootEvidence !== 'genesis' || predecessor)) {
    violations.push(violation(file, 'familiar.lineageEvidence', 'Genesis requires position 0, genesis root evidence, and no predecessor.'));
  }
  if (['same_familiar_revision', 'restoration'].includes(lineage.relationship)) {
    if (!predecessor || lineage.rootEvidence !== 'continued' || predecessor.familiarRootId !== familiar.familiarRootId ||
      predecessor.lineagePosition !== familiar.lineagePosition - 1 || predecessor.identityRevisionId === familiar.identityRevisionId ||
      !predecessor.identityBundleRef || !validTransition(predecessor.transition, predecessor, familiar, lineage.relationship, bindingIdentityBundleDigest, bindingDeclarationDigest)) {
      violations.push(bindingViolation('E_LINEAGE', 'familiar.lineageEvidence', 'Same-familiar continuation/restoration requires an authenticated, content-addressed edge from the immediately preceding distinct revision on the same root.'));
    }
  }
  if (lineage.relationship === 'restoration' && (!predecessor || predecessor.status !== 'retired')) {
    violations.push(bindingViolation('E_LINEAGE', 'familiar.lineageEvidence', 'Restoration requires a retired predecessor on the same familiar root.'));
  }
  if (['fork_new_root', 'succession'].includes(lineage.relationship) &&
    (!predecessor || !predecessor.identityBundleRef ||
      !validTransition(predecessor.transition, predecessor, familiar, lineage.relationship, bindingIdentityBundleDigest, bindingDeclarationDigest) ||
      familiar.lineagePosition !== 0 || predecessor.familiarRootId === familiar.familiarRootId ||
      lineage.rootEvidence !== (lineage.relationship === 'fork_new_root' ? 'fork' : 'succession'))) {
    violations.push(bindingViolation('E_LINEAGE', 'familiar.lineageEvidence', 'Fork/new-root and succession require authenticated, content-addressed predecessor evidence, position 0, a distinct root, and matching root evidence.'));
  }

  if (isAuthorityAttempt) {
    const trustedObservedAt = trustedLedger && isTimestamp(trustedLedger.observedAt)
      ? at(trustedLedger.observedAt)
      : Number.NaN;
    const finalValidityCheckAt = isTimestamp(commit.finalValidityCheckAt)
      ? at(commit.finalValidityCheckAt)
      : Number.NaN;
    const cacheObservedAt = isTimestamp(resolutionSnapshot.cacheObservedAt)
      ? at(resolutionSnapshot.cacheObservedAt)
      : Number.NaN;
    if (!trustedLedger || !isObject(trustedLedger) ||
        trustedLedger.generation !== resolutionSnapshot.authoritativeLedgerGeneration ||
        trustedLedger.headRevisionId !== familiar.identityRevisionId ||
        trustedLedger.status !== statusAtDecision.status ||
        !Number.isFinite(trustedObservedAt) ||
        !Number.isFinite(finalValidityCheckAt) ||
        !Number.isFinite(cacheObservedAt) ||
        trustedObservedAt < cacheObservedAt ||
        trustedObservedAt > finalValidityCheckAt ||
        finalValidityCheckAt - trustedObservedAt > MAX_CACHE_AGE_SECONDS * 1000 ||
        (trustedLedger.revokedAt && (!isTimestamp(trustedLedger.revokedAt) || at(trustedLedger.revokedAt) <= at(commit.committedAt)))) {
      violations.push(bindingViolation('E_TRUSTED_LEDGER', 'trustedLedger', 'Dispatch requires verifier-supplied authoritative ledger state observed no earlier than the cache, no more than 300 seconds before the final validity check, never after that check, matching the snapshot, and with no revocation at or before commit.'));
    }
  }
  if (isAuthorityAttempt && statusAtDecision.status !== 'active') {
    violations.push(bindingViolation('E_STATUS', 'statusAtDecision.status', 'Only an active revision is eligible for a new dispatch or session creation.'));
  }
  if (isAuthorityAttempt && historicalVerification.state !== 'verified') {
    violations.push(bindingViolation('E_HISTORY', 'historicalVerification.state', 'Degraded, unavailable, or unverifiable history is never authority for a new dispatch.'));
  }
  if (historicalVerification.readAuthorization === 'not_authorized' &&
    (historicalVerification.state !== 'unavailable' || binding.bindingPurpose !== 'historical_verification')) {
    violations.push(bindingViolation('E_HISTORY', 'historicalVerification', 'An unauthorized historical read must be recorded as unavailable historical verification, never as dispatch authority.'));
  }
  if (binding.privacy.tombstoneState !== 'live' &&
      (!binding.privacy.erasureEvidence || binding.privacy.replicaPurgeState === 'not_requested')) {
    violations.push(bindingViolation('E_RETENTION', 'privacy', 'Tombstoned or erased binding metadata requires erasure evidence and a requested replica purge.'));
  }
  if (historicalBundleSupplied && historicalVerification.readAuthorization === 'not_authorized') {
    violations.push(bindingViolation('E_BUNDLE_ACCESS', 'historicalVerification.readAuthorization', 'A denied historical read cannot include a detached bundle.'));
  }
  if (historicalBundleSupplied) violations.push(...validateHistoricalBundle(historicalBundle, binding));
  if (!historicalBundleSupplied) {
    const expectedMissingState = historicalVerification.readAuthorization === 'not_authorized'
      ? 'unavailable'
      : 'degraded';
    if (historicalVerification.state !== expectedMissingState) {
      const code = historicalVerification.state === 'verified'
        ? 'E_BUNDLE_MISSING'
        : 'E_REDACTION';
      violations.push(bindingViolation(code, 'historicalVerification', `A missing historical bundle must be ${expectedMissingState} for the recorded read-authorization state.`));
    }
  }
  if (revocation.outcome === 'before_commit') {
    if (!revocation.revokedAt || !isTimestamp(revocation.revokedAt) || !isTimestamp(commit.committedAt) ||
        at(revocation.revokedAt) > at(commit.committedAt)) {
      violations.push(bindingViolation('E_REVOCATION', 'revocation', 'A before-commit revocation must be timestamped at or before the immutable commit.'));
    } else if (isAuthorityAttempt) {
      violations.push(bindingViolation('E_REVOCATION', 'revocation', 'A revocation observed before commit must fail closed and cannot authorize dispatch.'));
    }
  }
  if (revocation.outcome === 'none' && revocation.revokedAt) {
    violations.push(bindingViolation('E_REVOCATION', 'revocation.outcome', 'A binding with revokedAt must classify the revocation outcome explicitly.'));
  }
  if (revocation.revokedAt && isTimestamp(revocation.revokedAt) && isTimestamp(commit.committedAt) && at(revocation.revokedAt) <= at(commit.committedAt) && isAuthorityAttempt) {
    violations.push(bindingViolation('E_REVOCATION', 'revocation.revokedAt', 'Any revocation at or before decision/commit rejects dispatch regardless of the asserted outcome.'));
  }
  if (revocation.outcome === 'after_commit') {
    if (!revocation.revokedAt || !isTimestamp(revocation.revokedAt) || !isTimestamp(commit.committedAt) || at(revocation.revokedAt) <= at(commit.committedAt)) {
      violations.push(bindingViolation('E_REVOCATION', 'revocation', 'An after-commit revocation must be timestamped strictly after the immutable commit.'));
    }
  }
  return violations;
}

function validateEmbodimentBindingFile(filePath, historicalBundlePath, trustedLedgerPath) {
  let binding;
  try {
    binding = parseJsonNoDuplicate(fs.readFileSync(filePath, 'utf8'));
    if (hasInvalidIJsonValue(binding)) return [bindingViolation('E_IJSON', 'input', 'JCS inputs must be I-JSON and cannot contain non-finite numbers or lone UTF-16 surrogates.')];
  } catch (error) {
    return [bindingViolation('E_JSON', 'syntax', `JSON syntax violation: ${error.message}`)];
  }
  let historicalBundle;
  if (historicalBundlePath) {
    try {
      historicalBundle = parseJsonNoDuplicate(fs.readFileSync(historicalBundlePath, 'utf8'));
      if (hasInvalidIJsonValue(historicalBundle)) return [bindingViolation('E_IJSON', 'historicalBundle', 'JCS inputs must be I-JSON and cannot contain non-finite numbers or lone UTF-16 surrogates.')];
    } catch (error) {
      return [bindingViolation('E_BUNDLE_SCHEMA', 'historicalBundle', `JSON syntax violation: ${error.message}`)];
    }
  }
  let trustedLedger;
  if (trustedLedgerPath) {
    try {
      trustedLedger = parseJsonNoDuplicate(fs.readFileSync(trustedLedgerPath, 'utf8'));
      if (hasInvalidIJsonValue(trustedLedger)) return [bindingViolation('E_IJSON', 'trustedLedger', 'Trusted ledger JSON must be I-JSON and cannot contain non-finite numbers or lone UTF-16 surrogates.')];
    }
    catch (error) { return [bindingViolation('E_TRUSTED_LEDGER', 'trustedLedger', `JSON syntax violation: ${error.message}`)]; }
  }
  return validateEmbodimentBinding(binding, filePath, historicalBundle, trustedLedger, Boolean(historicalBundlePath));
}

// ── SOUL.md parser ────────────────────────────────────────────────────────────
// SOUL.md is a Markdown file with conventions-based structure.
// We check for required sections/patterns, not strict frontmatter.

function parseSoul(content) {
  const lines = content.split('\n');
  const result = {
    hasName: false,
    name: null,
    hasPurpose: false,
    hasCoreWork: false,
    hasWhatIAmNot: false,
    hasBoundaries: false,
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Name: "## I am Sage" or "# SOUL.md - Who I Am" followed by name mention
    if (/^##\s+I am\s+(.+)/i.test(line)) {
      result.hasName = true;
      result.name = line.match(/^##\s+I am\s+(.+)/i)[1].trim();
    }
    // Also accept "# I am X" at h1
    if (/^#\s+I am\s+(.+)/i.test(line) && !result.hasName) {
      result.hasName = true;
      result.name = line.match(/^#\s+I am\s+(.+)/i)[1].trim();
    }

    // Purpose: look for "My purpose is" or "## Purpose" section
    if (/my purpose is/i.test(line) || /^##\s*Purpose/i.test(line)) {
      result.hasPurpose = true;
    }

    // Core Work: "## Core Work" section
    if (/^##\s*Core Work/i.test(line)) {
      result.hasCoreWork = true;
    }

    // What I Am Not: "## What I Am Not" section
    if (/^##\s*What I Am Not/i.test(line)) {
      result.hasWhatIAmNot = true;
    }

    // Boundaries: "## My Boundaries" or "## Boundaries"
    if (/^##\s*(My\s*)?Bounds?aries?/i.test(line)) {
      result.hasBoundaries = true;
    }
  }

  return result;
}

function validateSoul(dirPath) {
  const filePath = path.join(dirPath, 'SOUL.md');
  const violations = [];

  if (!fs.existsSync(filePath)) {
    return [violation('SOUL.md', 'file', 'SOUL.md does not exist. Required for Named Identity compliance.')];
  }

  const content = fs.readFileSync(filePath, 'utf8');

  if (content.trim().length < 100) {
    violations.push(violation('SOUL.md', 'content', 'SOUL.md appears empty or too short. Minimum meaningful content required.'));
    return violations;
  }

  const parsed = parseSoul(content);

  if (!parsed.hasName) {
    violations.push(violation('SOUL.md', 'name', 'No "## I am <Name>" section found. Named Identity requires a declared name.'));
  }

  if (!parsed.hasPurpose) {
    violations.push(violation('SOUL.md', 'purpose', 'No purpose declaration found. Look for "My purpose is..." or a "## Purpose" section.'));
  }

  if (!parsed.hasCoreWork) {
    violations.push(violation('SOUL.md', 'core_work', 'No "## Core Work" section found. Defined Purpose requires a declared scope of work.'));
  }

  if (!parsed.hasWhatIAmNot) {
    violations.push(violation('SOUL.md', 'what_i_am_not', 'No "## What I Am Not" section found. Defined Purpose requires explicit boundary declaration.'));
  }

  if (!parsed.hasBoundaries) {
    violations.push(violation('SOUL.md', 'boundaries', 'No "## My Boundaries" section found. Bounded Authority requires explicit boundary rules.'));
  }

  return violations;
}

// ── IDENTITY.md parser ────────────────────────────────────────────────────────

function parseIdentity(content) {
  const result = {
    hasName: false,
    name: null,
    hasCreature: false,
    hasPurpose: false,
  };

  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Name: "# IDENTITY.md - Sage" or "- **Name:** Sage"
    const h1Match = trimmed.match(/^#\s+IDENTITY\.md\s*[-–]\s*(.+)/i);
    if (h1Match) {
      result.hasName = true;
      result.name = h1Match[1].trim();
    }

    const nameField = trimmed.match(/^\*\*Name:\*\*\s*(.+)/);
    if (nameField) {
      result.hasName = true;
      result.name = nameField[1].trim();
    }

    // Creature: "- **Creature:** ..."
    if (/\*\*Creature:\*\*/i.test(trimmed)) {
      result.hasCreature = true;
    }

    // Purpose: "## Purpose" section or any paragraph under it
    if (/^##\s*Purpose/i.test(trimmed)) {
      result.hasPurpose = true;
    }
    // Also count inline purpose description
    if (/I help|my purpose|I assist/i.test(trimmed) && !result.hasPurpose) {
      result.hasPurpose = true;
    }
  }

  return result;
}

function validateIdentity(dirPath) {
  const filePath = path.join(dirPath, 'IDENTITY.md');
  const violations = [];

  if (!fs.existsSync(filePath)) {
    return [violation('IDENTITY.md', 'file', 'IDENTITY.md does not exist. Required for Named Identity compliance.')];
  }

  const content = fs.readFileSync(filePath, 'utf8');

  if (content.trim().length < 50) {
    violations.push(violation('IDENTITY.md', 'content', 'IDENTITY.md appears empty or too short.'));
    return violations;
  }

  const parsed = parseIdentity(content);

  if (!parsed.hasName) {
    violations.push(violation('IDENTITY.md', 'name', 'No name found. Expected "# IDENTITY.md - <Name>" or "- **Name:** <Name>".'));
  }

  if (!parsed.hasCreature) {
    violations.push(violation('IDENTITY.md', 'creature', 'No "**Creature:**" field found. IDENTITY.md requires a creature/type declaration.'));
  }

  if (!parsed.hasPurpose) {
    violations.push(violation('IDENTITY.md', 'purpose', 'No purpose description found. IDENTITY.md requires a purpose statement.'));
  }

  return violations;
}

// ── ward.toml validation ─────────────────────────────────────────────────────

const wardSchema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schemas', 'ward.schema.json'), 'utf8'));
const validateWardSchema = new Ajv({ allErrors: true, strict: false }).compile(wardSchema);

const APPROVAL_PATHS = Object.freeze({
  auto: 'AutoRegression',
  familiar_review: 'FamiliarCoherence',
  human_review: 'HumanApproval',
  human_required: 'HumanApprovalWithRationale',
});

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseWardToml(content) {
  try {
    return { ward: TOML.parse(content), error: null };
  } catch (error) {
    return { ward: null, error };
  }
}

function schemaViolations(errors) {
  return errors.map(error => {
    const instancePath = error.instancePath || '/';
    return violation(
      'ward.toml',
      `schema ${instancePath} [${error.keyword}]`,
      `Schema validation failed at ${instancePath} (${error.keyword}): ${error.message}.`
    );
  });
}

function validateApprovalTiers(ward) {
  const violations = [];
  const editableBlocks = new Set(ward.editable.harness_blocks);
  const blockApprovalPaths = new Map();

  for (const [tierName, tier] of Object.entries(ward.approval_tiers)) {
    for (const block of tier.blocks) {
      const previousTier = blockApprovalPaths.get(block);
      if (previousTier && previousTier.tierName !== tierName) {
        violations.push(violation(
          'ward.toml',
          `approval_tiers.${tierName}.blocks`,
          `Ambiguous SurfaceRegionId "${block}" is mapped to multiple ApprovalPaths: ${previousTier.tierName} (${previousTier.approvalPath}) and ${tierName} (${APPROVAL_PATHS[tierName]}).`
        ));
      } else {
        blockApprovalPaths.set(block, { tierName, approvalPath: APPROVAL_PATHS[tierName] });
      }

      if (!editableBlocks.has(block)) {
        violations.push(violation(
          'ward.toml',
          `approval_tiers.${tierName}.blocks`,
          `Harness block "${block}" is not declared in editable.harness_blocks.`
        ));
      }
    }
  }

  return violations;
}

function validateWard(dirPath) {
  const filePath = path.join(dirPath, 'ward.toml');

  if (!fs.existsSync(filePath)) {
    return [violation('ward.toml', 'file', 'ward.toml does not exist. Required for Bounded Authority and Human Belonging compliance.')];
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = parseWardToml(content);
  if (parsed.error) {
    return [violation('ward.toml', 'syntax', `TOML syntax violation: ${parsed.error.message}`)];
  }

  if (content.trim().length < 50) {
    return [violation('ward.toml', 'content', 'ward.toml appears empty or too short.')];
  }

  if (!validateWardSchema(parsed.ward)) {
    return schemaViolations(validateWardSchema.errors || []);
  }

  const violations = [];
  const ward = parsed.ward;
  const requiredProtected = ['SOUL.md', 'IDENTITY.md', 'MEMORY.md', 'ward.toml'];

  for (const required of requiredProtected) {
    if (!ward.protected.files.includes(required)) {
      violations.push(violation('ward.toml', 'protected.files', `${required} must be in the protected files list. It defines core familiar identity.`));
    }
  }

  const hasNameInvariant = ward.protected.invariants.some(invariant => invariant.includes('familiar.name'));
  const hasPersonInvariant = ward.protected.invariants.some(invariant => invariant.includes('familiar.person'));
  if (!hasNameInvariant) violations.push(violation('ward.toml', 'protected.invariants', 'No familiar.name invariant found. The familiar\'s name must be protected.'));
  if (!hasPersonInvariant) violations.push(violation('ward.toml', 'protected.invariants', 'No familiar.person invariant found. The person binding must be protected.'));

  if (ward.editable.paths.length === 0) {
    violations.push(violation('ward.toml', 'editable.paths', 'editable.paths is empty. Declare at least one editable path (e.g., TOOLS.md, HEARTBEAT.md).'));
  }

  violations.push(...validateApprovalTiers(ward));
  return violations;
}

// ── Cross-file checks ─────────────────────────────────────────────────────────

function validateCrossFile(dirPath) {
  const violations = [];
  const soulPath = path.join(dirPath, 'SOUL.md');
  const wardPath = path.join(dirPath, 'ward.toml');

  if (!fs.existsSync(soulPath) || !fs.existsSync(wardPath)) return violations;

  const soulParsed = parseSoul(fs.readFileSync(soulPath, 'utf8'));
  const wardParsed = parseWardToml(fs.readFileSync(wardPath, 'utf8'));
  const wardFamiliar = wardParsed.ward && isObject(wardParsed.ward.meta)
    ? wardParsed.ward.meta.familiar
    : null;

  if (soulParsed.name && typeof wardFamiliar === 'string') {
    const soulName = soulParsed.name.toLowerCase();
    if (soulName !== wardFamiliar.toLowerCase()) {
      violations.push(violation(
        'cross-file',
        'name consistency',
        `SOUL.md declares name "${soulParsed.name}" but ward.toml has familiar="${wardFamiliar}". These must match (case-insensitive).`
      ));
    }
  }

  return violations;
}

// ── audit-record sample validation (§5.6.1) ──────────────────────────────────
// A claimant directory MAY bundle audit-record samples under audit/ as JSON
// files. Absence is not a violation (the audit log is a runtime artifact), but
// when audit/ is present every .json file in it MUST validate against
// schemas/audit-record.schema.json, and an empty audit/ fails closed.

const auditRecordSchema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schemas', 'audit-record.schema.json'), 'utf8'));
const validateAuditRecordSchema = new Ajv({ allErrors: true, strict: false }).compile(auditRecordSchema);

function validateAuditSamples(dirPath) {
  const auditDir = path.join(dirPath, 'audit');
  const violations = [];

  if (!fs.existsSync(auditDir)) return violations;

  if (!fs.statSync(auditDir).isDirectory()) {
    return [violation('audit', 'path', 'audit exists but is not a directory. Bundle §5.6 audit-record samples as audit/*.json or omit audit/ entirely.')];
  }

  const files = fs.readdirSync(auditDir).filter((f) => f.endsWith('.json')).sort();
  if (files.length === 0) {
    return [violation('audit', 'samples', 'audit/ is present but contains no .json audit-record samples. Declare samples or omit the directory (fail closed, RFC-0001 §5.6.1).')];
  }

  for (const file of files) {
    const rel = path.join('audit', file);
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(path.join(auditDir, file), 'utf8'));
    } catch (error) {
      violations.push(violation(rel, 'syntax', `JSON syntax violation: ${error.message}`));
      continue;
    }
    if (!isObject(parsed)) {
      violations.push(violation(rel, 'shape', 'An audit-record sample must be a single JSON object (one §5.6 audit-log record per file).'));
      continue;
    }
    if (!validateAuditRecordSchema(parsed)) {
      for (const error of validateAuditRecordSchema.errors || []) {
        violations.push(violation(rel, `schema ${error.instancePath || '/'} [${error.keyword}]`, error.message || 'schema violation'));
      }
    }
  }

  return violations;
}

// ── Memory check ──────────────────────────────────────────────────────────────

function checkMemory(dirPath) {
  const memoryPath = path.join(dirPath, 'MEMORY.md');
  const violations = [];

  if (!fs.existsSync(memoryPath)) {
    violations.push({
      file: 'MEMORY.md',
      field: 'file',
      message: 'MEMORY.md does not exist. RFC-0001 §3.4 requires MEMORY.md to be present (it MAY be empty or a bootstrap stub, but it MUST exist so it can be in [protected].files).'
    });
  }

  return violations;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
${bold('familiar-contract validator')} — checks a familiar directory for spec compliance

${bold('Usage:')}
  npm install
  node validate.js <path-to-familiar-directory>
  node validate.js --embodiment-binding <path-to-binding.json> [--historical-bundle <path-to-bundle.json>]

${bold('Examples:')}
  node validate.js examples/sage
  node validate.js examples/minimal
  node validate.js /path/to/my/familiar

${bold('Checks:')}
  • SOUL.md      — Named Identity + Defined Purpose + Bounded Authority (surface rules)
  • IDENTITY.md  — Named Identity (machine-readable record)
  • ward.toml    — TOML syntax + JSON Schema, then Bounded Authority + Human Belonging checks
  • MEMORY.md    — Persistent Memory (required; missing is a violation)
  • audit/*.json — Optional §5.6 audit-record samples (JSON Schema; §5.6.1 hash encodings)
  • Cross-file   — Name consistency between SOUL.md and ward.toml
  • Embodiment binding — exact root/revision dispatch binding and its integrity

${bold('Exit codes:')}
  0  — PASS (all checks pass)
  1  — FAIL (one or more violations)
`);
    process.exit(0);
  }

  if (args[0] === '--embodiment-binding') {
    if (args.length < 2) {
      console.error(red('Error: --embodiment-binding requires a JSON file.'));
      process.exit(1);
    }
    const filePath = path.resolve(args[1]);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      console.error(red(`Error: Binding file not found: ${filePath}`));
      process.exit(1);
    }
    const bundleIndex = args.indexOf('--historical-bundle');
    const ledgerIndex = args.indexOf('--trusted-ledger');
    const historicalBundlePath = bundleIndex >= 0 && args[bundleIndex + 1] && path.resolve(args[bundleIndex + 1]);
    const trustedLedgerPath = ledgerIndex >= 0 && args[ledgerIndex + 1] && path.resolve(args[ledgerIndex + 1]);
    if (historicalBundlePath && (!fs.existsSync(historicalBundlePath) || !fs.statSync(historicalBundlePath).isFile())) {
      console.error(red(`Error: Historical bundle file not found: ${historicalBundlePath}`));
      process.exit(1);
    }
    const bindingViolations = validateEmbodimentBindingFile(filePath, historicalBundlePath, trustedLedgerPath);
    if (bindingViolations.length === 0) {
      console.log(green(bold('✓ PASS')) + ' — Embodiment binding validation passed.');
      process.exit(0);
    }
    console.log(red(bold(`✗ FAIL`)) + ` — ${bindingViolations.length} embodiment-binding violation${bindingViolations.length !== 1 ? 's' : ''}:`);
    for (const v of bindingViolations) {
      console.log(`  ${red('✗')} ${bold(v.field)}\n    ${v.message}`);
    }
    process.exit(1);
  }

  const dirPath = path.resolve(args[0]);

  if (!fs.existsSync(dirPath)) {
    console.error(red(`Error: Directory not found: ${dirPath}`));
    process.exit(1);
  }

  if (!fs.statSync(dirPath).isDirectory()) {
    console.error(red(`Error: Path is not a directory: ${dirPath}`));
    process.exit(1);
  }

  console.log(`\n${bold('familiar-contract validator')} ${dim('v0.7.0')}`);
  console.log(dim(`Checking: ${dirPath}\n`));

  const allViolations = [];

  // Run validators
  const soulViolations = validateSoul(dirPath);
  const identityViolations = validateIdentity(dirPath);
  const wardViolations = validateWard(dirPath);
  const crossViolations = validateCrossFile(dirPath);
  const memoryViolations = checkMemory(dirPath);
  const auditViolations = validateAuditSamples(dirPath);

  allViolations.push(...soulViolations, ...identityViolations, ...wardViolations, ...crossViolations);
  allViolations.push(...memoryViolations, ...auditViolations);

  // Property coverage report.
  // Attribution is fail-closed (N-7): every violation must mark at least one of
  // the five properties as failing; a violation that no rule recognizes marks
  // every property it could plausibly belong to via its source file's default.
  const PROPERTIES = ['Named Identity', 'Defined Purpose', 'Bounded Authority', 'Persistent Memory', 'Human Belonging'];

  function propertiesFor(v) {
    if (v.file === 'SOUL.md') {
      if (v.field === 'name') return ['Named Identity'];
      if (['purpose', 'core_work', 'what_i_am_not'].includes(v.field)) return ['Defined Purpose'];
      if (v.field === 'boundaries') return ['Bounded Authority'];
      // file/content/unknown: SOUL.md carries all three of its properties
      return ['Named Identity', 'Defined Purpose', 'Bounded Authority'];
    }
    if (v.file === 'IDENTITY.md') {
      // name/file/creature/purpose/content all serve the machine-readable identity record
      return ['Named Identity'];
    }
    if (v.file === 'ward.toml') {
      if (['meta.person', 'protected.invariants'].includes(v.field)) return ['Human Belonging'];
      if (v.field.startsWith('approval_tiers.') || v.field === '[approval_tiers]'
        || v.field.startsWith('schema /approval_tiers') || v.field.startsWith('schema /editable')
        || v.field.startsWith('schema /protected')
        || ['[protected]', 'protected.files', '[editable]', 'editable.paths'].includes(v.field)) {
        return ['Bounded Authority'];
      }
      if (v.field.startsWith('schema /meta')) return ['Human Belonging'];
      // file/syntax/content/root-schema failures: ward.toml underwrites both properties
      return ['Bounded Authority', 'Human Belonging'];
    }
    if (v.file === 'MEMORY.md') return ['Persistent Memory'];
    if (v.file === 'audit' || v.file.startsWith('audit/') || v.file.startsWith('audit\\')) {
      // §5.6.1 audit-record samples underwrite provenance (memory) and accountability (authority)
      return ['Bounded Authority', 'Persistent Memory'];
    }
    if (v.file === 'cross-file') return ['Named Identity'];
    // Unknown source: fail closed across the board
    return PROPERTIES;
  }

  const failedProperties = new Set();
  for (const v of allViolations) {
    for (const prop of propertiesFor(v)) failedProperties.add(prop);
  }

  const propertyCoverage = Object.fromEntries(
    PROPERTIES.map(prop => [prop, !failedProperties.has(prop)])
  );

  console.log(bold('Property Coverage:'));
  for (const [prop, pass] of Object.entries(propertyCoverage)) {
    console.log(`  ${pass ? green('✓') : red('✗')} ${prop}`);
  }
  console.log('');

  if (allViolations.length === 0) {
    console.log(green(bold('✓ PASS')) + ' — Directory validation passed. Structural conformance additionally requires `npm test` in this repository.\n');
    process.exit(0);
  }

  if (allViolations.length > 0) {
    console.log(red(bold(`✗ FAIL`)) + ` — ${allViolations.length} violation${allViolations.length !== 1 ? 's' : ''}:\n`);
    for (const v of allViolations) {
      console.log(`  ${red('✗')} ${bold(v.file)} › ${yellow(v.field)}`);
      console.log(`    ${v.message}\n`);
    }
  }

  if (allViolations.length > 0) {
    process.exit(1);
  }
}

main();
