# Approval-Tier Compiler Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make RFC-0001, `ward.schema.json`, and the standards-compliant validator define and enforce one fail-closed mapping from Ward approval-tier declarations to typed Phase 5 semantics.

**Architecture:** Keep the existing TOML keys as the portable declaration surface, but parse each approval tier into a structured validator model and validate it against one tier-rule table. JSON Schema enforces structural constraints; the validator enforces cross-field and cross-section rules such as block registration, gate matching, veto placement, and duplicate rejection. The RFC remains the normative source and explicitly excludes protected targets from the proposal pipeline.

**Tech Stack:** Markdown RFC, JSON Schema draft-07, CommonJS Node.js validator using `@iarna/toml` and Ajv v8, Bash conformance fixtures. Install with `npm install` and run the suite with `npm test`.

---

## File map

- Modify `validators/validate.js`: parse complete approval-tier declarations and enforce semantic compiler rules.
- Modify `schemas/ward.schema.json`: enforce strict tier object shapes, required fields, non-empty unique block arrays, and valid veto placement.
- Modify `rfcs/RFC-0001-familiar-contract.md`: define the normative declaration-to-type compiler and fail-closed behavior.
- Modify `docs/ward-primer.md` and `docs/ward-deep-dive.md`: explain delayed apply and deterministic tier compilation without implying protected proposals can be promoted.
- Modify `examples/minimal/ward.toml`, `examples/sage/ward.toml`, and the five positive conformance Ward fixtures: register every referenced block under `[editable].harness_blocks`.
- Create `tests/conformance/negative/11-unknown-tier-field/` through `16-invalid-veto-duration/`: executable rejection cases. Numbering starts at 11 because stacked PR #3 adds negative case 10.
- Modify `CHANGELOG.md`, `README.md`, `SPEC.md`, `rfcs/README.md`, and `docs/faq.md`: record draft v0.4.0 after PR #3's v0.3.0 amendment.

## Branch setup

This is a separate, stacked PR. Preserve the approved design/plan commits, then
merge the head of familiar-contract PR #3 so version history is linear:

```bash
git fetch origin rfc/0001-closure-provenance-amendments
git worktree add -b rfc/0001-approval-tier-compiler \
  /tmp/famcontract-approval-tier-compiler \
  docs/phase5-approval-compiler-design
cd /tmp/famcontract-approval-tier-compiler
git merge --no-edit origin/rfc/0001-closure-provenance-amendments
```

Open the PR initially against `rfc/0001-closure-provenance-amendments`. After
PR #3 merges, retarget it to `main`. Do not merge this PR before PR #3.

### Task 1: Add fail-closed conformance cases

**Files:**
- Create: `tests/conformance/negative/11-unknown-tier-field/`
- Create: `tests/conformance/negative/12-tier-gate-mismatch/`
- Create: `tests/conformance/negative/13-veto-on-human-tier/`
- Create: `tests/conformance/negative/14-unknown-tier-block/`
- Create: `tests/conformance/negative/15-duplicate-tier-block/`
- Create: `tests/conformance/negative/16-invalid-veto-duration/`

- [ ] **Step 1: Seed complete negative fixtures**

```bash
cd /tmp/famcontract-approval-tier-compiler
for name in \
  11-unknown-tier-field \
  12-tier-gate-mismatch \
  13-veto-on-human-tier \
  14-unknown-tier-block \
  15-duplicate-tier-block \
  16-invalid-veto-duration
do
  cp -R tests/conformance/positive/05-tier-rich-ward \
    "tests/conformance/negative/$name"
done
```

- [ ] **Step 2: Give every fixture a complete block registry**

In each new fixture, replace `[editable].harness_blocks` with:

```toml
harness_blocks = [
  "system_prompt.execution",
  "system_prompt.recovery",
  "tool_defaults",
  "skill_config",
  "subagent_templates",
  "output_formats",
  "heartbeat_schedule",
  "tool_grants",
  "skill_activations",
  "memory_conventions",
  "session_introduction",
]
```

- [ ] **Step 3: Add one invalid declaration to each Ward**

`11-unknown-tier-field/ward.toml`, under `[approval_tiers.auto]`:

```toml
unknown_policy = "allow"
```

`12-tier-gate-mismatch/ward.toml`:

```toml
[approval_tiers.auto]
blocks = ["output_formats", "heartbeat_schedule", "tool_defaults"]
gate = "human_approval"
cave_board_card = true
human_veto_window_hours = 48
```

`13-veto-on-human-tier/ward.toml`, under
`[approval_tiers.human_review]`:

```toml
human_veto_window_hours = 12
```

`14-unknown-tier-block/ward.toml`:

```toml
[approval_tiers.auto]
blocks = ["output_formats", "heartbeat_schedule", "tool_defaults", "unknown_region"]
gate = "regression_suite"
cave_board_card = true
human_veto_window_hours = 48
```

`15-duplicate-tier-block/ward.toml`:

```toml
[approval_tiers.auto]
blocks = ["output_formats", "output_formats", "tool_defaults"]
gate = "regression_suite"
cave_board_card = true
human_veto_window_hours = 48
```

`16-invalid-veto-duration/ward.toml`, under `[approval_tiers.auto]`:

```toml
human_veto_window_hours = 0
```

- [ ] **Step 4: Replace each copied `CASE.md`**

`11-unknown-tier-field/CASE.md`:

```markdown
# Negative: unknown approval-tier field

Expected: FAIL. Approval-tier objects are authority-bearing declarations and
MUST reject unknown fields instead of ignoring them.
```

`12-tier-gate-mismatch/CASE.md`:

```markdown
# Negative: approval-tier gate mismatch

Expected: FAIL. `approval_tiers.auto` MUST compile only from
`gate = "regression_suite"`.
```

`13-veto-on-human-tier/CASE.md`:

```markdown
# Negative: veto window on synchronous human tier

Expected: FAIL. `human_review` is synchronous pre-promotion approval and MUST
NOT declare a delayed-apply veto window.
```

`14-unknown-tier-block/CASE.md`:

```markdown
# Negative: approval tier references an unknown block

Expected: FAIL. Every `approval_tiers.*.blocks` entry MUST be declared in
`editable.harness_blocks` so a runtime can bind it to a deterministic region
extractor.
```

`15-duplicate-tier-block/CASE.md`:

```markdown
# Negative: duplicate approval-tier block

Expected: FAIL. An approval path MUST NOT contain duplicate region references.
```

`16-invalid-veto-duration/CASE.md`:

```markdown
# Negative: invalid veto duration

Expected: FAIL. A delayed-apply veto window MUST be a positive integer number
of hours.
```

- [ ] **Step 5: Run the suite and verify RED**

Run:

```bash
bash tests/conformance/run-conformance.sh
```

Expected: `BROKEN: 6 unexpected`; each new negative fixture reports
`UNEXPECTED pass`.

- [ ] **Step 6: Commit the failing tests**

```bash
git add tests/conformance/negative
git commit -S -m "test: define approval-tier compiler failures" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 2: Parse and validate typed approval-tier declarations

**Files:**
- Modify: `validators/validate.js:206-377`

- [ ] **Step 1: Add the tier compiler rule table**

Immediately above `parseWardToml`, add:

```js
const APPROVAL_TIER_RULES = Object.freeze({
  auto: {
    gate: 'regression_suite',
    approvalPath: 'AutoRegression',
    vetoAllowed: true,
    allowedFields: ['blocks', 'gate', 'cave_board_card', 'human_veto_window_hours'],
  },
  familiar_review: {
    gate: 'familiar_coherence_check',
    approvalPath: 'FamiliarCoherence',
    vetoAllowed: true,
    allowedFields: ['blocks', 'gate', 'cave_board_card', 'human_veto_window_hours'],
  },
  human_review: {
    gate: 'human_approval',
    approvalPath: 'HumanApproval',
    vetoAllowed: false,
    allowedFields: ['blocks', 'gate', 'cave_board_card'],
  },
  human_required: {
    gate: 'human_approval_with_rationale',
    approvalPath: 'HumanApprovalWithRationale',
    vetoAllowed: false,
    allowedFields: ['blocks', 'gate', 'cave_board_card', 'audit_log'],
  },
});

function parseTomlScalar(raw) {
  const value = raw.trim();
  if (/^".*"$|^'.*'$/.test(value)) return value.slice(1, -1);
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  return value;
}

function assignWardArray(result, target, items) {
  if (target.section === 'protected' && target.key === 'files') {
    result.protectedFiles = items;
  } else if (target.section === 'protected' && target.key === 'invariants') {
    result.protectedInvariants = items;
  } else if (target.section === 'editable' && target.key === 'paths') {
    result.editablePaths = items;
  } else if (target.section === 'editable' && target.key === 'harness_blocks') {
    result.editableHarnessBlocks = items;
  } else if (target.section === 'approval_tiers') {
    const tier = result.approvalTiers[target.subSection];
    if (!tier.fieldNames.includes(target.key)) tier.fieldNames.push(target.key);
    if (target.key === 'blocks') tier.blocks = items;
  }
}
```

- [ ] **Step 2: Extend the parsed Ward model**

Add these properties to `result`:

```js
editableHarnessBlocks: [],
approvalTiers: {},
unknownApprovalTiers: [],
```

Replace the specific tier header checks with:

```js
const approvalTierMatch = trimmed.match(/^\[approval_tiers\.([A-Za-z0-9_]+)\]$/);
if (approvalTierMatch) {
  currentSection = 'approval_tiers';
  currentSubSection = approvalTierMatch[1];
  result.hasApprovalTiers = true;
  result.approvalTiers[currentSubSection] = {
    blocks: [],
    fields: {},
    fieldNames: [],
  };
  if (currentSubSection === 'auto') result.hasAutoTier = true;
  if (currentSubSection === 'human_review') result.hasHumanReviewTier = true;
  if (!APPROVAL_TIER_RULES[currentSubSection]) {
    result.unknownApprovalTiers.push(currentSubSection);
  }
  continue;
}
```

- [ ] **Step 3: Preserve subsection context for arrays**

Change array-target creation to:

```js
arrayTarget = {
  section: currentSection,
  subSection: currentSubSection,
  key: keyMatch[1],
};
```

Replace both the multiline-array close assignments and inline-array assignments
with:

```js
assignWardArray(result, arrayTarget, [...arrayBuffer]);
```

and:

```js
assignWardArray(result, {
  section: currentSection,
  subSection: currentSubSection,
  key,
}, items);
```

- [ ] **Step 4: Capture approval-tier scalar fields**

Inside the key-value branch, after the existing `[meta]` assignments, add:

```js
if (
  currentSection === 'approval_tiers'
  && currentSubSection
  && result.approvalTiers[currentSubSection]
) {
  if (!result.approvalTiers[currentSubSection].fieldNames.includes(key)) {
    result.approvalTiers[currentSubSection].fieldNames.push(key);
  }
  result.approvalTiers[currentSubSection].fields[key] = parseTomlScalar(
    trimmed.slice(trimmed.indexOf('=') + 1).replace(/\s+#.*$/, '')
  );
}
```

- [ ] **Step 5: Add semantic compiler validation**

Add this helper above `validateWard`:

```js
function validateApprovalTiers(parsed) {
  const violations = [];

  for (const tierName of parsed.unknownApprovalTiers) {
    violations.push(violation(
      'ward.toml',
      `approval_tiers.${tierName}`,
      `Unknown approval tier "${tierName}". Approval tiers must map to a typed ApprovalPath.`
    ));
  }

  for (const [tierName, tier] of Object.entries(parsed.approvalTiers)) {
    const rule = APPROVAL_TIER_RULES[tierName];
    if (!rule) continue;

    for (const field of tier.fieldNames) {
      if (!rule.allowedFields.includes(field)) {
        violations.push(violation(
          'ward.toml',
          `approval_tiers.${tierName}.${field}`,
          `Unknown field "${field}" for approval tier "${tierName}".`
        ));
      }
    }

    if (tier.fields.gate !== rule.gate) {
      violations.push(violation(
        'ward.toml',
        `approval_tiers.${tierName}.gate`,
        `Expected gate "${rule.gate}" for ApprovalPath::${rule.approvalPath}.`
      ));
    }

    if (tier.blocks.length === 0) {
      violations.push(violation(
        'ward.toml',
        `approval_tiers.${tierName}.blocks`,
        'Each approval tier must reference at least one editable harness block.'
      ));
    }

    const duplicateBlocks = tier.blocks.filter(
      (block, index) => tier.blocks.indexOf(block) !== index
    );
    for (const block of [...new Set(duplicateBlocks)]) {
      violations.push(violation(
        'ward.toml',
        `approval_tiers.${tierName}.blocks`,
        `Duplicate harness block "${block}" is not allowed.`
      ));
    }

    for (const block of tier.blocks) {
      if (!parsed.editableHarnessBlocks.includes(block)) {
        violations.push(violation(
          'ward.toml',
          `approval_tiers.${tierName}.blocks`,
          `Harness block "${block}" is not declared in editable.harness_blocks.`
        ));
      }
    }

    if (
      !rule.vetoAllowed
      && Object.prototype.hasOwnProperty.call(tier.fields, 'human_veto_window_hours')
    ) {
      violations.push(violation(
        'ward.toml',
        `approval_tiers.${tierName}.human_veto_window_hours`,
        `ApprovalPath::${rule.approvalPath} is synchronous and cannot declare a veto window.`
      ));
    }

    if (
      rule.vetoAllowed
      && Object.prototype.hasOwnProperty.call(tier.fields, 'human_veto_window_hours')
      && (
        !Number.isInteger(tier.fields.human_veto_window_hours)
        || tier.fields.human_veto_window_hours < 1
      )
    ) {
      violations.push(violation(
        'ward.toml',
        `approval_tiers.${tierName}.human_veto_window_hours`,
        'A veto window must be a positive integer number of hours.'
      ));
    }
  }

  return violations;
}
```

Append its result inside the existing `hasApprovalTiers` branch:

```js
violations.push(...validateApprovalTiers(parsed));
```

- [ ] **Step 6: Run the six new cases and verify GREEN**

Run:

```bash
for case_path in tests/conformance/negative/{11,12,13,14,15,16}-*; do
  node validators/validate.js "$case_path" >/dev/null
  test "$?" -ne 0
done
```

Expected: exit 0 from the shell loop because every validator invocation fails.

- [ ] **Step 7: Commit the validator behavior**

```bash
git add validators/validate.js
git commit -S -m "feat: validate typed approval-tier declarations" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 3: Tighten the schema and migrate valid examples

**Files:**
- Modify: `schemas/ward.schema.json:111-226`
- Modify: `examples/minimal/ward.toml:37-42`
- Modify: `examples/sage/ward.toml:39-47`
- Modify: `tests/conformance/positive/01-minimal-compliant/ward.toml`
- Modify: `tests/conformance/positive/02-full-compliant/ward.toml`
- Modify: `tests/conformance/positive/03-multi-role/ward.toml`
- Modify: `tests/conformance/positive/04-with-user-md/ward.toml`
- Modify: `tests/conformance/positive/05-tier-rich-ward/ward.toml`

- [ ] **Step 1: Make harness-block declarations non-empty and unique**

Change the `editable.harness_blocks` schema to:

```json
"harness_blocks": {
  "type": "array",
  "description": "SurfaceRegionId declarations available to approval-tier blocks. A runtime must bind each identifier to a deterministic extractor before loading the Ward.",
  "items": {
    "type": "string",
    "minLength": 1
  },
  "minItems": 1,
  "uniqueItems": true,
  "examples": [
    ["system_prompt.execution", "system_prompt.recovery", "tool_defaults", "skill_config"]
  ]
}
```

Add `"harness_blocks"` to the `editable.required` array.

- [ ] **Step 2: Make every tier shape strict**

For all four tier objects:

- set `"required": ["blocks", "gate"]`;
- set each `blocks` array to `minItems: 1`, `uniqueItems: true`, and string
  `minLength: 1`;
- set `"additionalProperties": false`.

Do not add `human_veto_window_hours` to `human_review` or `human_required`.
Keep the existing gate `const` values unchanged.

- [ ] **Step 3: Register every referenced block in valid examples**

Use this full list in `examples/sage/ward.toml` and
`tests/conformance/positive/05-tier-rich-ward/ward.toml`:

```toml
harness_blocks = [
  "system_prompt.execution",
  "system_prompt.recovery",
  "tool_defaults",
  "skill_config",
  "subagent_templates",
  "output_formats",
  "heartbeat_schedule",
  "tool_grants",
  "skill_activations",
  "memory_conventions",
  "session_introduction",
]
```

For the minimal example and each other positive fixture, add every block named
under its `approval_tiers.*.blocks` arrays to its existing
`editable.harness_blocks` array. Do not add unused blocks.

- [ ] **Step 4: Verify schema JSON and the full suite**

Run:

```bash
node -e 'JSON.parse(require("fs").readFileSync("schemas/ward.schema.json", "utf8"))'
bash tests/conformance/run-conformance.sh
node validators/validate.js examples/minimal
node validators/validate.js examples/sage
```

Expected: JSON parse exits 0; conformance reports all positives passed, all
negatives failed correctly, `unexpected: 0`, `READY`; both examples pass.

- [ ] **Step 5: Commit schema and fixture alignment**

```bash
git add schemas/ward.schema.json examples tests/conformance/positive
git commit -S -m "feat: make approval-tier schema fail closed" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 4: Amend RFC-0001 and explanatory Ward docs

**Files:**
- Modify: `rfcs/RFC-0001-familiar-contract.md:224-251`
- Modify: `docs/ward-primer.md:17-42`
- Modify: `docs/ward-deep-dive.md:158-169`

- [ ] **Step 1: Add the normative compiler table after RFC §5.3's tier table**

Add:

```markdown
#### 5.3.1 Approval-tier compilation

The TOML approval-tier tables are a portable declaration surface. They are not
runtime authority objects. Before accepting a Ward, the authority layer **MUST**
compile each declaration deterministically:

| Declaration | Typed approval path | Required gate |
|---|---|---|
| `approval_tiers.auto` | `AutoRegression` | `regression_suite` |
| `approval_tiers.familiar_review` | `FamiliarCoherence` | `familiar_coherence_check` |
| `approval_tiers.human_review` | `HumanApproval` | `human_approval` |
| `approval_tiers.human_required` | `HumanApprovalWithRationale` | `human_approval_with_rationale` |

Each `blocks` entry **MUST** name a `SurfaceRegionId` declared in
`editable.harness_blocks`, and the runtime **MUST** bind that identifier to a
deterministic extractor before loading the Ward. A descriptor or label alone
**MUST NOT** authorize promotion.

`human_veto_window_hours` **MAY** appear only on `auto` and
`familiar_review`. A veto window **MUST** use delayed apply: expiry triggers
evidence replay and Gate 4 revalidation before any write. Provisional apply
followed by rollback **DOES NOT** conform to this RFC.

Unknown tiers, unknown tier fields, missing or mismatched gates, duplicate or
unbound blocks, invalid veto placement, and any declaration without one
deterministic typed result **MUST** cause Ward loading to fail closed.

Approval-path compilation applies only after Gates 1 and 2 establish that the
proposal does not touch the protected surface. Principal-authorized protected
updates occur through the separate audited Ward-update path; they are not
approval-tier proposals.
```

- [ ] **Step 2: Correct the primer's veto wording**

Replace the Tier 0 and Tier 1 descriptions with:

```markdown
**Tier 0 — Auto:** Low-risk changes (output format tweaks, tool invocation
defaults, heartbeat scheduling) enter `AutoRegression`. After deterministic
regression evidence passes, the proposal remains pending for its human veto
window. It is not applied until the window expires and the daemon replays the
evidence and Gate 4.

**Tier 1 — Familiar review:** Changes to instruction blocks, reasoning prompts,
and skill configurations enter `FamiliarCoherence`. The familiar review record
is evidence, not authority; the proposal remains pending through its human veto
window and is revalidated before apply.
```

After the tier list, add:

```markdown
The TOML tier names are declarations that compile to typed daemon approval
paths. Unknown fields, gate drift, duplicate or undeclared blocks, and invalid
veto settings make the Ward fail closed at load time.
```

- [ ] **Step 3: Correct the deep dive's classification output**

Replace the paragraph beginning `Classification output:` with:

```markdown
**Classification output:** Gate 3 emits both the independent load
`Channel` and a typed approval path compiled from the Ward declaration:
`AutoRegression`, `FamiliarCoherence`, `HumanApproval`, or
`HumanApprovalWithRationale`. A block label is usable only when the daemon can
bind it to a deterministic surface-region extractor. Protected-target
proposals never reach this classification: Gates 1 and 2 reject them, and Gate
4 repeats the materialized protected-surface check immediately before apply.
```

- [ ] **Step 4: Check prose for authority contradictions**

Run:

```bash
rg -n "appl(ied|y) immediately|auto-promot.*protected|Tier 0.*protected|co-author.*approval" \
  rfcs/RFC-0001-familiar-contract.md docs/ward-primer.md docs/ward-deep-dive.md
```

Expected: no text claims provisional apply, protected-target promotion, or
trailer-based approval.

- [ ] **Step 5: Commit the normative prose**

```bash
git add rfcs/RFC-0001-familiar-contract.md docs/ward-primer.md docs/ward-deep-dive.md
git commit -S -m "docs: specify approval-tier compiler semantics" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 5: Version the draft contract and update reader-facing references

**Files:**
- Modify: `rfcs/RFC-0001-familiar-contract.md`
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `SPEC.md`
- Modify: `rfcs/README.md`
- Modify: `docs/faq.md`
- Modify: `validators/validate.js:469,503`

- [ ] **Step 1: Advance the stacked draft to v0.4.0**

Starting from PR #3's v0.3.0 branch, replace current-version references with
`v0.4.0` while leaving RFC status `Draft`.

Update validator output strings:

```js
console.log(`\n${bold('familiar-contract validator')} ${dim('v0.4.0')}`);
```

and:

```js
console.log(green(bold('✓ PASS')) + ' — All checks passed. This familiar is familiar-contract v0.4.0 compliant (RFC-0001).\n');
```

- [ ] **Step 2: Add the changelog entry**

Insert above v0.3.0:

```markdown
## [0.4.0] — 2026-07-19

### Added

- Normative approval-tier compiler mapping from Ward TOML declarations to typed
  daemon approval paths and surface-region identifiers.
- Conformance cases for unknown tier fields, gate mismatch, invalid veto
  placement, unbound blocks, and duplicate blocks.

### Changed

- Approval-tier objects now fail closed on unknown fields and require non-empty,
  unique block lists with the tier's exact gate.
- Veto windows are explicitly delayed-apply and require evidence replay plus
  Gate-4 revalidation before write.
- Protected-target proposals are explicitly outside approval-path promotion;
  principal-authorized protected updates remain a separate audited path.
```

- [ ] **Step 3: Run version and conformance checks**

Run:

```bash
rg -n "v0\.[0-3]\.0|version-string output to v0\.[0-3]\.0" \
  README.md SPEC.md rfcs/README.md rfcs/RFC-0001-familiar-contract.md \
  docs/faq.md validators/validate.js
bash tests/conformance/run-conformance.sh
node validators/validate.js examples/minimal
node validators/validate.js examples/sage
git diff --check
```

Expected: the ripgrep output contains only historical/version-history
references; all executable checks pass; diff check is clean.

- [ ] **Step 4: Commit version alignment**

```bash
git add CHANGELOG.md README.md SPEC.md rfcs docs/faq.md validators/validate.js
git commit -S -m "docs: advance RFC-0001 draft to v0.4.0" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 6: Fresh review, Beads evidence, and draft PR

**Files:**
- No new source files.

- [ ] **Step 1: Run the full local gate**

```bash
node -e 'JSON.parse(require("fs").readFileSync("schemas/ward.schema.json", "utf8"))'
bash tests/conformance/run-conformance.sh
node validators/validate.js examples/minimal
node validators/validate.js examples/sage
git diff --check
git status --short
```

Expected: all commands pass and only intended files are changed.

- [ ] **Step 2: Request a fresh authority review**

Review the branch against the design at
`docs/superpowers/specs/2026-07-19-approval-tier-compiler-design.md`. The review
must specifically check:

- RFC/schema/validator consistency;
- protected-target rejection at Gates 1, 2, and 4;
- `Channel` independence from approval path;
- delayed apply only;
- fail-closed unknown fields and region mappings;
- no claim that an agent or commit trailer satisfies Nova or Val.

Expected: no unresolved high-confidence findings.

- [ ] **Step 3: Record the implementation checkpoint in Beads**

From `OpenCoven/coven-threads`:

```bash
bd update threads-uqx.12 --append-notes \
  "IMPLEMENTED on familiar-contract branch rfc/0001-approval-tier-compiler. Record commit SHAs, conformance totals, schema parse result, fresh-review result, worktree path, and PR URL. This bead remains open until independent Nova + Val approval and merge."
```

- [ ] **Step 4: Push and open the stacked draft PR**

```bash
git push -u origin rfc/0001-approval-tier-compiler
gh pr create \
  --repo OpenCoven/familiar-contract \
  --base rfc/0001-closure-provenance-amendments \
  --head rfc/0001-approval-tier-compiler \
  --draft \
  --title "rfc(0001): define fail-closed approval-tier compiler" \
  --body "Stacked on PR #3. Defines the normative TOML-to-typed approval-path compiler, strict schema and validator behavior, delayed-apply veto semantics, and protected-target exclusion. Merge order: #3 first, then retarget this PR to main. Tracks OpenCoven/coven-threads threads-uqx.12; independent Nova + Val approval remains required."
```

- [ ] **Step 5: Keep the human gate open**

Do not close `threads-uqx.12`. Its acceptance criteria require independently
attributable Nova and Val approval and merge. Record review requests and wait;
never substitute an agent statement, commit trailer, or PR authorship for
either gate.
