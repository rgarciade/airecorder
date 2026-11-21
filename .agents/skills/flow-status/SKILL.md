---
name: flow-status
description: Read-only overview of the flow tasks in progress in this repo and its worktrees - which phase each one reached, what is waiting on the user, uncommitted changes, roles that did not finish - with the command to continue each one. Changes nothing. Use when the user runs /flow-status, or asks where they left off, which tasks are in progress or what is pending, for example after the session or the terminals were closed and no task is named.
---

# flow-status

Paths starting with `../` are relative to this skill's folder: they point at sibling skills in the same skills directory.

Show the user, in one message, every `flow-work` task that is still open here, and how to continue each one. This skill **only reads**. It never resumes a task itself: continuing is `flow-work`'s job.

## Hard rules

- **Change nothing.** No file writes, no note saves or updates (Engram or `.scratch/`), no tracker changes, and no git command that changes state: no `fetch`, `pull`, `checkout`, `stash` or `worktree` changes. Use what the local clone already knows, and say so when remote information matters (for example "the PR status comes from the tracker; branches are as of the last fetch").
- **Never fix a note.** If a state note contradicts its branch, report it; `flow-work` fixes it when the task is resumed.
- **Never touch a running worker.** If a role may still be running in another harness, report it and leave it alone.

## 1. Preflight

1. Read `docs/agents/workflow.md`. If it does not exist, tell the user that flow is not set up in this repo, suggest `/flow-setup`, and stop.
2. Read the tracker file (`docs/agents/tracker.md`, or the shared path in `workflow.md`), for `view-task` and `pr-status`.

## 2. Find the tasks

Read `../flow-work/references/task-state.md` and follow it: it is the one description of how a task's state is read, shared with `flow-work`'s resume, so both show a task the same way.

The tasks are the union of:

1. Every state note it finds (section 1 of that page, "to list every task"), in Engram and in `.scratch/` of every worktree.
2. Local task branches that match the patterns in `workflow.md` (`git branch --list`). A branch with no state note: "no state note; `flow-work` will rebuild where it stands from the commits".

Leave out:

- Closed notes whose PR is merged or closed. Keep a closed one whose PR is still open (`pr-status`): show it as "PR open" and mention changes requested, if any.
- Branches already merged into their base branch, unless a state note says the task is still open.

## 3. Check each task

Apply section 2 of `task-state.md` to each task, reading only. Get each title with `view-task`. With more than ten tasks, show the ten most recently updated and say how many more there are. For a role that did not finish in another harness, say it may still be running there and that `flow-work` checks that first. Say that unpushed counts are as of the last fetch.

## 4. Report

One message, in the format of `../flow-work/references/phase-messages.md` (plain words, the action first). If the `i-have-adhd` skill is installed, apply its formatting rules too.

1. First line: how many tasks are in progress, and which one needs the user first (something waiting on them, a role that did not finish, or uncommitted changes).
2. A numbered table, the most recently updated task first, with four short columns: `# | Task (ref and title) | Where it stands | Waiting on / warnings`. Warnings are uncommitted files, unpushed commits, an unfinished role, a contradiction. At most about 12 words per cell, so the table stays narrow in a terminal.
3. For each task, the command to continue it: `/flow-work <ref>`, preceded by `cd <worktree>` when it is checked out in another worktree.
4. If there are no open tasks, say so in one line and suggest `/flow-backlog` to create tasks or `/flow-work <id>` to start one.

Then stop. Continuing is the user's call, through `/flow-work <ref>`: this skill never starts it. If they pick a task checked out in another worktree, remind them to open the agent there, since the task's files and notes live there.
