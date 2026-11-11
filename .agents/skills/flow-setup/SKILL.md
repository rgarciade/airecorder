---
name: flow-setup
description: Configure the current repo for the flow skills (flow-backlog, flow-work). Asks which task tracker the project uses (GitHub Issues, GitLab, Jira, Linear, local files or any other) and records how to do every task operation in docs/agents/tracker.md, then writes docs/agents/workflow.md with the base branch, branch naming, languages, models and test commands. Use when the user runs /flow-setup, or when flow-backlog or flow-work find docs/agents/workflow.md missing and the user agrees to run it.
---

# flow-setup

Paths starting with `../` are relative to this skill's folder: they point at sibling skills in the same skills directory.

One-time, per-repo configuration for the flow skills. It writes the files that `flow-backlog` and `flow-work` read, so those skills stay generic and each repo keeps its own rules.

Output files (all inside the repo, unless the user chooses a shared tracker file):

- `docs/agents/tracker.md`: how this repo's tasks are read, created, changed and linked, operation by operation (template: [tracker-template.md](tracker-template.md); GitHub example: [tracker-github.md](tracker-github.md))
- `docs/agents/domain.md`: where the glossary and ADRs live, and how to use them
- `docs/agents/workflow.md`: our flow settings (template: [workflow-template.md](workflow-template.md))
- an `## Agent skills` block in the repo's `CLAUDE.md` or `AGENTS.md`, pointing at those files

Never commit. When the files are written, give the user the exact `git add` / `git commit` command and stop.

## 1. Explore (no questions yet)

Read, don't assume:

- `git remote -v`: which code host (GitHub, GitLab, Bitbucket, Azure DevOps…)?
- Branches: `git branch -a`. Which of `dev`, `develop`, `main`, `master` exist?
- `CLAUDE.md` and `AGENTS.md` at the root. If one is a symlink to the other, the real file is the one to edit.
- `docs/agents/`: does any of it exist already? If `workflow.md` exists, this is an update: only ask about fields that are missing or that the user wants to change. If the user started `flow-setup` to change the harnesses or models, go straight to "Harnesses and models" below and touch nothing else. An old `issue-tracker.md` from a previous setup is replaced by `tracker.md`.
- Signs of the task tracker: task ids in recent commits and branch names (`#42`, `PROJ-123`), links in `README.md` or `CONTRIBUTING.md`, a `.jira.d/` or similar config, and which tracker CLIs or MCP servers are available (`gh`, `glab`, `jira`, `az boards`, a Jira or Linear MCP server…).
- Test and typecheck commands: `package.json` scripts, `Makefile`, `pyproject.toml`, `deno.json`, CI workflows.
- Where tests live (folders and file name patterns), so a glob can match every test file.
- The language of recent tasks and PRs, through whatever access you found.
- Agent managers: is a tool that launches other harnesses installed (the `orca` CLI, or Herdr's `hc`), and which harnesses does it offer?

## 2. The task tracker

This is the heart of the setup: `flow-backlog` and `flow-work` never call a tracker directly, they look up each operation in `docs/agents/tracker.md`.

1. **Ask which tracker the project uses**, recommending what exploration found (GitHub Issues when the code host is GitHub and nothing else shows up). Also ask where pull requests live, if it differs from the tracker (for example Jira tasks with GitHub PRs).
2. **Start from a template.** For GitHub Issues, start from [tracker-github.md](tracker-github.md) and only confirm the details (status labels or project, labels). For anything else, fill [tracker-template.md](tracker-template.md).
3. **Fill every operation.** For each row, find how it is done with the access available: its CLI (`glab`, `jira`, `az`…), an MCP server, or its REST API with a token from an environment variable (never write a token into the file). Check each read operation for real against an existing task when possible; never try a write operation during setup. Ask the user when you can't tell, batching the questions that don't depend on each other.
4. **Offer alternatives for what is missing.** When the tracker can't do an operation (no comments, no editing, no parent links, no dependencies, no status, no branch links, no auto-close), propose the matching alternative from the template's "Alternatives" table, recommending one, and record the choice. The usual one is the **task folder in the repo**: `.flow/tasks/<id>/` with `plan.md` and `summary.md`, committed with the work and linked from the task once. If there is no automated access at all, propose **manual mode**: the agent writes the exact text and the user pastes it.
5. **Format.** Record the task id format, how tasks are referenced in text, the markup the tracker uses, and how the note block and record marker are rendered there.
6. **Where the file lives.** By default `docs/agents/tracker.md` in the repo. If several repos share one tracker (for example a company Jira), offer to keep the file in a shared place and write its path in `workflow.md` instead.

## 3. Domain docs

Read `../setup-matt-pocock-skills/SKILL.md` and apply only its **Section C** (domain docs), using its `domain.md` seed template. Its Section A (issue tracker) is replaced by step 2 above, and Section B (triage labels) is skipped. Default: single-context. Do not create `GLOSSARY.md` or ADRs.

## 4. Our questions

Ask these questions following [asking-questions.md](asking-questions.md) (read it first): the independent ones in a single round, leading each with the value you detected as the recommended answer. Skip any question that exploration already settled beyond doubt, and say what you assumed.

Say in one line what each setting is for when its name does not explain it (harnesses and models, Engram sync, test file globs): the user may be seeing these for the first time.

1. Base branch: the branch every finished feature ends up in (for example `dev`).
2. Branch naming for groups and tasks. Default: `feature/<id>-<slug>` for a group branch (a parent task) and `task/<id>-<slug>` for a task branch, with `<id>` as the tracker's "id in branch names".
3. Language of tasks and PR titles and bodies. Default: the language the repo already uses.
4. Commands: full test suite, a single test file, typecheck, lint. Mark any that don't exist as `none`.
5. Test file glob(s): the patterns that match every test file (used to check that implementation never edits approved tests).
6. Labels to apply when creating tasks, if the tracker has labels. Default: none.
7. Engram sync: share this project's Engram memory through git in `.engram/`. `ask` (default) asks before each export, `always` exports before every PR, `never` turns it off. Propose `never` if the Engram CLI is not installed.
8. Status: which states `move-status` uses (in progress, in review, done) and how, recorded in `tracker.md`. `not used` if the user doesn't want status moves.
9. Docs: the folder for the project's own documentation (default `docs/`, or an existing one you found) and whether `AGENTS.md`, `CLAUDE.md` or `CONTRIBUTING.md` already says which documents to update when code changes. If it does, record where; those rules win. `none` turns the docs step off. If the docs folder already exists, propose adding its reading guide: a `README.md` from [docs-readme-template.md](docs-readme-template.md), or its note merged into an existing index, with the "Contents" list filled from the documents already there. If the folder does not exist yet, don't create it: `flow-work` does so with the first document.
10. Harnesses and models: see the next section. Ask it after the questions above, as its own round.

## Harnesses and models

Used on a first setup, and on its own when the user runs `flow-setup` to change who does the work or which models they use. It fills the **Harnesses** section of `workflow.md`: the working mode, the harnesses the user has with their models, and who takes each role. Read [asking-questions.md](asking-questions.md) first. On a change, read the current section and start from its values.

Ask in three short rounds, each depending on the one before:

1. **Working mode and harnesses.** The mode every task starts in: `semi-autonomous` (default) stops at every phase and shows only the tests where something had to be decided; `pair` shows every test; `autonomous` chains the phases for small tasks and stops only for what really needs the user. And which harnesses the user has a subscription for and wants to use (for example Claude Code, OpenCode, Codex), each as `subagent` (a subagent of the harness running the flow) or `<manager>:<harness>` (for example `orca:opencode`, `herdr:claude`) when exploration found an agent manager. Without a manager, only the harness running the flow is offered; say so.
2. **Models of each harness**, one row per harness: the strong model (for the roles that need judgement: plan, tests), the fast model (for research, implementation, fixes and review), an optional deep model that replaces the strong one only for a task `flow-work` judges very complex and the user approves, and an effort level if that harness has one. Propose the usual models of each harness as the answer, and ask rather than assume: model names change. Defaults for Claude Code: strong and fast `sonnet`, deep `opus`. In another harness, propose its equivalents or `inherit`.
3. **Who takes each role** (research, plan, tests, implement, fix, review): an ordered list of harnesses, the first choice and a fallback for when it has no quota left. Recommend the strongest harness for plan and tests, the cheaper one for the rest, and a different harness for review as a second opinion.

Say, once, that the orchestrator is the session the user opens, so it is not set here, and that the split is fixed by role: nothing balances usage across subscriptions on its own. When there is no agent manager, record the one harness running the flow and the same list for every role.

When the user ran `flow-setup` only to change the harnesses or models, their answers to the three rounds are the confirmation: write the section and show it before and after in the same message, with no further stop to ask for approval. Nothing is committed, so the diff is the review. Write only that section of `workflow.md` and leave `tracker.md`, `domain.md` and the docs `README.md` untouched. The one exception is the `## Agent skills` block (see step 5): if its text differs from the block in this skill's template (for example a repo set up with 0.1 that still says "model tiers" instead of "harnesses and models, working mode"), update it in place in the same step and show it too. Never create the other instructions file. Then give the commit command.

## 5. Draft, confirm, write

Show the user a draft of every file you will write or edit, including the `## Agent skills` block. Let them edit it. Then write. (When the user ran `flow-setup` only to change the harnesses or models, skip this confirmation: see "Harnesses and models".)

- `docs/agents/tracker.md` (or the shared path the user chose)
- `docs/agents/domain.md` (from Matt's template)
- `docs/agents/workflow.md` (from [workflow-template.md](workflow-template.md))
- `<docs folder>/README.md` (from [docs-readme-template.md](docs-readme-template.md)), only if the docs folder already exists and the user agreed
- The `## Agent skills` block, following the file-selection rules in Matt's setup (edit the existing `CLAUDE.md` or `AGENTS.md`; never create the other one; update an existing block in place). When neither exists, recommend `AGENTS.md`: OpenCode, Codex and Cursor read it, and Claude Code loads it when the project has no `CLAUDE.md`. The block:

```markdown
## Agent skills

### Task tracker

[Tracker name, and the code host if different]. How every task operation is done: see `docs/agents/tracker.md`.

### Domain docs

[single-context or multi-context]. See `docs/agents/domain.md`.

### Workflow

Branches, base branch, languages, harnesses and models, working mode, test commands, Engram sync and docs for the flow skills. See `docs/agents/workflow.md`.
```

If the user chose the task folder alternative, make sure `.flow/` is **not** git-ignored: those records are part of the repo.

## 6. Done

Tell the user which files were written, then give the commit command, for example:

```sh
git add docs/agents AGENTS.md && git commit -m "docs: configure agent workflow"
```

Do not run it. If `flow-setup` was started from `flow-backlog` or `flow-work`, go back to that skill and continue where it stopped.
