# Task tracker

How this repo's tasks are read, created and changed. `flow-backlog` and `flow-work` never call a tracker directly: they look up each operation here, so tasks and their records look the same every time. Edit this file to change how an operation is done.

- **Tracker**: `<GitHub Issues | GitLab | Jira | Linear | Azure Boards | local files | …>`
- **Access**: `<CLI, MCP server or API used, and how it authenticates>`
- **Code host** (where branches and pull requests live): `<GitHub | GitLab | Bitbucket | …>`

## Format

| Item | This tracker |
|---|---|
| Task id | `<e.g. 42, PROJ-123, ENG-7>` |
| Reference in text | `<e.g. #42, PROJ-123>` |
| Id in branch names | `<e.g. 42, PROJ-123>` (as in `task/<id>-<slug>`) |
| Reference in commits | `<e.g. #42, PROJ-123>` (as in `feat(<commit-ref>): …`) |
| Markup | `<Markdown | Jira wiki markup | plain text>` |
| Note block | `<how to render the "these are implementation notes" box, e.g. "> [!NOTE]", "{info}…{info}", or a bold first line>` |
| Record marker | `<how a flow record is tagged so it can be found again, e.g. "<!-- flow:plan -->", or a visible first line "[flow:plan]">` |

## Operations

`flow-backlog` and `flow-work` use these names. Each row says how to do it here, or which alternative from the next section is used. Operations marked **asks** always need the user's OK first.

| Operation | How | Notes |
|---|---|---|
| `view-task` | `<command>` | title, description, status, labels |
| `get-parent` | `<command, or alternative>` | |
| `list-children` | `<command, or alternative>` | |
| `open-blockers` | `<command, or alternative>` | tasks that block this one and are still open |
| `create-task` | `<command>` | title and description |
| `create-child` | `<command, or alternative>` | a task under a parent |
| `add-blocker` | `<command, or alternative>` | "<id> is blocked by <id>" |
| `create-record` | `<command, or alternative>` | a flow record (plan or summary) attached to the task; returns its id or link |
| `find-record` | `<command, or alternative>` | find a flow record by its marker |
| `edit-record` | `<command, or alternative>` | **asks** |
| `edit-description` | `<command, or alternative>` | **asks** |
| `assign` | `<command, or "not used">` | **asks** |
| `move-status` | `<command, or "not used">` with states: in progress `<…>`, in review `<…>`, done `<…>` | **asks**; in trackers with workflows (Jira, Azure Boards) record the transition names, not only the state names |
| `delete` (optional) | `<command>` | **asks**; flow almost never needs it |
| `create-branch` | `<command that creates a branch linked to the task, or the naming convention that links it>` | |
| `closing-reference` | `<text that closes or moves the task when the PR merges, e.g. "Closes #42", "Fixes PROJ-123", or "none: move-status after merge">` | |
| `open-pr` | `<command on the code host>` | if tasks and code live in different systems, this is the code host's command; with no code host, `none` and the user merges locally |
| `pr-status` | `<command on the code host>` | is the task's PR open, merged, and into which branch |
| `task-url` | `<URL pattern for a task>` | |

## Alternatives for what the tracker can't do

When the tracker has no way to do an operation, use the alternative agreed here. Pick only what this repo needs.

| Missing in the tracker | Alternative |
|---|---|
| Comments, or editing them (`create-record`, `find-record`, `edit-record`) | **Task folder in the repo**: `<records folder, default .flow/tasks>/<id>/plan.md` and `summary.md`, committed with the work. Link the folder from the task description once (`<task folder URL on the code host>`). |
| Hidden markers | A visible first line, e.g. `[flow:plan]`. |
| Note blocks | A bold first line: "**Implementation notes, not requirements.**" |
| Parent and child tasks | A "Parent: <ref>" line at the top of the child's description, and a "Tasks:" list in the parent's. Or a shared label or epic, if the tracker has one. |
| Dependencies | A "Blocked by: <ref>, <ref>" line at the top of the description. A task is unblocked when every task listed is done. |
| Status | Labels, if available; otherwise `not used`, and the plan record states the current phase. |
| Linking a branch to the task | The task id in the branch name (`task/<id>-<slug>`); the plan record names the branch. |
| Closing on merge | `move-status` to done after the user says the PR is merged (**asks**). |
| Editing the description | Keep requirement changes in the task folder (`<id>/changes.md`) and link it from the task once. |
| A tracker at all (local files) | **Files in the repo**: one folder per task, `<records folder>/<id>/task.md` with a header (`Title:`, `Status:`, `Parent:`, `Blocked by:`), the description below it, and `plan.md` / `summary.md` next to it. `view-task` reads `task.md`, `list-children` lists the tasks whose `Parent:` is this one, `move-status` edits `Status:`. Ids are numbers in order (`001`, `002`…). |
| Any automated access at all | **Manual mode**: for each operation, give the user the exact text to paste and where, and wait for them to confirm it is done. |
