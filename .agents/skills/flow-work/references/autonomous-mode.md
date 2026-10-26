# Autonomous mode

How `flow-work` runs when the user explicitly asks it to work on its own. Read from `SKILL.md` only after the user's yes.

For a task that is not complex, the user can ask for it when starting the task or at any point (see "Working modes" in `SKILL.md`) ("work on your own", "autonomous mode"). You may also suggest it after research, when the size verdict says the task is small. Never switch to it without the user's explicit yes.

In autonomous mode, chain the phases without stopping for routine confirmations:

- **Skip:** showing each phase's result and waiting, the research summary, the seams confirmation, the test gate and the progress lines. Take the plan's assumed answers when they are clearly safe.
- **Still stop for** what really needs the programmer:
  - a decision the issue and the plan don't settle, where a wrong guess would cost real rework;
  - a test that looks wrong (see "Changing an approved test"), or a check you cannot make pass;
  - a task that turns out bigger than it looked;
  - anything that leaves the machine or changes shared state: commits, pushes, status moves, issue edits, the PR.
- **Tests stay frozen.** With no test gate, record the tests with the `.scratch/flow/<id>/approved-tests/` manifest right after writing them, and check them against it as usual.
- **Commits come at the end.** Instead of a commit command per phase, give the user the `test`, `feat` and `fix`/`refactor` commands (and `chore` for an Engram export) together with the final report, each ending with `&& git push`.
- **The final report is never skipped.** It also lists every assumption you made on the user's behalf, so they can check them.

The user can leave autonomous mode at any moment ("stop", "back to pair mode"). Go back to stopping at every phase from there.
