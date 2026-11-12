# Parking or abandoning a task

Read from `SKILL.md` ("Parking or abandoning a task") when the user says to park, pause, drop or abandon the task. In every working mode, this always stops for the user.

Ask which one it is if it is not clear: **park** (come back later) or **abandon** (it will not be done, or not by this user).

## Park

1. **Lose nothing.** Show `git status`. If there are uncommitted changes, propose one of these and let the user choose:
   - a WIP commit: `git add -A && git commit -m "chore(<commit-ref>): wip, parked" && git push`
   - a stash: `git stash push -u -m "flow-<id>-parked"`; note its hash in the state note, and restore it later with `git stash apply <hash>`.
2. **Rewrite the state note** with `phase: parked`, and say why it was parked, what comes next, and what was waiting (questions, pending commits). Keep the other fields. Park only with no role running: if one is, wait for its result (or stop it through its manager, with the user's OK) and set `running: none` first.
3. **Propose, as separate questions that each need an OK**: moving the status back (`move-status`, for example to "to do"), and keeping the assignment so the team knows who has it.
4. Tell the user in one line how to resume: `/flow-work <ref>`. The "task branch already exists" path in Phase 2 reads `phase: parked`.

## Abandon

1. Ask the reason, in one line.
2. Propose each of these separately; each needs the user's OK:
   - a short comment on the task with what was found and why it stops. It may be an edit of the plan record instead of a new record, since a task has at most two records;
   - moving the status back, or closing the task (`move-status`);
   - unassigning (`assign`);
   - deleting the branch, locally and on the remote, with the exact commands for the user to run: `git branch -d <branch>` (or `-D`) and `git push origin --delete <branch>`. If it has unmerged commits, say so.
3. **Close the state note** in its closed form (`references/state-note.md`), with the reason under `open:` and what was learned in `gotchas:`, so later tasks in the same area learn from it. Without a PR, leave the PR link empty.
