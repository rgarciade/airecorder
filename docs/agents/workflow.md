# Workflow

Settings read by the `flow-plan` and `flow-work` skills. Edit this file directly to change them.

## Task tracker

- **Tracker file**: `docs/agents/tracker.md`. It says how every task operation is done: reading, creating, records, status, branch links, PRs.

## Branches

- **Base branch**: `dev`. Every feature ends up here.
- **Group branch** (a parent task with child tasks): `feature/<id>-<slug>`, created from the base branch. Its PR targets the base branch.
- **Task branch**: `task/<id>-<slug>`.
  - A child task branches from its group branch, and its PR targets the group branch.
  - A standalone task (no parent) branches from the base branch, and its PR targets the base branch.
- `<id>` is written as the tracker's "id in branch names".
- A child task starts only after the PRs of the tasks that block it are merged into the group branch. The user reviews and merges every PR.
- Older branches (`rgarciade/…`, `task-89-…`, etc.) predate this convention; don't copy their names.

## Languages

- **Tasks** (titles, descriptions, records): Spanish
- **Pull requests** (titles and bodies): Spanish
- **Commit messages**: Conventional Commits, Spanish

## Commands

| Purpose | Command |
|---|---|
| Full test suite | `npm test` |
| Single test file | `npm test -- {file}` |
| Typecheck | none |
| Lint | `npm run lint` |

## Models

Model tiers used by `flow-work`'s subagents. Use the model names your harness accepts (for example `opus` and `sonnet` in Claude Code, or `provider/model-id` in OpenCode). Write `inherit` to use the session model.

- **strong** (plan, tests): `opus`
- **fast** (research, implement, review, fix): `sonnet`

## Docs

Where the project's own documentation lives, and how `flow-work` keeps it current: each task's plan lists the documents it affects, they are updated with the implementation, and the review checks them.

- **Docs folder**: technical docs are the per-area READMEs (`README.md` at the root, `electron/README.md`, `src/services/ai/README.md`) plus `docs/`, which now holds only agent/technical docs (`docs/agents/`). The public website lives in `web-docs/` (VitePress, deployed by `.github/workflows/deploy-docs.yml`); never put technical docs there.
- **Project rules**: the "Matriz de mantenimiento obligatorio de documentación" in `AGENTS.md`. These rules take precedence over the plan's own judgement.
- Just enough docs: only what the code cannot easily tell (purpose, usage and configuration, cross-module flows, integrations, non-obvious constraints). Nothing that reading the code gives quickly.

## Engram sync

Shares this project's Engram memory through git, in the `.engram/` folder. `flow-work` imports new chunks when it creates a branch, and offers to export before opening a PR.

- **Engram sync**: `never` (`.engram/` is git-ignored on purpose)

## Tests

- **Test file globs**: `src/tests/**/*.test.js`, `src/tests/**/*.test.jsx`, `test/**/*.test.js`
- Approved tests are never edited during implementation. The check is `git diff <approved-tests-commit> -- <globs>`, which must be empty.

## Labels

- Applied when creating tasks: none fixed. Pick `bug` or `enhancement` per task.

## Notes

- `AGENTS.md` forbids autonomous commits: agents edit files and leave staging and committing to the user.
- Tests run under Electron's runtime (`scripts/vitest-electron.js`) because of the `better-sqlite3` native module; `pretest` swaps in the Electron binary.
