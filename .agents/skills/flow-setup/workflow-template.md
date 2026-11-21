# Workflow

Settings read by the `flow-backlog` and `flow-work` skills. Edit this file directly to change them.

## Task tracker

- **Tracker file**: `docs/agents/tracker.md` (or the shared path where it lives). It says how every task operation is done: reading, creating, records, status, branch links, PRs.

## Branches

- **Base branch**: `<base>`. Every feature ends up here.
- **Group branch** (a parent task with child tasks): `feature/<id>-<slug>`, created from the base branch. Its PR targets the base branch.
- **Task branch**: `task/<id>-<slug>`.
  - A child task branches from its group branch, and its PR targets the group branch.
  - A standalone task (no parent) branches from the base branch, and its PR targets the base branch.
- `<id>` is written as the tracker's "id in branch names".
- A child task starts only after the PRs of the tasks that block it are merged into the group branch. The user reviews and merges every PR.

## Languages

- **Tasks** (titles, descriptions, records): `<language>`
- **Pull requests** (titles and bodies): `<language>`
- **Commit messages**: Conventional Commits, `<language>`

## Commands

| Purpose | Command |
|---|---|
| Full test suite | `<command or none>` |
| Single test file | `<command with {file} placeholder, or none>` |
| Typecheck | `<command or none>` |
| Lint | `<command or none>` |

## Harnesses

Which harnesses (Claude Code, OpenCode, Codex…) do the work in this repo, with which models, and how `flow-work` starts each task. Edit it directly, or run `flow-setup` and say you want to change the harnesses or models: it walks you through this section only.

The orchestrator is the session you open in one of those harnesses, so its harness and model are your choice when you start it. This section covers the roles it delegates.

- **Default working mode**: `<semi-autonomous | pair | autonomous>`. The user can still ask for another mode on any task. With `autonomous`, a task that research finds is not small and simple starts in semi-autonomous instead.

### The harnesses you use

One row per harness, with its models defined once. **Strong** is for the roles that need judgement (plan, tests); **fast** is for the rest (research, implement, fix, review). Use the model names that harness accepts (for example `opus` and `sonnet` in Claude Code, or `provider/model-id` in OpenCode); `inherit` is the harness's own default.

| Harness | Runs in | Strong model | Fast model | Deep model | Effort |
|---|---|---|---|---|---|
| `<name>` | `<subagent, or manager:agent>` | `<model>` | `<model>` | `<model, or empty>` | `<level, or empty>` |

- **Runs in**: `subagent` is the harness's own subagents. `<manager>:<harness>` is another harness launched through an agent manager (Orca, Herdr) installed on the machine, for example `orca:opencode`, `orca:codex` or `herdr:claude`.
- **Deep model**: used instead of the strong one only when `flow-work` proposes the **deep** profile for a very complex task and the user agrees. Empty means the strong model is used.

### Who takes each role

Several harnesses in the same row are alternatives, in order of preference: the first one that is available and has quota is used, and when it fails `flow-work` moves to the next and tells the user in one line.

| Role | Harnesses, in order | Uses |
|---|---|---|
| research | `<harness>`, `<harness>` | fast |
| plan | `<harness>`, `<harness>` | strong |
| tests | `<harness>`, `<harness>` | strong |
| implement | `<harness>`, `<harness>` | fast |
| fix | `<harness>`, `<harness>` | fast |
| review | `<harness>`, `<harness>` | fast |

- The split is fixed by this table: nothing balances usage across subscriptions on its own.
- When no harness of a role is usable on a machine, that role runs as a subagent and the user is told. Nobody needs an agent manager to work on this repo.
- `<manager>:other` in **Runs in** means any harness different from the one running the flow, for an independent second opinion (useful for review).

## Docs

Where the project's own documentation lives, and how `flow-work` keeps it current: each task's plan lists the documents it affects, they are updated with the implementation, and the review checks them.

- **Docs folder**: `<docs/, or none>`
- **Project rules**: `<where the project says which docs to update, e.g. a matrix in AGENTS.md; or none>`. These rules take precedence over the plan's own judgement.
- Just enough docs: only what the code cannot easily tell (purpose, usage and configuration, cross-module flows, integrations, non-obvious constraints). Nothing that reading the code gives quickly.

## Engram sync

Shares this project's Engram memory through git, in the `.engram/` folder. `flow-work` imports new chunks when it creates a branch, and offers to export before opening a PR.

- **Engram sync**: `<ask | always | never>`

## Task memory

Where `flow-work` keeps the closed note of a finished task (what was built, where, decisions, gotchas), which the research phase of later tasks reads. It only matters when Engram is not available: with Engram, the note lives there.

- **Task memory**: `<repo | local>`. `repo` saves it in `.flow/memory/<id>.md` and commits it with the work, so every machine and teammate can read it. `local` saves it in the same place but git-ignores `.flow/memory/`, so it stays on this machine. A missing setting means `local`.

## Tests

- **Test file globs**: `<glob>`, `<glob>`
- Approved tests are never edited during implementation. The check is `git diff <approved-tests-commit> -- <globs>`, which must be empty.

## Labels

- Applied when creating tasks: `<labels, or none>`

## Notes

<Anything else specific to this repo. Optional.>
