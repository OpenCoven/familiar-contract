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

const APPROVAL_TIER_RULES = Object.freeze(Object.assign(Object.create(null), {
  auto: {
    gate: 'regression_suite',
    approvalPath: 'AutoRegression',
    vetoAllowed: true,
    fields: ['blocks', 'gate', 'cave_board_card', 'human_veto_window_hours'],
  },
  familiar_review: {
    gate: 'familiar_coherence_check',
    approvalPath: 'FamiliarCoherence',
    vetoAllowed: true,
    fields: ['blocks', 'gate', 'cave_board_card', 'human_veto_window_hours'],
  },
  human_review: {
    gate: 'human_approval',
    approvalPath: 'HumanApproval',
    vetoAllowed: false,
    fields: ['blocks', 'gate', 'cave_board_card'],
  },
  human_required: {
    gate: 'human_approval_with_rationale',
    approvalPath: 'HumanApprovalWithRationale',
    vetoAllowed: false,
    fields: ['blocks', 'gate', 'cave_board_card', 'audit_log'],
  },
}));

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function createNullPrototypeMap() {
  return Object.create(null);
}

function parseTomlScalar(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    if (trimmed.startsWith('"')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // fall through to the raw interior text below
      }
    }
    return trimmed.slice(1, -1);
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function hasParsedApprovalTierKey(key) {
  return key !== null;
}

function formatTomlPathKey(key) {
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
}

function formatApprovalTierPath(tierName) {
  return `approval_tiers.${formatTomlPathKey(tierName)}`;
}

function formatApprovalTierFieldPath(tierName, field) {
  return `${formatApprovalTierPath(tierName)}.${formatTomlPathKey(field)}`;
}

function parseWardToml(content) {
  const APPROVAL_TIER_KEY_TOKEN = /(?:"(?:\\.|[^"\\])*"|'[^']*'|[A-Za-z0-9_-]+)/;
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
    editableHarnessBlocks: [],
    hasApprovalTiers: false,
    hasAutoTier: false,
    hasHumanReviewTier: false,
    approvalTiers: createNullPrototypeMap(),
    unknownApprovalTiers: [],
    duplicateApprovalTierTables: [],
    duplicateApprovalTierFields: [],
  };

  const lines = content.split('\n');
  let currentSection = null;
  let currentSubSection = null;
  let allowCurrentTierAssignments = true;
  let inArray = false;
  let arrayTarget = null;
  let arrayBuffer = [];

  function approvalTier(name) {
    if (!hasOwn(result.approvalTiers, name)) {
      result.approvalTiers[name] = { blocks: [], fields: createNullPrototypeMap(), fieldNames: [], seenFields: new Set() };
    }
    return result.approvalTiers[name];
  }

  function findUnquotedChar(value, targetChar) {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escapeNext = false;

    for (let i = 0; i < value.length; i++) {
      const char = value[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\' && inDoubleQuote) {
        escapeNext = true;
        continue;
      }

      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        continue;
      }
      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }
      if (char === targetChar && !inSingleQuote && !inDoubleQuote) {
        return i;
      }
    }

    return -1;
  }

  function stripTomlComment(value) {
    const commentStart = findUnquotedChar(value, '#');
    return commentStart >= 0 ? value.slice(0, commentStart).trim() : value.trim();
  }

  function parseArrayItems(value) {
    const items = [];
    let currentItem = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escapeNext = false;

    function pushCurrentItem() {
      const trimmed = currentItem.trim();
      if (trimmed !== '') items.push(parseTomlScalar(trimmed));
      currentItem = '';
    }

    for (let i = 0; i < value.length; i++) {
      const char = value[i];

      if (escapeNext) {
        currentItem += char;
        escapeNext = false;
        continue;
      }

      if (char === '\\' && inDoubleQuote) {
        currentItem += char;
        escapeNext = true;
        continue;
      }

      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        currentItem += char;
        continue;
      }
      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        currentItem += char;
        continue;
      }

      if (char === ',' && !inSingleQuote && !inDoubleQuote) {
        pushCurrentItem();
        continue;
      }

      currentItem += char;
    }

    pushCurrentItem();
    return items;
  }

  function parseApprovalTierTableName(header) {
    const match = header.match(new RegExp(`^\\[\\s*approval_tiers\\s*\\.\\s*(${APPROVAL_TIER_KEY_TOKEN.source})\\s*\\]$`));
    if (!match) return null;
    return parseApprovalTierKeyName(match[1]);
  }

  function parseApprovalTierKeyName(rawKey) {
    const trimmed = rawKey.trim();
    if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed.slice(1, -1);
      }
    }
    return null;
  }

  function parseApprovalTierAssignment(value) {
    const arrayMatch = value.match(new RegExp(`^(${APPROVAL_TIER_KEY_TOKEN.source})\\s*=\\s*\\[(.*)$`));
    if (arrayMatch) {
      return {
        key: parseApprovalTierKeyName(arrayMatch[1]),
        isArray: true,
        rawValue: arrayMatch[2],
      };
    }

    const scalarMatch = value.match(new RegExp(`^(${APPROVAL_TIER_KEY_TOKEN.source})\\s*=\\s*(.+)$`));
    if (scalarMatch) {
      return {
        key: parseApprovalTierKeyName(scalarMatch[1]),
        isArray: false,
        rawValue: scalarMatch[2].trim(),
      };
    }

    return null;
  }

  function assignApprovalTierField(tierName, key, value) {
    const tier = approvalTier(tierName);
    if (tier.seenFields.has(key)) {
      result.duplicateApprovalTierFields.push({ tierName, field: key });
      return;
    }

    tier.seenFields.add(key);
    tier.fieldNames.push(key);
    tier.fields[key] = value;
    if (key === 'blocks' && Array.isArray(value)) {
      tier.blocks = [...value];
    }
  }

  function assignArray(target, items) {
    if (target.section === 'protected' && target.key === 'files') result.protectedFiles = [...items];
    if (target.section === 'protected' && target.key === 'invariants') result.protectedInvariants = [...items];
    if (target.section === 'editable' && target.key === 'paths') result.editablePaths = [...items];
    if (target.section === 'editable' && target.key === 'harness_blocks') result.editableHarnessBlocks = [...items];
    if (target.section === 'approval_tiers' && target.subSection !== null && target.allowAssignment) {
      assignApprovalTierField(target.subSection, target.key, [...items]);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = stripTomlComment(line);

    // Skip comments and empty lines
    if (trimmed === '') continue;

    // Section headers
    if (/^\[meta\]$/.test(trimmed)) { currentSection = 'meta'; currentSubSection = null; allowCurrentTierAssignments = true; continue; }
    if (/^\[protected\]$/.test(trimmed)) { currentSection = 'protected'; currentSubSection = null; allowCurrentTierAssignments = true; result.hasProtected = true; continue; }
    if (/^\[editable\]$/.test(trimmed)) { currentSection = 'editable'; currentSubSection = null; allowCurrentTierAssignments = true; result.hasEditable = true; continue; }
    if (/^\[approval_tiers\]$/.test(trimmed)) { currentSection = 'approval_tiers'; currentSubSection = null; allowCurrentTierAssignments = true; result.hasApprovalTiers = true; continue; }
    const tierName = parseApprovalTierTableName(trimmed);
    if (hasParsedApprovalTierKey(tierName)) {
      currentSection = 'approval_tiers';
      currentSubSection = tierName;
      result.hasApprovalTiers = true;
      const isDuplicateTable = hasOwn(result.approvalTiers, tierName);
      allowCurrentTierAssignments = !isDuplicateTable;
      if (isDuplicateTable) {
        result.duplicateApprovalTierTables.push(tierName);
      }
      approvalTier(tierName);
      if (tierName === 'auto') result.hasAutoTier = true;
      if (tierName === 'human_review') result.hasHumanReviewTier = true;
      if (!hasOwn(APPROVAL_TIER_RULES, tierName)) result.unknownApprovalTiers.push(tierName);
      continue;
    }
    if (/^\[audit\]$/.test(trimmed)) { currentSection = 'audit'; currentSubSection = null; allowCurrentTierAssignments = true; continue; }
    if (/^\[\w/.test(trimmed) && /^\[/.test(trimmed)) { currentSection = 'other'; currentSubSection = null; allowCurrentTierAssignments = true; continue; }

    if (inArray) {
      const closingBracket = findUnquotedChar(trimmed, ']');
      if (closingBracket >= 0) {
        arrayBuffer.push(...parseArrayItems(trimmed.slice(0, closingBracket)));
        assignArray(arrayTarget, arrayBuffer);
        inArray = false;
        arrayTarget = null;
        arrayBuffer = [];
      } else {
        arrayBuffer.push(...parseArrayItems(trimmed));
      }
      continue;
    }

    const approvalTierAssignment = currentSection === 'approval_tiers' && currentSubSection !== null
      ? parseApprovalTierAssignment(trimmed)
      : null;

    if (approvalTierAssignment && approvalTierAssignment.isArray && hasParsedApprovalTierKey(approvalTierAssignment.key)) {
      const target = {
        section: currentSection,
        subSection: currentSubSection,
        key: approvalTierAssignment.key,
        allowAssignment: allowCurrentTierAssignments,
      };
      const closingBracket = findUnquotedChar(approvalTierAssignment.rawValue, ']');
      if (closingBracket >= 0) {
        assignArray(target, parseArrayItems(approvalTierAssignment.rawValue.slice(0, closingBracket)));
      } else {
        inArray = true;
        arrayTarget = target;
        arrayBuffer = parseArrayItems(approvalTierAssignment.rawValue);
      }
      continue;
    }

    const arrayMatch = trimmed.match(/^([A-Za-z0-9_-]+)\s*=\s*\[(.*)$/);
    if (arrayMatch) {
      const target = { section: currentSection, subSection: currentSubSection, key: arrayMatch[1], allowAssignment: allowCurrentTierAssignments };
      const closingBracket = findUnquotedChar(arrayMatch[2], ']');
      if (closingBracket >= 0) {
        assignArray(target, parseArrayItems(arrayMatch[2].slice(0, closingBracket)));
      } else {
        inArray = true;
        arrayTarget = target;
        arrayBuffer = parseArrayItems(arrayMatch[2]);
      }
      continue;
    }

    // Key-value pairs
    if (approvalTierAssignment && hasParsedApprovalTierKey(approvalTierAssignment.key)) {
      if (allowCurrentTierAssignments) {
        assignApprovalTierField(currentSubSection, approvalTierAssignment.key, parseTomlScalar(approvalTierAssignment.rawValue));
      }
      continue;
    }

    const kvMatch = trimmed.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const rawValue = kvMatch[2].trim();
      const value = rawValue.replace(/^["']|["']$/g, '');
      if (currentSection === 'meta') {
        result.hasMeta = true;
        if (key === 'familiar') result.metaFamiliar = value;
        if (key === 'person') result.metaPerson = value;
        if (key === 'version') result.metaVersion = value;
      }
      if (currentSection === 'approval_tiers' && currentSubSection !== null && allowCurrentTierAssignments) {
        assignApprovalTierField(currentSubSection, key, parseTomlScalar(rawValue));
      }
    }
  }

  return result;
}

function validateApprovalTiers(parsed) {
  const violations = [];
  const BOOLEAN_FIELDS = new Set(['cave_board_card', 'audit_log']);

  for (const tierName of parsed.unknownApprovalTiers) {
    violations.push(violation(
      'ward.toml',
      formatApprovalTierPath(tierName),
      `Unknown approval tier "${tierName}".`
    ));
  }

  for (const tierName of parsed.duplicateApprovalTierTables) {
    violations.push(violation(
      'ward.toml',
      formatApprovalTierPath(tierName),
      `Duplicate approval tier table declaration for ${formatApprovalTierPath(tierName)}. Duplicate tier tables are ambiguous and forbidden.`
    ));
  }

  for (const duplicateField of parsed.duplicateApprovalTierFields) {
    violations.push(violation(
      'ward.toml',
      formatApprovalTierFieldPath(duplicateField.tierName, duplicateField.field),
      `Duplicate field "${duplicateField.field}" declared in ${formatApprovalTierPath(duplicateField.tierName)}. Duplicate approval-tier fields are ambiguous and forbidden.`
    ));
  }

  const seenEditableHarnessBlocks = new Set();
  parsed.editableHarnessBlocks.forEach((block, index) => {
    if (typeof block !== 'string') {
      violations.push(violation(
        'ward.toml',
        `editable.harness_blocks[${index}]`,
        `Harness block identifiers must be TOML strings; found ${typeof block} ${JSON.stringify(block)}.`
      ));
      return;
    }

    if (block.trim() === '') {
      violations.push(violation(
        'ward.toml',
        `editable.harness_blocks[${index}]`,
        'Harness block identifiers must be non-empty strings; empty or whitespace-only identifiers are forbidden.'
      ));
      return;
    }

    if (seenEditableHarnessBlocks.has(block)) {
      violations.push(violation(
        'ward.toml',
        'editable.harness_blocks',
        `Duplicate SurfaceRegionId declaration "${block}" in editable.harness_blocks.`
      ));
      return;
    }

    seenEditableHarnessBlocks.add(block);
  });

  for (const [tierName, tier] of Object.entries(parsed.approvalTiers)) {
    const rule = hasOwn(APPROVAL_TIER_RULES, tierName) ? APPROVAL_TIER_RULES[tierName] : null;
    if (!rule) continue;

    for (const field of tier.fieldNames) {
      if (!rule.fields.includes(field) && field !== 'human_veto_window_hours') {
        violations.push(violation(
          'ward.toml',
          formatApprovalTierFieldPath(tierName, field),
          `Unknown field "${field}" for ${formatApprovalTierPath(tierName)}.`
        ));
      }
    }

    if (tier.fields.gate !== rule.gate) {
      violations.push(violation(
        'ward.toml',
        formatApprovalTierFieldPath(tierName, 'gate'),
        `Expected gate "${rule.gate}" for ${formatApprovalTierPath(tierName)}.`
      ));
    }

    for (const field of rule.fields) {
      if (BOOLEAN_FIELDS.has(field) && hasOwn(tier.fields, field) && typeof tier.fields[field] !== 'boolean') {
        violations.push(violation(
          'ward.toml',
          formatApprovalTierFieldPath(tierName, field),
          `${field} must be a TOML boolean when present; found ${typeof tier.fields[field]} ${JSON.stringify(tier.fields[field])}.`
        ));
      }
    }

    if (tier.blocks.length === 0) {
      violations.push(violation(
        'ward.toml',
        formatApprovalTierFieldPath(tierName, 'blocks'),
        'Approval tier blocks must not be empty.'
      ));
    }

    const seenBlocks = new Set();
    tier.blocks.forEach((block, index) => {
      if (typeof block !== 'string') {
        violations.push(violation(
          'ward.toml',
          `${formatApprovalTierFieldPath(tierName, 'blocks')}[${index}]`,
          `Harness block identifiers must be TOML strings; found ${typeof block} ${JSON.stringify(block)}.`
        ));
        return;
      }

      if (block.trim() === '') {
        violations.push(violation(
          'ward.toml',
          `${formatApprovalTierFieldPath(tierName, 'blocks')}[${index}]`,
          'Harness block identifiers must be non-empty strings; empty or whitespace-only identifiers are forbidden.'
        ));
        return;
      }

      if (seenBlocks.has(block)) {
        violations.push(violation(
          'ward.toml',
          formatApprovalTierFieldPath(tierName, 'blocks'),
          `Duplicate block "${block}" in ${formatApprovalTierFieldPath(tierName, 'blocks')}.`
        ));
      }
      seenBlocks.add(block);

      if (!parsed.editableHarnessBlocks.includes(block)) {
        violations.push(violation(
          'ward.toml',
          formatApprovalTierFieldPath(tierName, 'blocks'),
          `Harness block "${block}" is not declared in editable.harness_blocks.`
        ));
      }
    });

    if (hasOwn(tier.fields, 'human_veto_window_hours')) {
      const vetoField = formatApprovalTierFieldPath(tierName, 'human_veto_window_hours');
      if (!rule.vetoAllowed) {
        violations.push(violation(
          'ward.toml',
          vetoField,
          'Synchronous veto windows are forbidden for this approval tier.'
        ));
      } else if (!Number.isInteger(tier.fields.human_veto_window_hours) || tier.fields.human_veto_window_hours <= 0) {
        violations.push(violation(
          'ward.toml',
          vetoField,
          'A veto window must be a positive integer number of hours.'
        ));
      }
    }
  }

  return violations;
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
    violations.push(...validateApprovalTiers(parsed));
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
    console.log(green(bold('✓ PASS')) + ' — Directory validation passed. Structural conformance additionally requires `bash tests/conformance/run-conformance.sh` in this repository.\n');
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
