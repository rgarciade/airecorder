# Task records

How `flow-work` keeps the task up to date, and the templates for its two records. Read from `SKILL.md` ("The task is the source of truth") before first writing to the task.

## Rules

Anyone must be able to understand the task from the tracker alone (plus its task folder, if the tracker uses that alternative), without the notes. Keep the task lean: **at most two records per task from this flow**, the plan record and the summary record. A record is a comment on the task, or a file in the task folder, depending on the tracker. When something changes, **edit** what exists instead of adding something new.

**Permissions:**

- **Creating** the plan record or the summary record needs no confirmation.
- **Editing** the description or a record, and **deleting** anything, always need the user's OK: show the exact change first and wait.

**The description holds the _what_**: what to build, acceptance criteria, out of scope. When the agreed requirements change, propose an edit of the description (never a new record) with:

- the requirements rewritten as they now stand, and
- at the bottom, a `## Changes` section (heading in the task language) with one dated line per change: what changed and why. Keep earlier lines.

Apply it with `edit-description` once the user approves.

**The plan record holds the _how_**: a short implementation summary, created with `create-record` at the end of Phase 4. Never create a second plan record: if the plan changes, find it with `find-record` (marker `flow:plan`) and propose an edit with `edit-record`.

**Keep both in step with the user's answers, as soon as they happen.** When an answer at any point after the OK on the plan (a test question, a choice about a review finding, a closing question, a remark in passing) drops, adds or changes something the plan record or the description states, propose the edit in the same message that acknowledges the answer, as one line: what stays out or changes, the plan record's new line under "Changes to the plan", and the description's `## Changes` line when a requirement changed. Don't wait for the end of implementation or for the user to ask. Apply it once they approve; if they say it is not worth recording, drop it.

**The summary record** is created once, when the PR is opened (Phase 8), with the marker `flow:summary`. If it already exists (for example, the PR was reopened), propose an edit instead. The same goes for answering the PR review (Phase 9): update it with an edit that asks, never a new record.

To link the description to the plan record, include `Implementation notes: <record link>` in the next description edit the user approves. Don't edit the description only to add this link.

Write both records in the task language from `docs/agents/workflow.md`, in the tracker's markup, with its note block and record marker; translate the headings and the note text too. The templates below are in GitHub Markdown; adapt them to the tracker's format.

## Templates

Plan record template (10 to 15 lines below the header). The task's readers are the team, not this skill: write it in plain words, without the skill's own vocabulary (see "Phase messages" in `SKILL.md`).

```markdown
<!-- flow:plan -->
> [!NOTE]
> **Implementation notes**: how this task is being built. The requirements are in the task description; flow-work updates these notes when the plan changes.
> Last update: <YYYY-MM-DD> · branch `<task branch>`

### What is tested, and where
- `<function, endpoint or screen the test calls>`: what it catches, in plain words

### Scenarios
1. <one line per scenario>

### Manual verification
- <step>: <what to observe> (only for parts agreed as untestable; omit otherwise)

### Steps
1. <implementation outline, no file-level detail>

### Docs
- <document to create or update>: <what changes> (or "none")

### Architecture decisions
- <decision>: <one line on why> (ADR candidate; omit the section if there are none)

### Changes to the plan
- <YYYY-MM-DD>: <what changed and why> (omit the section until something changes)
```

Summary record template:

```markdown
<!-- flow:summary -->
> [!NOTE]
> **Implementation summary**: what was built for this task. PR: <PR link>

- **Works now**: <one or two lines>
- **Acceptance criteria**: <n>/<n> ✅, as listed in the task description (list any ❌)
- **Manual verification**: <steps done and by whom, or none>
- **Deviations from the plan**: <none, or one line each>
- **Open review findings**: <none, or one line each>
- **Tests that failed before the task**: <none, or the list or count>
- **ADRs**: <ADR-NNNN title, or none>
- **Docs**: <documents created or updated, or none>
```
