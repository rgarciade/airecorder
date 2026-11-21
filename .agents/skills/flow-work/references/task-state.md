# Reading a task's state

How to find out where a task stands. Two skills use it, and both must follow it as written so a task looks the same from either one:

- `flow-status` applies it to every open task, **read only**: it reports, it never fixes.
- `flow-work` applies it to its own task when resuming, then acts on the result (Phase 2, resume step).

This page only reads. Nothing here writes a note, changes git state or touches a running worker.

## 1. Find the state note

Look in both places, every time. A note lands in `.scratch/` when Engram is missing or a save to it failed, so finding nothing in Engram proves nothing.

1. **Engram** (if the Engram MCP server is available): the key `flow/<repo>/<id>/state`. To list every task, `mem_search` for `flow/<repo>/` keys ending in `/state`, then `mem_get_observation` on each.
2. **File**: `.scratch/flow/<id>/state.md` in the worktree where the task branch is checked out. To list every task, `.scratch/flow/*/state.md` in every worktree (`git worktree list`).

If both exist, use the one updated last and say so in one line. If neither exists, the task has no state note: where it stands is rebuilt from its branch, commits and other notes.

A **closed** note starts with `<ref> <title> · closed` (see `state-note.md`). It means the PR was opened: the task is only still open if `pr-status` shows that PR open. A closed note has no progress fields and no `running:` line.

## 2. Check it against the repo

For the task, without changing anything:

- **Worktree**: match the note's `branch:` (or the task branch from the patterns in `workflow.md`) to `git worktree list`. No match: "not checked out", or "worktree unknown" when the branch does not exist locally.
- **Where it stands**: `phase`, `next`, `waiting on` and `pending commits` from the note. `phase: parked` means it was paused on purpose.
- **Uncommitted changes**: `git --no-optional-locks -C <worktree> status --porcelain`. On the task branch they belong to the task.
- **Commits not pushed**: `git -C <worktree> rev-list --count @{u}..HEAD`, when the branch has an upstream. It is as of the last fetch.
- **A role that did not finish**: a `running:` line other than `none` means a role was started and its result never came back (its session or terminal closed under it). Note which role and where it ran. If it ran in another harness through an agent manager, it may still be running there.
- **Contradictions**: the note's `branch:` is not the branch it is on, a `pending commits` command whose commit is already on the branch, or a phase the commits contradict (for example `approved tests: not yet` with a `test(...)` commit on the branch). The branch and the task win over the note.

## 3. The result

For each task, in this order: ref and title (`view-task`), worktree, where it stands, what it waits on, and the warnings (uncommitted files, unpushed commits, unfinished role, contradictions). `flow-status` shows it as a table row; `flow-work` turns it into its resume message.
