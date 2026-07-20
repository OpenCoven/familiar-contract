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

// ── Helpers ──────────────────────────────────────────────────────────────────

function red(s)    { return `\x1b[31m${s}\x1b[0m`; }
function green(s)  { return `\x1b[32m${s}\x1b[0m`; }
function yellow(s) { return `\x1b[33m${s}\x1b[0m`; }
function bold(s)   { return `\x1b[1m${s}\x1b[0m`; }
function dim(s)    { return `\x1b[2m${s}\x1b[0m`; }

function violation(file, field, message) {
  return { file, field, message };
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

${bold('Examples:')}
  node validate.js examples/sage
  node validate.js examples/minimal
  node validate.js /path/to/my/familiar

${bold('Checks:')}
  • SOUL.md      — Named Identity + Defined Purpose + Bounded Authority (surface rules)
  • IDENTITY.md  — Named Identity (machine-readable record)
  • ward.toml    — TOML syntax + JSON Schema, then Bounded Authority + Human Belonging checks
  • MEMORY.md    — Persistent Memory (required; missing is a violation)
  • Cross-file   — Name consistency between SOUL.md and ward.toml

${bold('Exit codes:')}
  0  — PASS (all checks pass)
  1  — FAIL (one or more violations)
`);
    process.exit(0);
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

  console.log(`\n${bold('familiar-contract validator')} ${dim('v0.4.0')}`);
  console.log(dim(`Checking: ${dirPath}\n`));

  const allViolations = [];

  // Run validators
  const soulViolations = validateSoul(dirPath);
  const identityViolations = validateIdentity(dirPath);
  const wardViolations = validateWard(dirPath);
  const crossViolations = validateCrossFile(dirPath);
  const memoryViolations = checkMemory(dirPath);

  allViolations.push(...soulViolations, ...identityViolations, ...wardViolations, ...crossViolations);
  allViolations.push(...memoryViolations);

  // Property coverage report
  const propertyCoverage = {
    'Named Identity':    soulViolations.filter(v => ['name', 'file'].includes(v.field)).length === 0
                      && identityViolations.filter(v => ['name', 'file'].includes(v.field)).length === 0,
    'Defined Purpose':   soulViolations.filter(v => ['purpose', 'core_work', 'what_i_am_not'].includes(v.field)).length === 0,
    'Bounded Authority': soulViolations.filter(v => v.field === 'boundaries').length === 0
                      && wardViolations.filter(v => ['[protected]', 'protected.files', '[editable]', 'editable.paths', '[approval_tiers]'].includes(v.field)).length === 0,
    'Persistent Memory': memoryViolations.length === 0,
    'Human Belonging':   wardViolations.filter(v => ['meta.person', 'protected.invariants'].includes(v.field)).length === 0,
  };

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
