# Roles in another harness

Read from `SKILL.md` ("Who runs each role") when a role is set to `<manager>:<harness>` or `<manager>:other` in the **Harnesses** section of `docs/agents/workflow.md`.

For a role set to another harness:

- Read the manager's own skill or guide before using it, and run the harness in the current worktree, with the model and effort from the table. Never create a worktree or a branch for it.
- Give it the same brief and the same hand-back contract as a subagent, written to stand on its own: it starts with none of this session's context. Add that it must not commit, push or open a PR.
- **Notes it cannot read.** That harness may not have the Engram MCP server, so it cannot read notes passed as keys. Before launching it, when notes live in Engram, export the notes this role needs to `.scratch/flow/<id>/<phase>.md` and pass those paths in the brief. Tell it to write its own result to `.scratch/flow/<id>/<role>.md`. When it finishes, you save that result to Engram under the usual key.
- **You launched it, so you collect its result and close it.** Never leave it running for the user to clean up. Use the first way below that is available.

## 1. Orca orchestration (preferred)

When the manager is Orca and `orca skills get orchestration` returns its guide, use it: the worker reports back on its own and closes itself when it finishes.

- Read that guide first (version-matched; never guess flags). For this role, its rules win over the general advice to use orchestration only when the user asks to supervise: the user chose it in `workflow.md`.
- Write the brief to a file and start the role as a worker in the current worktree:

  ```sh
  orca orchestration worker-start --spec-file <brief file> --worktree current \
    --agent <harness> --model <model> --effort <level> --task-title "<ref> <role>" --json
  ```

  Pass `--effort` only when the table gives one. Don't pass `--keep-open`.
- Tell the user in one line that the role is running and that Orca will report when it is done. Then **end your turn**. Orca wakes you; never poll it or run a watch script.
- When Orca wakes you:
  - `worker_done`: read the note file, check it is complete, and go on. The worker closes on its own; follow any `next` the receipt or `worker-list` gives.
  - A `question` from the worker: answer it with `orchestration reply` only when the task, the plan or the user's answers settle it. Otherwise ask the user first.
  - An `escalation` with `stopReason` (it stopped without `worker_done`): tell the user what happened and propose retrying on the same harness, the next harness, or a subagent.
- If `worker-start` fails, don't rerun it: read `failedStage`, follow the guide's recovery reference, and if it still can't start, use the fallback below or the role's next harness, and say so in one line.

## 2. Fallback: launch and wait on the terminal

When Orca orchestration is not available (an older Orca, or another manager such as Herdr):

- Launch the harness as a terminal, not a chat (for Orca, `agent launch --agent <harness> --model <model> --effort <level> --surface terminal --json`; Herdr has no model or effort options of its own, so its guide, printed by `hc --skill`, says how to launch a program in a folder, and the model and effort go as that harness's own command-line options). Keep the handle the launch returns (`launch.outcome.handle`).
- **It will not tell you it is done.** It is an interactive session: when it finishes, it prints its answer and sits idle. So end its brief with two fixed instructions: write the full result to the note file you named, then print a last line `FLOW-<ROLE>-DONE` (for example `FLOW-REVIEW-DONE`).
- Wait in a loop with the manager's wait command and a timeout (for Orca, `terminal wait --terminal <handle> --for tui-idle --timeout-ms 600000 --json`). Don't end your turn while it runs, unless your harness re-invokes you when a background command finishes.
- Each time it goes idle, read its screen (for Orca, `terminal read --terminal <handle> --screen --json`). With the done line and the note file present, it is finished. Idle without the done line means it is waiting for something (a question, a permission prompt, an error): bring it to the user, never answer it yourself.
- After about 45 minutes with no done line, tell the user what you see on its screen and ask whether to keep waiting.
- When it is done, read its note, then close only its own terminal (for Orca, `terminal close --terminal <handle> --json`; never `--all`) and tell the user in one line.
- Herdr: use the wait, read and close commands its guide gives. If it has no way to wait for idle, check every minute whether the note file exists and ends with the done line.

## In both cases

- "One writer at a time" still holds: no other role that edits files starts until it is done.
- Tell the user in one line which harness and model run the role, and which of the two ways is used.
- If the launch fails, the harness reports that it has no quota left, or the manager is not available, go on to the role's next harness and say so in one line. When none is usable, run the role as a subagent and say so. Never stop the task for this.
- **A launch the permission system denies is not a failure to work around.** Your own harness may block the launch (for example, Claude Code's auto mode can deny starting another agent with a prompt). Never retry it with a reworded or split command, and never launch it some other way. Tell the user in one line that the launch was blocked and by what, run the role on its next harness or as a subagent, and say how they can allow it next time: approving the command themselves, or the allow rule or mode their harness offers. Don't try again for the rest of the task unless the user says it is now allowed.
- The split is fixed by the tables: don't spread work across harnesses on your own to even out usage, because the harness gives you no usage figures.
