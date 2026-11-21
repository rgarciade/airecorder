# Team visibility

What the team can see on the task while `flow-work` runs, and when to propose each change. Read from `SKILL.md` in Phase 1.

Task-driven work is visible while it happens, not only when the PR arrives. Anyone looking at the task can see who is on it, in which branch, at which stage, and every commit so far.

- **Linked branch.** Create task branches with `create-branch` (Phase 2), which links the branch to the task, or names it so the tracker links it.
- **Pushed commits.** Every commit command you give the user ends with `git push`, so each approved step shows up on the linked branch.
- **The plan record** tells the team how the task is being built (see "The task is the source of truth").
- **Assignment.** When the user confirms the task (Phase 1), propose assigning the task to them with `assign`, and do it after their OK. Skip it if the tracker file says `assign` is not used.
- **Status moves.** Unless the tracker file says `move-status` is not used, propose moving the task's status at these points with `move-status`, and move it only after the user's OK (one line, it can share a message with the phase's other question):

  | When | Move to |
  |---|---|
  | The user confirms the task (Phase 1) | in progress |
  | The PR is opened (Phase 8) | in review |
  | The PR is merged | done (often automatic through the `closing-reference`; only propose it if it did not happen) |
