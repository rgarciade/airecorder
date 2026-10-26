---
name: flow-backlog
description: Backlog session that turns ideas into tasks in the project's tracker (GitHub Issues, GitLab, Jira, Linear, local files…) without writing any code. Creates one or several tasks (related or not), or breaks a bigger piece of work into a parent task with child tasks and blocking links. Use when the user runs /flow-backlog or wants to plan, create, split or organise tasks for later.
---

# flow-backlog

Paths starting with `../` are relative to this skill's folder: they point at sibling skills in the same skills directory.

Create well-formed tasks in the project's tracker. In this skill, "issue" and "task" mean the same thing: a task in the project's tracker. Every tracker operation written in backticks (`create-task`, `create-child`, `add-blocker`…) is looked up in the tracker file and done exactly as written there, including any alternative it records for what the tracker can't do. This skill never writes code, never creates branches and never commits. Developing a task is `flow-work`'s job, and it can happen much later.

Building the backlog is a conversation with the user: you propose, they decide. Nothing is published until they approve it. The tasks you create are meant to be developed **with the user** through `flow-work`, never picked up by an agent working alone. Where `to-tickets` talks about agent-ready or AFK tickets, read it as "ready to start with `flow-work`".

**Detail comes just in time.** An issue gives the big picture and the important leads, not a full functional or technical specification: things change between planning a task and building it. Describe what is wanted and why, the few outcomes that define "done", and what a preliminary look has found (libraries, connectors, APIs, constraints, risks). Leave the detailed criteria, design and test scenarios to `flow-work`'s plan phase, which works them out against the code as it is at that moment. Don't invent detail to make an issue look complete.

## 0. Preflight

1. Read `docs/agents/workflow.md`. If it does not exist, tell the user and ask, in one line, whether to run `flow-setup` now. If yes, read `../flow-setup/SKILL.md`, follow it, then come back here. If no, stop. If it exists but lacks a field this skill needs, ask only for that field.
2. Read the tracker file (`docs/agents/tracker.md`, or the shared path in `workflow.md`) for how to create tasks, children and blocking links, and for the tracker's id format and markup. If only an old `docs/agents/issue-tracker.md` exists, offer to run `flow-setup` to convert it. Read `docs/agents/domain.md` and the glossary it points to, if any, so task titles use the project's vocabulary.

## 1. Understand what the user wants

Ask until it is clear. For each question, propose the answer you think fits. Ask the questions that don't depend on each other together. If the agent has a question tool with selectable options (for example `AskUserQuestion` in Claude Code), use it: one selector per question, the proposed answer first, and the free-text option left open. Otherwise, use a numbered list, so the user can reply "OK" or correct only some by number. Ask a question alone first when its answer changes the next ones. Suggest the minimum: if something can be left out, say so.

Then decide which of these it is. If unsure, ask:

- **Separate tasks**: one or several issues, unrelated or loosely related. Go to step 2.
- **A breakdown**: one piece of work that needs several dependent tasks. Go to step 3.

**Preliminary research (optional).** When the work touches something unknown (a new library, an external service, an unfamiliar part of the code), offer a short research pass before drafting. If the user agrees, brief a read-only subagent (or do it yourself if the harness has none) to answer, in at most 15 lines: which libraries, connectors or APIs fit, what the code already has to build on, every part of the code where the behaviour being changed happens (found by searching for the operation itself, not only the obvious entry points), and the main risks or open questions. It gives direction, not decisions. Its findings go into each issue's "Preliminary notes" section.

## 2. Separate tasks

For each task, draft an issue with the template below. Show all drafts together as a numbered list (title plus one line each) and the full body of any the user wants to see. Iterate until the user approves, then create them with `create-task`.

Check every task against these rules before showing it:

- It does one thing. If the title needs "and", split it.
- It is a vertical slice: when done, someone can use or verify it end to end.
- It fits a single working session.

## 3. A breakdown

Read `../to-tickets/SKILL.md` and follow its process: gather context, explore the codebase if needed, draft tracer-bullet vertical slices with their blocking edges, quiz the user, publish in dependency order. These overrides apply:

- **Parent issue**: if the work does not have one yet, create a parent issue first that describes the whole feature. Create every child with `create-child`. The parent carries an **"Architecture notes"** section (template below): the global view the children build towards. Draft it with the user, reading the existing ADRs and glossary from `docs/agents/domain.md`; if it contradicts an ADR, say so and ask.
- **Blocking edges**: add them with `add-blocker`, in dependency order (blockers first), so each one can reference a real task id.
- **Tracker**: wherever `to-tickets` says "issue tracker", "GitHub" or `gh`, use the operations in the tracker file instead.
- **Labels**: apply only the labels listed in `docs/agents/workflow.md`. Do not apply `ready-for-agent` or any other label it does not list.
- **Body**: use the task template below. It extends to-tickets' template with "Out of scope".

## Task template

Write titles and bodies in the task language from `docs/agents/workflow.md`, in the tracker's markup. Translate the section headings into that language.

```markdown
## Parent

<parent ref> (omit the section if there is no parent)

## What to build

The big picture: the end-to-end behaviour this task makes work, from the user's point of view, and why it is wanted. Optionally one user-story line: "As <role>, I want <capability>, so that <benefit>."

## Acceptance criteria

- [ ] The few outcomes that define "done" (two to four). The plan phase refines them.

## Preliminary notes

Leads from planning or preliminary research: candidate libraries, connectors or APIs, related parts of the code, constraints, risks, open questions. Direction, not decisions. (Omit the section if there is nothing worth saying.)

## Out of scope

- What this task deliberately does not do (omit the section if nothing worth saying)

## Blocked by

- <ref>, or "None (can start immediately)". Omit when the blockers were set with `add-blocker` and the tracker shows them.
```

A **parent issue** uses the same template, without "Parent" and "Blocked by", and adds this section after "What to build":

```markdown
## Architecture notes

The global view of the feature, in a few lines: the main pieces and where they live, how data flows between them, the boundaries to respect, the decisions already taken (link the ADRs) and the ones still open. Direction for the children, not a design spec: each child's plan works out its own detail and may refine this.
```

No file paths or code snippets: they go stale. Naming a library, service or module in "Preliminary notes" is fine. Detailed criteria, design and test scenarios are decided later, in `flow-work`'s plan phase.

## 4. Close

List every task created, with its link (`task-url`), and say which ones can start now (no open blockers). End with the command to start the first one, for example `/flow-work <ref>`.
