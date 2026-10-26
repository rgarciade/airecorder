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
- `docs/agents/`: does any of it exist already? If `workflow.md` exists, this is an update: only ask about fields that are missing or that the user wants to change. An old `issue-tracker.md` from a previous setup is replaced by `tracker.md`.
- Signs of the task tracker: task ids in recent commits and branch names (`#42`, `PROJ-123`), links in `README.md` or `CONTRIBUTING.md`, a `.jira.d/` or similar config, and which tracker CLIs or MCP servers are available (`gh`, `glab`, `jira`, `az boards`, a Jira or Linear MCP server…).
- Test and typecheck commands: `package.json` scripts, `Makefile`, `pyproject.toml`, `deno.json`, CI workflows.
- Where tests live (folders and file name patterns), so a glob can match every test file.
- The language of recent tasks and PRs, through whatever access you found.

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

Ask the questions that don't depend on each other together, leading each with the value you detected as the recommended answer. If the agent has a question tool with selectable options (for example `AskUserQuestion` in Claude Code), use it: one selector per question, the recommended answer first, and the free-text option left open. Otherwise, use a numbered list, so the user can reply "OK" or correct only some by number. Ask a question alone first when its answer changes the next ones. Skip any question that exploration already settled beyond doubt, and say what you assumed.

1. Base branch: the branch every finished feature ends up in (for example `dev`).
2. Branch naming for groups and tasks. Default: `feature/<id>-<slug>` for a group branch (a parent task) and `task/<id>-<slug>` for a task branch, with `<id>` as the tracker's "id in branch names".
3. Language of tasks and PR titles and bodies. Default: the language the repo already uses.
4. Commands: full test suite, a single test file, typecheck, lint. Mark any that don't exist as `none`.
5. Test file glob(s): the patterns that match every test file (used to check that implementation never edits approved tests).
6. Labels to apply when creating tasks, if the tracker has labels. Default: none.
7. Models for the two profiles, each mapping the tiers **strong** (plan, tests) and **fast** (research, implement, review, fix). **standard** runs every task; **deep** is used only when `flow-work` judges a task very complex and the user agrees. Default in Claude Code: standard `sonnet` for both tiers, deep `strong: opus`, `fast: sonnet`. In another harness, propose its equivalents in the names it accepts, or `inherit`.
8. Engram sync: share this project's Engram memory through git in `.engram/`. `ask` (default) asks before each export, `always` exports before every PR, `never` turns it off. Propose `never` if the Engram CLI is not installed.
9. Status: which states `move-status` uses (in progress, in review, done) and how, recorded in `tracker.md`. `not used` if the user doesn't want status moves.
10. Docs: the folder for the project's own documentation (default `docs/`, or an existing one you found) and whether `AGENTS.md`, `CLAUDE.md` or `CONTRIBUTING.md` already says which documents to update when code changes. If it does, record where; those rules win. `none` turns the docs step off. If the docs folder already exists, propose adding its reading guide: a `README.md` from [docs-readme-template.md](docs-readme-template.md), or its note merged into an existing index, with the "Contents" list filled from the documents already there. If the folder does not exist yet, don't create it: `flow-work` does so with the first document.

## 5. Draft, confirm, write

Show the user a draft of every file you will write or edit, including the `## Agent skills` block. Let them edit it. Then write:

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

Branches, base branch, languages, model profiles, test commands, Engram sync and docs for the flow skills. See `docs/agents/workflow.md`.
```

If the user chose the task folder alternative, make sure `.flow/` is **not** git-ignored: those records are part of the repo.

## 6. Done

Tell the user which files were written, then give the commit command, for example:

```sh
git add docs/agents AGENTS.md && git commit -m "docs: configure agent workflow"
```

Do not run it. If `flow-setup` was started from `flow-backlog` or `flow-work`, go back to that skill and continue where it stopped.
