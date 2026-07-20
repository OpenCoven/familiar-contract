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
 * No external dependencies required (optional: ajv for strict JSON Schema validation)
 */

'use strict';

const fs = require('fs');
const path = require('path');

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

// ── ward.toml parser ──────────────────────────────────────────────────────────
// Minimal TOML parser for the fields we need. Only handles the subset used in ward.toml.

function parseWardToml(content) {
  const result = {
    hasMeta: false,
    metaFamiliar: null,
    metaPerson: null,
    metaVersion: null,
    hasProtected: false,
    protectedFiles: [],
    protectedInvariants: [],
    hasEditable: false,
    editablePaths: [],
    hasApprovalTiers: false,
    hasAutoTier: false,
    hasHumanReviewTier: false,
  };

  const lines = content.split('\n');
  let currentSection = null;
  let currentSubSection = null;
  let inArray = false;
  let arrayTarget = null;
  let arrayBuffer = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed === '') continue;

    // Section headers
    if (/^\[meta\]/.test(trimmed)) { currentSection = 'meta'; currentSubSection = null; continue; }
    if (/^\[protected\]/.test(trimmed)) { currentSection = 'protected'; currentSubSection = null; result.hasProtected = true; continue; }
    if (/^\[editable\]/.test(trimmed)) { currentSection = 'editable'; currentSubSection = null; result.hasEditable = true; continue; }
    if (/^\[approval_tiers\]/.test(trimmed)) { currentSection = 'approval_tiers'; currentSubSection = null; result.hasApprovalTiers = true; continue; }
    if (/^\[approval_tiers\.auto\]/.test(trimmed)) { currentSubSection = 'auto'; result.hasAutoTier = true; continue; }
    if (/^\[approval_tiers\.human_review\]/.test(trimmed)) { currentSubSection = 'human_review'; result.hasHumanReviewTier = true; continue; }
    if (/^\[approval_tiers\.\w+\]/.test(trimmed)) { currentSubSection = 'other'; continue; }
    if (/^\[audit\]/.test(trimmed)) { currentSection = 'audit'; currentSubSection = null; continue; }
    if (/^\[\w/.test(trimmed) && /^\[/.test(trimmed)) { currentSection = 'other'; currentSubSection = null; continue; }

    // Array start
    if (!inArray && /=\s*\[/.test(trimmed) && !/\]$/.test(trimmed.replace(/\s*#.*/, ''))) {
      inArray = true;
      const keyMatch = trimmed.match(/^(\w+)\s*=/);
      if (keyMatch) arrayTarget = { section: currentSection, key: keyMatch[1] };
      arrayBuffer = [];
      // Capture any items on the opening line
      const inline = trimmed.replace(/^[^[]*\[/, '').trim();
      if (inline) arrayBuffer.push(...inline.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean));
      continue;
    }

    // Array end
    if (inArray && /^\]/.test(trimmed)) {
      inArray = false;
      if (arrayTarget) {
        if (arrayTarget.section === 'protected' && arrayTarget.key === 'files') result.protectedFiles = [...arrayBuffer];
        if (arrayTarget.section === 'protected' && arrayTarget.key === 'invariants') result.protectedInvariants = [...arrayBuffer];
        if (arrayTarget.section === 'editable' && arrayTarget.key === 'paths') result.editablePaths = [...arrayBuffer];
      }
      arrayTarget = null;
      arrayBuffer = [];
      continue;
    }

    // Array item
    if (inArray) {
      const item = trimmed.replace(/^["']|["'],?\s*$|["']$/g, '').trim();
      if (item && !item.startsWith('#')) arrayBuffer.push(item);
      continue;
    }

    // Inline array (whole array on one line)
    if (/=\s*\[.+\]/.test(trimmed)) {
      const keyMatch = trimmed.match(/^(\w+)\s*=\s*\[(.+)\]/);
      if (keyMatch) {
        const key = keyMatch[1];
        const items = keyMatch[2].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
        if (currentSection === 'protected' && key === 'files') result.protectedFiles = items;
        if (currentSection === 'protected' && key === 'invariants') result.protectedInvariants = items;
        if (currentSection === 'editable' && key === 'paths') result.editablePaths = items;
      }
      continue;
    }

    // Key-value pairs
    const kvMatch = trimmed.match(/^(\w+)\s*=\s*["']?([^"'#\n]+?)["']?\s*(#.*)?$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const value = kvMatch[2].trim();
      if (currentSection === 'meta') {
        result.hasMeta = true;
        if (key === 'familiar') result.metaFamiliar = value;
        if (key === 'person') result.metaPerson = value;
        if (key === 'version') result.metaVersion = value;
      }
    }
  }

  return result;
}

function validateWard(dirPath) {
  const filePath = path.join(dirPath, 'ward.toml');
  const violations = [];

  if (!fs.existsSync(filePath)) {
    return [violation('ward.toml', 'file', 'ward.toml does not exist. Required for Bounded Authority and Human Belonging compliance.')];
  }

  const content = fs.readFileSync(filePath, 'utf8');

  if (content.trim().length < 50) {
    violations.push(violation('ward.toml', 'content', 'ward.toml appears empty or too short.'));
    return violations;
  }

  const parsed = parseWardToml(content);

  if (!parsed.hasMeta) {
    violations.push(violation('ward.toml', '[meta]', '[meta] section missing. Required: version, familiar, person.'));
  } else {
    if (!parsed.metaFamiliar) violations.push(violation('ward.toml', 'meta.familiar', 'meta.familiar is missing. Must match the familiar\'s name.'));
    if (!parsed.metaPerson) violations.push(violation('ward.toml', 'meta.person', 'meta.person is missing. Human Belonging requires a declared person binding.'));
    if (!parsed.metaVersion) violations.push(violation('ward.toml', 'meta.version', 'meta.version is missing. Ward must be versioned.'));
  }

  if (!parsed.hasProtected) {
    violations.push(violation('ward.toml', '[protected]', '[protected] section missing. The protected surface must be declared.'));
  } else {
    const requiredProtected = ['SOUL.md', 'IDENTITY.md', 'MEMORY.md', 'ward.toml'];
    for (const required of requiredProtected) {
      if (!parsed.protectedFiles.includes(required)) {
        violations.push(violation('ward.toml', 'protected.files', `${required} must be in the protected files list. It defines core familiar identity.`));
      }
    }

    if (parsed.protectedInvariants.length === 0) {
      violations.push(violation('ward.toml', 'protected.invariants', 'No invariants declared. At minimum, familiar.name and familiar.person must be invariants.'));
    } else {
      const hasNameInvariant = parsed.protectedInvariants.some(inv => inv.includes('familiar.name'));
      const hasPersonInvariant = parsed.protectedInvariants.some(inv => inv.includes('familiar.person'));
      if (!hasNameInvariant) violations.push(violation('ward.toml', 'protected.invariants', 'No familiar.name invariant found. The familiar\'s name must be protected.'));
      if (!hasPersonInvariant) violations.push(violation('ward.toml', 'protected.invariants', 'No familiar.person invariant found. The person binding must be protected.'));
    }
  }

  if (!parsed.hasEditable) {
    violations.push(violation('ward.toml', '[editable]', '[editable] section missing. The editable surface must be declared (even if minimal).'));
  } else {
    if (parsed.editablePaths.length === 0) {
      violations.push(violation('ward.toml', 'editable.paths', 'editable.paths is empty. Declare at least one editable path (e.g., TOOLS.md, HEARTBEAT.md).'));
    }
  }

  if (!parsed.hasApprovalTiers) {
    violations.push(violation('ward.toml', '[approval_tiers]', '[approval_tiers] section missing. Approval tiers must be defined.'));
  } else {
    if (!parsed.hasAutoTier) {
      violations.push(violation('ward.toml', 'approval_tiers.auto', '[approval_tiers.auto] (Tier 0) not found. Auto tier must be defined even if empty.'));
    }
    if (!parsed.hasHumanReviewTier) {
      violations.push(violation('ward.toml', 'approval_tiers.human_review', '[approval_tiers.human_review] (Tier 2) not found. Human review tier is required.'));
    }
  }

  return violations;
}

// ── Cross-file checks ─────────────────────────────────────────────────────────

function validateCrossFile(dirPath) {
  const violations = [];
  const soulPath = path.join(dirPath, 'SOUL.md');
  const wardPath = path.join(dirPath, 'ward.toml');

  if (!fs.existsSync(soulPath) || !fs.existsSync(wardPath)) return violations;

  const soulContent = fs.readFileSync(soulPath, 'utf8');
  const wardContent = fs.readFileSync(wardPath, 'utf8');
  const soulParsed = parseSoul(soulContent);
  const wardParsed = parseWardToml(wardContent);

  // Check name consistency
  if (soulParsed.name && wardParsed.metaFamiliar) {
    const soulName = soulParsed.name.toLowerCase();
    const wardFamiliar = wardParsed.metaFamiliar.toLowerCase();
    if (soulName !== wardFamiliar) {
      violations.push(violation(
        'cross-file',
        'name consistency',
        `SOUL.md declares name "${soulParsed.name}" but ward.toml has familiar="${wardParsed.metaFamiliar}". These must match (case-insensitive).`
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
  node validate.js <path-to-familiar-directory>

${bold('Examples:')}
  node validate.js examples/sage
  node validate.js examples/minimal
  node validate.js /path/to/my/familiar

${bold('Checks:')}
  • SOUL.md      — Named Identity + Defined Purpose + Bounded Authority (surface rules)
  • IDENTITY.md  — Named Identity (machine-readable record)
  • ward.toml    — Bounded Authority + Human Belonging (enforcement declarations)
  • MEMORY.md    — Persistent Memory (warning if missing)
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

  console.log(`\n${bold('familiar-contract validator')} ${dim('v0.3.0')}`);
  console.log(dim(`Checking: ${dirPath}\n`));

  const allViolations = [];
  const allWarnings = [];

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

  if (allViolations.length === 0 && allWarnings.length === 0) {
    console.log(green(bold('✓ PASS')) + ' — All checks passed. This familiar is familiar-contract v0.3.0 compliant (RFC-0001).\n');
    process.exit(0);
  }

  if (allViolations.length > 0) {
    console.log(red(bold(`✗ FAIL`)) + ` — ${allViolations.length} violation${allViolations.length !== 1 ? 's' : ''}:\n`);
    for (const v of allViolations) {
      console.log(`  ${red('✗')} ${bold(v.file)} › ${yellow(v.field)}`);
      console.log(`    ${v.message}\n`);
    }
  }

  if (allWarnings.length > 0) {
    console.log(yellow(bold(`⚠ Warnings:`)) + ` ${allWarnings.length} warning${allWarnings.length !== 1 ? 's' : ''}:\n`);
    for (const w of allWarnings) {
      console.log(`  ${yellow('⚠')} ${bold(w.file)} › ${yellow(w.field)}`);
      console.log(`    ${w.message}\n`);
    }
  }

  if (allViolations.length > 0) {
    process.exit(1);
  } else {
    // Warnings only — still passes
    console.log(green(bold('✓ PASS')) + ' — No violations (with warnings above). Address warnings to achieve full compliance.\n');
    process.exit(0);
  }
}

main();
