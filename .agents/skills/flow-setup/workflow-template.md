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

## Models

Model profiles used by `flow-work`'s subagents. Each profile maps the two tiers, **strong** (plan, tests) and **fast** (research, implement, review, fix), to models. Use the model names your harness accepts (for example `opus` and `sonnet` in Claude Code, or `provider/model-id` in OpenCode). Write `inherit` to use the session model.

`flow-work` runs every task on **standard**. It proposes **deep** only when it judges a task very complex, and switches only after the user's OK.

- **standard**: strong `<model>`, fast `<model>`
- **deep**: strong `<model>`, fast `<model>`

## Docs

Where the project's own documentation lives, and how `flow-work` keeps it current: each task's plan lists the documents it affects, they are updated with the implementation, and the review checks them.

- **Docs folder**: `<docs/, or none>`
- **Project rules**: `<where the project says which docs to update, e.g. a matrix in AGENTS.md; or none>`. These rules take precedence over the plan's own judgement.
- Just enough docs: only what the code cannot easily tell (purpose, usage and configuration, cross-module flows, integrations, non-obvious constraints). Nothing that reading the code gives quickly.

## Engram sync

Shares this project's Engram memory through git, in the `.engram/` folder. `flow-work` imports new chunks when it creates a branch, and offers to export before opening a PR.

- **Engram sync**: `<ask | always | never>`

## Tests

- **Test file globs**: `<glob>`, `<glob>`
- Approved tests are never edited during implementation. The check is `git diff <approved-tests-commit> -- <globs>`, which must be empty.

## Labels

- Applied when creating tasks: `<labels, or none>`

## Notes

<Anything else specific to this repo. Optional.>
