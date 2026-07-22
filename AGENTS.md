# AGENTS.md — familiar-contract

Guidance for **AI agents** (Codex, Claude Code, and any Coven familiar) opening
pull requests against this repo. This is the agent-specific layer; read
[`README.md`](README.md) for the full specification.

> **What this repo is:** the **Familiar Contract** — an open specification for
> what an agent is *allowed to be*: not just what it can do, but what it cannot
> change about itself. The normative artifacts are the JSON Schemas under
> [`schemas/`](schemas/) (`identity`, `role`, `soul`, `ward`) and the prose
> spec in the Markdown pages.

## Branch & PR workflow

- **Never push to `main`.** Every change lands via a PR. Branch from current
  `origin/main`.
- **Fresh branch per task**; use a worktree if multiple sessions may touch this
  repo:
  ```sh
  git fetch origin main
  git worktree add -b <branch> /tmp/famcontract-<branch> origin/main
  ```
- Keep the diff scoped to one concern; conventional-commit subjects (`feat:`,
  `fix:`, `docs:`, `chore:`, `refactor:`).
- After merge: delete the remote branch, remove your local worktree/branch.

## This is a specification — change it deliberately

- **Schemas are normative; prose explains them.** When you change a schema under
  `schemas/`, update the corresponding prose page in the **same PR**, and vice
  versa. They must not drift.
- **Validate before you submit.** Every JSON Schema must be valid, and every
  example/fixture in the repo must validate against its schema:
  ```sh
  npm install
  node -e "for (const f of require('fs').readdirSync('schemas')) JSON.parse(require('fs').readFileSync('schemas/' + f, 'utf8'))"
  npm test
  ```
- **Backward compatibility matters.** The contract is consumed by real agents.
  Prefer additive changes; a breaking change to identity/role/soul/ward needs an
  explicit rationale and a version note in the PR body.
- **Ward semantics are load-bearing.** The `ward` schema encodes what an agent
  may *not* change about itself — treat edits there as security-sensitive and
  spell out the reasoning.

## Attribution — credit contributors correctly

When you re-land or build on someone else's work (a fork PR, an issue author's
proposal, a co-author), **credit the human contributor with a working
GitHub-linked trailer** so they appear in the contributors graph and on their
profile:

```
Co-authored-by: Full Name <ID+username@users.noreply.github.com>
```

- Use the **numeric-id no-reply form**. Get the id with `gh api users/<login> --jq .id`.
- **Never** use a machine or `.local` email (e.g. `name@Someones-Mac.local`) in a
  co-author trailer — it links to no account and gives **zero** credit.
- When a squash-merge folds a contributor's PR into an internal branch, preserve
  their `Co-authored-by:` line in the squash commit message.
- Credit **people**, not AI tools.

## Secrets & safety

- Never commit secrets, tokens, or private emails. Use `*.noreply.github.com`
  for attribution.
- Don't loosen a ward or safety constraint in the spec to make an example pass;
  fix the example instead.

## Claude Code

`CLAUDE.md` points here — this file is the source of truth for both.
