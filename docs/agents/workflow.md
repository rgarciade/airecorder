# Workflow

Settings read by the `flow-backlog` and `flow-work` skills. Edit this file directly to change them.

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

## Harnesses

Which harnesses (Claude Code, OpenCode, Codex…) do the work in this repo, with which models, and how `flow-work` starts each task. Edit it directly, or run `flow-setup` and say you want to change the harnesses or models: it walks you through this section only.

The orchestrator is the session you open in one of those harnesses, so its harness and model are your choice when you start it. This section covers the roles it delegates.

- **Default working mode**: `semi-autonomous`. The user can still ask for another mode on any task. With `autonomous`, a task that research finds is not small and simple starts in semi-autonomous instead.

### The harnesses you use

One row per harness, with its models defined once. **Strong** is for the roles that need judgement (plan, tests); **fast** is for the rest (research, implement, fix, review). Use the model names that harness accepts (for example `opus` and `sonnet` in Claude Code, or `provider/model-id` in OpenCode); `inherit` is the harness's own default.

| Harness | Runs in | Strong model | Fast model | Deep model | Effort |
|---|---|---|---|---|---|
| `claude` | `subagent` | `opus` | `sonnet` | `opus` | |
| `opencode` | `orca:opencode` | `opencode-go/glm-5.3` | `opencode-go/glm-5.3-flash` | `opencode-go/qwen3.8-max` | |

- **Runs in**: `subagent` is the harness's own subagents. `<manager>:<harness>` is another harness launched through an agent manager (Orca, Herdr) installed on the machine, for example `orca:opencode`, `orca:codex` or `herdr:claude`.
- **Deep model**: used instead of the strong one only when `flow-work` proposes the **deep** profile for a very complex task and the user agrees. Empty means the strong model is used.
- Codex is installed but deliberately not used in this repo.

### Who takes each role

Several harnesses in the same row are alternatives, in order of preference: the first one that is available and has quota is used, and when it fails `flow-work` moves to the next and tells the user in one line.

| Role | Harnesses, in order | Uses |
|---|---|---|
| research | `opencode`, `claude` | fast |
| plan | `claude`, `opencode` | strong |
| tests | `claude`, `opencode` | strong |
| implement | `opencode`, `claude` | fast |
| fix | `opencode`, `claude` | fast |
| review | `claude`, `opencode` | fast |

- The split is fixed by this table: nothing balances usage across subscriptions on its own.
- When no harness of a role is usable on a machine, that role runs as a subagent and the user is told. Nobody needs an agent manager to work on this repo.
- `<manager>:other` in **Runs in** means any harness different from the one running the flow, for an independent second opinion (useful for review).

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
