---
name: flow-work
description: Develop one task end to end, from any task tracker (GitHub Issues, GitLab, Jira, Linear, local files…), as an orchestrator with role subagents - research, plan, tests first with a user approval gate, implementation, two-axis review, PR. Takes a task id, or creates the task from the current conversation and starts right away. Never commits on its own. Use when the user runs /flow-work, or asks to pick up, start or develop a task.
---

# flow-work

Paths starting with `../` are relative to this skill's folder: they point at sibling skills in the same skills directory.

You are the **orchestrator**. You work **with the user, in the session**: you show what each phase found, ask their questions, and move on only when they agree. This is pair work with the user as the navigator, never a job that runs on its own. Bulky work goes to **role subagents**, so your own context stays small.

## Hard rules

These override anything more permissive elsewhere, including the user's general git instructions:

- **The user is in the loop at every phase.** End each phase by showing its result in plain words and saying what comes next (see "Phase messages"). Don't chain phases silently. The test gate and autonomous mode follow "Working modes".
- **Decisions belong to the user.** Anything the issue and the agreed plan don't settle (a design choice, a dependency, a trade-off, a scope question) goes to the user as a question with your recommendation. Never decide it for them.
- **Never commit on your own.** At each commit point, give the user the exact command and wait. Run it only if the user explicitly tells you to.
- **Never merge PRs.** The user reviews and merges every PR on the code host.
- **Never modify approved tests on your own.** After the test gate, the test files are frozen. If a test looks wrong, follow "Changing an approved test": stop, explain why, and change it only after the user's OK.
- **One writer at a time.** Subagents that edit files run one after another. Read-only subagents (research, review) may run in parallel.
- **No worktrees, no child branches beyond the ones in `docs/agents/workflow.md`.**
- **Ask in one round, and explain what is new.** Gather every open question the phase has and ask the independent ones together, each with your proposed answer first; never one at a time. Explain in plain words anything new or complex before asking about it. The full rule is in `../flow-setup/asking-questions.md`: read it before your first question. After asking, stop and wait.

## Subagents

Launch each role as a subagent with your harness's own mechanism: the `Agent` tool in Claude Code (`subagent_type: "general-purpose"`), the `Task` tool in OpenCode and Cursor, the subagent support in Codex or Gemini CLI. If the harness cannot spawn subagents, run the phase yourself, keeping the same brief and hand-back discipline.

Each role uses a model **tier**, **strong** or **fast**, and the **Harnesses** section of `docs/agents/workflow.md` says which harness (Claude Code, OpenCode, Codex…) runs it and with which model. That choice is the user's and overrides any default subagent model. Start each subagent's visible name with the model it runs on, for example `sonnet: tests #42`.

| Role | Tier | Writes files? |
|---|---|---|
| research | fast | no |
| plan | strong | no |
| tests | strong | yes (test files only) |
| implement | fast | yes (never test files) |
| review-standards, review-spec | fast | no |
| fix | fast | yes (never test files) |

**Profiles.** Every task runs on **standard**: each role uses its harness's strong or fast model. Switch to **deep** only after the user's explicit OK, never on your own: the roles on the strong tier then use their harness's **deep model**, when it has one. Propose it, as one question with your reasons and a recommendation, when you judge the task very complex: the impact map spans several modules, there is a hard concurrency, data-migration or security concern, or the plan must choose between real architectural alternatives. Also propose it when a phase on standard does not converge: the user rejects the plan twice, or tests or fixes still fail after two rounds. The usual moment is the end of research, before the plan. The OK holds for the rest of this task only. Don't propose it for routine tasks: most tasks don't need it.

**Who runs each role.** The **Harnesses** section of `docs/agents/workflow.md` has two tables. The first lists the harnesses the user has: where each runs, its strong, fast and deep models and its effort. The second gives each role an ordered list of harnesses, and the tier it uses. Use the first harness of the list that is available and has quota; the others are fallbacks. `subagent` means a subagent of the harness running this flow; `<manager>:<harness>`, for example `orca:opencode` or `herdr:claude`, means another harness launched through an agent manager (Orca, Herdr); `<manager>:other` means any harness different from the one running this flow. A section titled **Agents**, from version 0.1.0, is read the same way. Effort is passed only when the table gives one.

If the section is missing, every role is a subagent of this harness. If the repo still has the older **Models** section (two profiles that map the tiers to models, and no harnesses table), use it as before: every role is a subagent on the model its profile gives, and if the harness cannot choose a model per subagent, the subagent inherits the session model.

For a role set to another harness:

- Read the manager's own skill or guide before using it, and launch the harness in the current worktree, passing the model and effort from the table (for Orca, `agent launch --agent <harness> --model <model> --effort <level>`; Herdr has no model or effort options of its own, so its guide, printed by `hc --skill`, says how to launch a program in a folder, and the model and effort go as that harness's own command-line options). Never create a worktree or a branch for it.
- Give it the same brief and the same hand-back contract as a subagent (below), written to stand on its own: it starts with none of this session's context. Add that it must not commit, push or open a PR.
- Wait for it to finish, then read its note. "One writer at a time" still holds: no other role that edits files starts until it is done.
- Tell the user in one line which harness and model run the role.
- If the launch fails, the harness reports that it has no quota left, or the manager is not available, go on to the role's next harness and say so in one line. When none is usable, run the role as a subagent and say so. Never stop the task for this.
- The split is fixed by the tables: don't spread work across harnesses on your own to even out usage, because the harness gives you no usage figures.

Every subagent brief includes:

- The repo path, task id and current branch.
- Pointers, not pasted content: the task (read it with `view-task`), `docs/agents/*.md` including the tracker file, and the notes from earlier phases.
- The rule: read only what the role needs; do not spawn agents; artifacts (code, comments, test names) in English unless the repo already uses another language.
- The rule: subagents cannot talk to the user. When something is not settled by the issue, the plan or the brief, stop and return it as a question, with options and a recommendation. Do not guess.
- The hand-back contract: **save the full result as a note under the key given, then return at most 15 lines**: outcome, files touched (as `path:line` links), the note key, and any blocker or question for the user. No pasted logs or file contents.

**Notes.** Keys follow `flow/<repo>/<id>/<phase>`, for example `flow/my-app/42/research`.

- With the Engram MCP server available: save with `mem_save` (topic key = the note key), read with `mem_search` and `mem_get_observation`, update with `mem_update`.
- Without it: write the note to `.scratch/flow/<id>/<phase>.md` in the repo and pass that path instead. Make sure `.scratch/` is git-ignored.
- **If saving to Engram fails** (the call errors, is blocked, or the note cannot be read back): write that note to `.scratch/flow/<id>/<phase>.md` instead, pass that path in the briefs, and tell the user in one line that the note went to the repo's scratch folder and why. Never go on as if a note had been saved. A subagent that cannot save its note says so in its hand-back and returns the full result in a file under `.scratch/flow/<id>/`.

**The state note.** You, the orchestrator, keep one extra note under `flow/<repo>/<id>/state`: where the task stands, in a few fixed lines. It is what lets the work continue after a break, a new session or a summarised context, without guessing.

```
phase: <last phase finished> · next: <phase>
mode: <semi-autonomous | pair | autonomous>
profile: <standard | deep>
branch: <task branch>
approved tests: <commit hash, the manifest path, or "not yet">
waiting on: <the questions asked and not yet answered, or "nothing">
decided: <one line per user decision not yet written to the task>
pending commits: <commit commands given and not yet confirmed, or "none">
```

- **Update it, never add another**: at the end of every phase, when the mode or the profile changes, and whenever you stop to wait for the user.
- **Read it first** when you resume a task, and whenever you are not sure where the task stands (for example after your context was summarised). If it contradicts the branch or the task, trust those, fix the note and tell the user in one line.
- **Close it** when the PR is opened: it stops being a progress note and becomes the task's memory for later work (see "Close the state note" in Phase 8).

Notes are working memory for this session's subagents. The durable record lives with the task.

## The task tracker

This skill works with any task tracker. It never calls one directly: every operation written in backticks, such as `view-task`, `create-record` or `move-status`, is looked up in `docs/agents/tracker.md` (or the shared tracker file named in `workflow.md`), and done exactly as written there. That file also says:

- how a task is identified (`<id>`), referenced in text (`<ref>`, for example `#42` or `PROJ-123`), written in branch names (`<id>`) and in commit messages (`<commit-ref>`, as in `feat(<commit-ref>): …`);
- the markup, the **note block** and the **record marker** to use;
- which **alternatives** replace what the tracker can't do, for example a task folder in the repo (`.flow/tasks/<id>/`) instead of comments. When an operation uses an alternative, follow the alternative.

In this skill, "task" means a task in that tracker, and "issue" is used in the same sense. If an operation is missing from the tracker file, ask the user how to do it, propose adding it to the file, and continue.

## The task is the source of truth

Anyone must be able to understand the task from the tracker alone, without the notes. The description holds the _what_. At most two records from this flow hold the rest: the plan record (the _how_) and the summary record. When something changes, **edit** what exists instead of adding something new.

- **Creating** the plan record or the summary record needs no confirmation.
- **Editing** the description or a record, and **deleting** anything, always need the user's OK: show the exact change first and wait.

Read `references/records.md` before you first write to the task (the end of Phase 4): it has the rules for the description and for each record, and their templates.

## Team visibility

The work is visible on the task while it happens, not only when the PR arrives: a linked branch, pushed commits, the plan record, the assignee and the status.

- Every commit command you give the user ends with `git push`.
- Assigning the task and moving its status are proposed, and done only after the user's OK.

Read `references/team-visibility.md` in Phase 1, before you confirm the task with the user: it says when to propose the assignment and each status move.

## Phase messages

Write every message to the user for someone who has not read the code, the notes or this skill, and who may come back to it after doing something else. It must be understood on its own, at a first reading. **Clear comes before short**: cut what the user does not need, never the words that make a line understandable.

Before your first message to the user, read `references/phase-messages.md`: it shows a cryptic and a clear version of the same message.

**Shape.** Keep this order. Skip a part only when it has nothing to say.

1. **Where we are.** One line with the task, the phase that just ended and the one that comes next, for example `#42 Export to CSV · research done (3 of 8) · next: plan`.
2. **What you need from the user.** One line: an OK, some answers, a choice, or "nothing, I go on with the plan".
3. **What the task is about.** One line in plain words on what it fixes or builds, so the user can read the rest without remembering the issue.
4. **What this phase found or did.** Only what is new, surprising or needs a decision. One item per line, each a full sentence that says what it is and why it matters, with `path:line` links instead of quoted code.
5. **The questions**, last (see below).
6. **What happens next.** One line on what you will do once they answer, and what a plain "OK" accepts.

**Plain language.**

- **Full sentences**, not fragments, arrows or lists of labels. `session check: 3 callers, 1 uncovered` tells the user nothing. "Three places check the session. The issue mentions two; the third is the export job (`path:line`), so we must decide whether this task covers it" does.
- **This skill's own words stay inside the skill.** The user does not know them. Say what the thing is, in the language of the conversation:

  | Instead of | Say something like |
  |---|---|
  | seam | where the test calls the code: this function, this endpoint, this screen |
  | impact map | the places in the code this change touches |
  | size verdict | whether the task fits in one session |
  | edge case (at the test gate) | a test where something had to be decided that we had not agreed |
  | plan record, summary record | the plan comment and the summary comment on the task |
  | standards axis, spec axis | "does it follow the project's rules" and "does it do what the task asks" |
  | deep profile, strong tier | using a more capable model for the plan and the tests |
  | note keys, operation names (`move-status`, `create-record`) | never shown: say what you will do ("move the task to in progress") |

  A working mode (pair, semi-autonomous, autonomous) may be named, but always with what it changes for the user.
- **Names from the code** (a private field, a mock, an abbreviation such as `mic`/`sys`) are explained in a few words the first time they appear.
- **Scenarios** are written as what the user does, what should happen and what happens today.
- **Everything left out of scope** comes with its reason.
- **Rewrite, never forward.** A subagent's hand-back is shorthand written for you. Read its note when you need the detail to explain something, then write the message from scratch for the user.

**Length.** There is no line budget. A message is as long as it needs to be understood at a first reading, and no longer; most fit on one screen. Lists the user approves item by item (where to test and the scenarios, tests with open decisions, review findings) run one line per item. Don't recap earlier phases, don't retell what a subagent did, and don't list what went as expected: the detail lives in the notes, and the user can ask for it.

**Questions.** Ask them as in `../flow-setup/asking-questions.md`: together, each standing on its own, with new or complex topics explained first. Never refer to something the user has not seen in this message.

**Don't go silent.** Before a step that takes a while (a subagent, the full test suite), say in one line what starts now and what the user will get back. When a phase finds nothing worth reporting, say so in one line and go on.

The final report (Phase 8) keeps its own shape, and the plain-language rules apply to it too.

## Working modes

Every task starts in the **Default working mode** set in the **Agents** section of `docs/agents/workflow.md`, or in **semi-autonomous** when it is not set. Say which mode the task starts in, and what it changes for the user, when you confirm the task in Phase 1. A default of `autonomous` counts as the user's yes only for a task that research finds small and simple: until research says so, and for any other task, work in semi-autonomous and tell the user why.

In **semi-autonomous** mode you stop at every phase, but the test gate stops only for the edge cases the plan did not settle, since the user already approved the seams and scenarios (see Phase 5). Changing to a mode that is not the repo's default needs the user's explicit yes:

- **Pair**: the user reviews every test. Propose it, as one question with your reasons, when the task has loose ends or is very complex: open questions the plan can't close, an impact map that spans several modules, an architectural choice between real alternatives. The usual moment is the end of research, together with the deep profile if that applies (see "Profiles").
- **Autonomous**: you chain the phases on your own. Suggest it after research when the task is small and simple. When the user says yes, read `references/autonomous-mode.md` and follow it: it lists what you may skip and what you must still stop for.

The user can ask for any mode when starting (for example `/flow-work #42, pair mode`) or at any moment ("show me every test", "work on your own", "back to semi-autonomous").

## Changing an approved test

Approved tests change only through the procedure in `references/approved-test-change.md`: the subagent stops without touching the test, the user decides, the tests subagent changes only those tests, and the change gets its own commit and a line in the plan record. Read it as soon as a test looks wrong. Never loosen an assertion only to make it pass.

## Phase 0: Preflight

1. Read `docs/agents/workflow.md`. If it does not exist, tell the user and ask, in one line, whether to run `flow-setup` now. If yes, read `../flow-setup/SKILL.md`, follow it, then come back here. If no, stop. If a field this skill needs is missing, ask only for that field.
2. Read the tracker file (`docs/agents/tracker.md`, or the shared path in `workflow.md`). If only an old `docs/agents/issue-tracker.md` exists, offer to run `flow-setup` to convert it.
3. Run `git status`. If there are uncommitted changes that are not part of this task, stop and ask the user what to do with them.

## Phase 1: The task

- **Task id given** (`#42`, `PROJ-123` or a URL): read it with `view-task`. State its title back to the user. If it is assigned to someone else, or its status is already "in progress" or later, or a branch for it already exists on the remote with someone else's commits, tell the user and ask whether to continue before doing anything else: someone may already be on it.
- **No id**: the task comes from the current conversation. Draft it with the template in `../flow-backlog/SKILL.md`, show it, and create it with `create-task` once the user approves. Then continue with that id.

Then check its position:

- **Parent**: `get-parent`.
- **Open blockers**: `open-blockers`. If any blocker is still open, or `pr-status` shows its PR is not merged into the group branch, stop and tell the user which one.
- **Children**: `list-children`. If the task itself has open children, it is a group. Ask which child to start, and suggest the first one with no open blockers.

Show the user, in a few lines, the task as you understand it (title, what it asks for, parent and blockers) and the branch you will create. Start once they confirm. In the same message, ask whether to assign the issue to them and, unless `move-status` is not used, move it to "in progress" (see "Team visibility").

## Phase 2: Branch

Use the patterns and base branch in `docs/agents/workflow.md`. Before branching off a branch, bring it up to date: `git fetch origin`, check it out, then `git pull --ff-only`. Pulling with `--ff-only` is part of this flow and needs no confirmation; if it cannot fast-forward, stop and tell the user.

Create branches with `create-branch`, so each one is linked to its task:

- **Child task**: make sure the group branch `feature/<parent-id>-<slug>` exists. If it doesn't, create it from the updated base branch with `create-branch` for the parent task, and push it. Then update the group branch and create `task/<id>-<slug>` from it with `create-branch`.
- **Standalone task**: update the base branch and create `task/<id>-<slug>` from it with `create-branch`.
- Creating these branches is part of the flow and needs no extra confirmation once the user has confirmed the task.
- If the task branch already exists, check it out and continue from where it was: read the state note first (see "The state note"), then check it against this task's plan record, its other notes and its commits. Tell the user in one message where the task stands, what was waiting on them, and what you will do next; continue once they confirm.

**Sync Engram in.** If the Engram CLI is available and the repo has a `.engram/` folder, run `engram sync --status`. If it reports chunks that are not imported yet, run `engram sync --import`, then tell the user in one line what was imported. Skip this when **Engram sync** in `docs/agents/workflow.md` is `never`.

Tell the user, in one line, the branch name (now linked to the task) and what was imported from Engram, if anything, then go on to research. The user already confirmed the branch in Phase 1, so there is nothing to wait for here.

## Phase 3: Research (fast)

Brief a research subagent to read the issue, the parent issue's "Architecture notes" for a child task, the glossary and ADRs from `docs/agents/domain.md`, and the code the task touches. It also looks for the closed state notes of earlier tasks in the same area (`flow/<repo>/*/state`; with Engram, search by the modules and terms the task touches) and reads their decisions, gotchas and open ends. They are leads to check against the code, never facts. It checks the issue's "Preliminary notes" (libraries, connectors, APIs) against the code and the dependencies as they are today, and flags anything that no longer holds. It saves under `flow/<repo>/<id>/research` and returns:

- What exists today that the task builds on (as `path:line` links).
- An **impact map**: for each operation the task hooks into or changes (saving a record, assigning an item, sending an event, a function every caller must go through), every place in the code where that operation happens, found by searching the code for the operation itself, not taken from the issue's list. Each entry has its `path:line` and says whether the task covers it. A place the issue does not mention is an open question, never silently out of scope.
- Every claim that narrows the scope ("X needs no change because…") with its evidence: the search it ran and what it found.
- Open questions about the task itself.
- A **size verdict**: does it fit one working session as one vertical slice? If not, a proposed split into smaller vertical slices.

Before showing the research, **verify every scope-narrowing claim yourself** with one direct search. A wrong "this needs no change" spreads: it goes into the out-of-scope list, the plan writes no test for it, and the spec review checks the code against that list and approves the gap.

Show the user the research as a phase message: what the task builds on, the places the change touches that the issue did not mention, the open questions, and whether the task fits in one session. Go on to planning once they agree; their comments go into the plan brief. If the size verdict says the task is small and simple, you may suggest autonomous mode in the same message. If it shows loose ends or a very complex task, propose pair mode and, if needed, the deep profile in the same message (see "Working modes" and "Profiles").

**If the task is too big**, stop and offer the user, as one question:

- **(a) Keep this task small**: trim it to the first slice and create the rest as new issues for later. If this task has a parent, they become siblings under the same parent. If not, they are created as standalone issues that this one blocks.
- **(b) Turn it into a parent**: this task becomes the parent, the slices become its children (`create-child`) with blocking links (`add-blocker`), and the work continues on a group branch with the first child. Propose adding "Architecture notes" to its description (see `../flow-backlog/SKILL.md`), as an edit the user approves.

Create the issues by following `../to-tickets/SKILL.md` with the overrides in `../flow-backlog/SKILL.md`. For (b), rename the branch to the group pattern if no commits exist yet, otherwise ask the user how to proceed. Then continue with the chosen task.

## Phase 4: Plan (strong)

This is where the task gets its detail. The issue gives the big picture and some leads; the plan turns them into precise criteria, seams, scenarios and steps against the code as it is now. Expect it to refine or even contradict the issue: that is the point, and the description is then updated with a `## Changes` line.

Brief a plan subagent with the issue and the research key. Point it to `references/tdd.md`, `references/tests.md` and `references/mocking.md` in this skill's folder. It saves under `flow/<repo>/<id>/plan` and returns:

- Questions that remove ambiguity, each with the answer it would assume.
- Refined acceptance criteria and an "out of scope" list. Each out-of-scope item that leaves out a place in the research's impact map gives its reason and evidence.
- The **seams** (public interfaces) to test, each with one line on what it catches and what it misses. Every place in the impact map that the task covers is reached by at least one scenario.
- The test scenarios, one per acceptance criterion where possible.
- **Untestable parts**: anything with no reasonable seam for an automated test (configuration, visual styling, documentation-only changes, infrastructure scripts, third-party dashboards). For each, a short **manual verification** step instead: what to do and what you should observe. Prefer a test whenever a reasonable one exists; this is the exception, not a shortcut.
- An implementation outline: steps, not file-level detail.
- **Docs to touch**: the project documents this task makes stale or genuinely needs (following "Just enough docs" below) (a module's guide, the README, a user guide), each with what changes, or "none". Use the folder and rules in the **Docs** section of `docs/agents/workflow.md`; rules in the project's `AGENTS.md` or `CLAUDE.md` take precedence.
- **ADR candidates**: the architectural decisions this plan makes (a new dependency, a pattern, a boundary between modules, a data model change), each with one line on why. Only decisions that are hard to reverse, affect more than one module, or were chosen between real alternatives (see `references/adr-template.md`). Most tasks have none. It also flags any conflict with an existing ADR or with the parent's "Architecture notes", which goes to the user as a question.

Bring the plan to the user in **one round**, not two. Show the plan as it stands with the assumed answers: the refined acceptance criteria, where each test calls the code and what it catches, the scenarios, and any manual verification steps. In the same message, ask the questions, assumed answer first (see `../flow-setup/asking-questions.md`), and ask for the OK on the plan. Say that the OK also updates the task description with these criteria, when step 2 below applies, so that edit needs no separate stop. If an answer changes the plan, revise it and show only what changed, then ask again. Ask a question before showing the plan only when the plan cannot be drafted without its answer.

No test is written at a seam the user has not confirmed, and a part is only verified manually if the user agreed it can't be tested. Save the agreed result back to the same note.

Then update the task (see "The task is the source of truth"):

1. Create the plan record (`create-record`) with the agreed seams, scenarios and steps.
2. The description must hold the acceptance criteria as a checklist (`- [ ]`), because the summary record and the final report grade the task against it. If the description has no acceptance criteria section (for example a bug report written from a template), or the refined criteria or the out-of-scope list differ from it, edit the description (criteria as they now stand, the `## Changes` line, and the link to the plan record). The user's OK on the plan covers this edit when the plan message showed the criteria and said so; otherwise show the exact change and wait. Never report "n/n criteria" for criteria that are not written in the description.

## Phase 5: Tests (strong) and the test gate

If the user agreed that the whole task has no testable seam, skip this phase: the agreed manual verification steps take the place of the tests, and Phase 6 ends by running them. If only some parts are untestable, write the tests for the rest as usual.

Brief a tests subagent with the plan key. It writes only test files, matching the globs in `docs/agents/workflow.md`, at the confirmed seams and following `references/tests.md` and `references/mocking.md`. It runs them and confirms each fails **for the expected reason**: missing behaviour, not a syntax, import or setup error. It saves under `flow/<repo>/<id>/tests` and returns one line per scenario with its `path:line` link and its failure reason, and flags every **edge case**:

- a test that departs from its approved scenario, or a scenario left without a test;
- a scenario tested at a different seam than the one agreed, or a test that mocks the code it checks;
- an expected value or behaviour the plan did not settle, which the tests subagent had to choose;
- a test that still fails for a reason other than the expected one.

**Semi-autonomous mode.** Check the hand-back yourself: every approved scenario has a test at its confirmed seam, and every test belongs to a scenario. A mismatch is an edge case too.

- With edge cases: present only those, in the format below, and wait for the OK on them.
- Without: don't wait. Record the tests with the `.scratch/flow/<id>/approved-tests/` manifest (see below), then show in one message the number of tests, that each fails for the expected reason and the command to run them. Go on to Phase 6. The test commit comes together with the implementation commit (see Phase 6).

**Pair mode.** Present every test to the user. This message is a long list, one line per test, so shape it for fast scanning: if the `i-have-adhd` skill is installed, read its SKILL.md and apply its formatting rules to this message only; otherwise use the action first, numbered lines, no preamble, no recap.

- First line: the action, "Review the tests and reply OK to continue."
- One numbered line per scenario: what it checks, with a link to the test.
- The command to run them.

Wait for the OK. If the user wants changes, send them to the tests subagent and present again.

After the OK, give the commit command, for example:

```sh
git add <test files> && git commit -m "test(<commit-ref>): <summary>" && git push
```

This commit is the record of the approved tests. Once the user confirms it is done, save its hash under `flow/<repo>/<id>/tests`. If the user does not want this commit, copy the test files to `.scratch/flow/<id>/approved-tests/` with a `sha256sum` manifest, and use that as the record instead.

## Phase 6: Implement (fast)

Brief an implement subagent with the plan and tests keys. It writes the minimum code that makes the tests pass, following the plan's outline, and must not edit any test file. It runs the single test files and the typecheck regularly, and the full suite once at the end (commands in `docs/agents/workflow.md`). If a test seems wrong or impossible to satisfy, it stops and reports it as step 1 of "Changing an approved test", instead of working around it. It saves under `flow/<repo>/<id>/implement`.

The work can be split into several implement subagents, one after another, when the plan has clearly separate steps. Between them, tell the user in one line which step is done and which comes next. If a subagent returns a question, bring it to the user before continuing.

**Just enough docs.** Document only what the code cannot easily tell: what a module or feature is for, how to use, run or configure it, flows that cross several modules, external integrations, and non-obvious constraints or gotchas. Don't restate what reading the code gives quickly (signatures, file-by-file or line-by-line walkthroughs, generated API listings), and don't record history (that lives in the issue and the ADRs). Prefer a few lines in an existing document over a new file. When in doubt, leave it out.

**Docs.** With the tests green, update or create the documents listed in the plan's "Docs to touch" (an implement subagent, fast tier, never touching tests). Describe how things work now, not the history of the change: that lives in the issue and the ADRs. Create the docs folder only when a first document needs it, and then also its `README.md` from `../flow-setup/docs-readme-template.md`, in the language the repo's docs use, with its links adjusted if the docs folder is not `docs/`: it tells readers that these docs are deliberately short and where everything else lives. Keep its "Contents" list current whenever a document is added, renamed or removed. If the folder exists but has no such guide, propose adding it (or its "These docs are deliberately short" note to an existing index) as part of this step. If the plan said "none" but the change clearly makes a document stale, add it and tell the user.

Then check it yourself:

- **Manual verification**, if the plan has any: run the steps you can run yourself (a command, a build, a config check) and report what you observed; give the user the rest as a short checklist and wait until they confirm each one. A failed step is handled like a failing test.
- `git diff <approved-tests-commit> -- <test globs>` is empty, using the latest approved-tests reference (or the files match the `.scratch` manifest). If not, stop and tell the user.
- The full suite and typecheck pass.

If the implementation departed from the plan (a step changed, was added or was dropped), propose an edit of the plan record: the affected section updated, plus a line under "Changes to the plan". Apply it once the user approves. If the requirements changed too, propose the description edit as well.

Give the commit command (`feat(<commit-ref>): …`, ending with `&& git push`) and wait, as in the hard rules. If the tests have no commit yet (semi-autonomous mode), give the `test(<commit-ref>): …` command first, adding only the test files, then the `feat` one, so the history still shows the tests before the code.

## Phase 7: Review (2 × fast, parallel)

Read `references/code-review.md` and run its two axes as two parallel subagents:

- **Fixed point**: the merge-base of the task branch with its target (the group branch, or the base branch for a standalone task). Diff with `git diff <merge-base>...HEAD`, plus `git diff` for anything not committed.
- **Spec source**: the issue and the plan key. The spec axis also checks that the documents in "Docs to touch" match what the code now does: a stale or missing document is a finding, and so is a document that only repeats what the code already says ("Just enough docs"). It also rebuilds the impact map on its own, searching for each operation the task hooks into, and reports any place that is neither handled nor left out with evidence. The issue's out-of-scope list is a claim to check, not proof.
- **Standards sources**: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.claude/rules/*`, `.cursor/rules/*`, `CONTRIBUTING.md`, `CODING_STANDARDS.md` and any other standards file, plus the smell baseline in `references/code-review.md`.
- **Architecture sources**, for the standards axis: the ADRs and the glossary from `docs/agents/domain.md`, the parent's "Architecture notes" for a child task, and this task's ADR candidates. Any code that contradicts an ADR is a finding that cites it ("contradicts ADR-0007"); so is a domain term used differently from the glossary.

Each saves under `flow/<repo>/<id>/review-standards` or `flow/<repo>/<id>/review-spec`. Show the findings as numbered tables, one per axis, and ask the user which to fix by number, as described in "Aggregate" in `references/code-review.md`. Head each table with what it answers ("Does it follow the project's rules?", "Does it do what the task asks?"), and write each finding so the user can decide without opening the file: what is wrong, and what happens if it stays.

**Review in another harness.** When the `review` role in `docs/agents/workflow.md` is set to another harness, run the two axes through it as in "Who runs each role", with a read-only brief, for an independent second opinion: flow in Claude → review with Codex; flow in Codex or OpenCode → review with Claude. When the section is missing, do the same only if an agent manager is installed and the user's own instructions ask for it. Otherwise, or when the other harness cannot be launched, the harness's own subagents run the review as described above.

If any, brief a fix subagent with those findings. It never touches test files. Re-run the checks from Phase 6, then give the commit command (`fix(<commit-ref>): …` or `refactor(<commit-ref>): …`, ending with `&& git push`). If a fix changes the plan, propose the plan record edit as in Phase 6.

## Phase 8: Final report and PR

Write the report in this shape:

1. **Detailed summary** at the top:
   - what now works, in concrete terms;
   - each acceptance criterion from the description with ✅ or ❌ (the same text, not a rewording);
   - test results, and the manual verification results if any;
   - review findings fixed and left open;
   - any deviation from the plan;
   - the documents created or updated;
   - the ADR candidates, which become ADRs in the next step.
   - propose ticking the met criteria in the description (`edit-description`, needs the user's OK).
2. **Files to review, in vertical order**: tests → entry point → logic → data. One `path:line` link per file, with one line on what changed. The user reviews the code; do not ask them to skip it.
3. **Short summary** at the end: three lines at most.

**Close in one round.** The report is followed by several small decisions: ticking the met criteria, the ADR drafts, the Engram export and opening the PR (with the move to "in review"). Ask the ones that apply together, right after the report, as in `../flow-setup/asking-questions.md`, instead of one stop each. Then carry out what the user accepted in the order below, stopping only where a commit command has to be run.

**Write the ADRs**, before the PR. For each ADR candidate from the plan that still holds after implementation and review, draft `docs/adr/<NNNN>-<title>.md` from `references/adr-template.md` (location and language as in `docs/agents/domain.md`). Show the drafts to the user and write them once they approve; if an ADR supersedes an older one, propose updating the old one's status too. Give the commit command `git add docs/adr && git commit -m "docs(<commit-ref>): add ADR-<NNNN> <title>" && git push`. Skip this step when there are no candidates.

**Sync Engram out**, before the PR. Follow **Engram sync** in `docs/agents/workflow.md`:

- `ask` (default): ask whether to export this project's Engram memory to the repo, as part of the closing round.
- `always`: export without asking.
- `never`: skip.

To export, run `engram sync` from the repo root. It writes this project's memory to `.engram/` as compressed chunks; prompts are excluded. Then give the commit command, for example `git add .engram && git commit -m "chore(<commit-ref>): sync engram memory" && git push`, and wait, as in the hard rules. The export holds every memory of this project, not only this task's notes: remind the user of that the first time.

Then open the PR, if the user said yes in the closing round, with `open-pr`:

- `--base`: the group branch for a child task, or the base branch for a standalone task.
- Title and body in the PR language from `docs/agents/workflow.md`.
- The `closing-reference` for this task in the body, plus a link to the parent task if there is one.

Then create the summary record on the task, with the PR link, and move the task to "in review" if the user accepted it in the closing round (skip it when `move-status` is not used). The user reviews and merges the PR.

**Close the state note.** Last, rewrite `flow/<repo>/<id>/state` in its closed form. The progress fields are of no use any more; what a later task in this area needs is what was built, where, and what to watch out for. This is a note for agents, so keep it exact and ordered, in this shape:

```
<ref> <title> · closed <YYYY-MM-DD>
task: <task link> · PR: <PR link> · branch: <task branch>

does: <what works now, in two or three lines; behaviour, not history>
where:
- <path:line>: <entry point | main logic | data | tests>
decisions:
- <decision>: <why> (<ADR-NNNN> if it has one)
gotchas:
- <what surprised us, or what a later change here must not break>
open:
- <review finding left unfixed | follow-up task | part left out, with its reason>
verify: <the command that runs this task's tests, and any manual step>
detail: <the keys of this task's other notes>
```

- **Write it from the final code**, not from the plan: check each `path:line` and each decision against what was merged into the branch. Drop anything that did not survive.
- **About twenty lines.** No retelling of the phases. Omit a section that has nothing to say.
- It needs no confirmation: tell the user in one line that the task's memory is saved, and where.
- If the PR review later changes the code, update the same note when the user says the PR is merged.

## After the merge

When the user says the PR is merged:

- **Child task**: list the siblings that are now unblocked and suggest the next one (`/flow-work <ref>`).
- **All children closed**: run the group architecture review below, then offer to open the group PR from `feature/<parent-id>-<slug>` to the base branch with the parent's `closing-reference`.

### Group architecture review (strong)

Before the group PR, follow `references/group-review.md`: a read-only strong-tier subagent reviews the whole feature (coherence against the architecture notes, duplication between children, missing or contradicted ADRs, glossary drift, feature-level docs), and its findings become new child tasks, follow-ups or ADRs, always with the user's OK.
