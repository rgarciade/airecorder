# Task tracker

Example adapter for **GitHub Issues** with GitHub as the code host. `flow-setup` uses it as the starting point when a repo tracks its tasks on GitHub; for any other tracker it fills [tracker-template.md](tracker-template.md) instead.

How this repo's tasks are read, created and changed. `flow-backlog` and `flow-work` never call a tracker directly: they look up each operation here, so tasks and their records look the same every time. Edit this file to change how an operation is done.

- **Tracker**: GitHub Issues
- **Access**: GitHub CLI (`gh`) 2.94+, authenticated with `gh auth login`. Run inside the clone; `{owner}/{repo}` is filled in by `gh api`.
- **Code host**: GitHub

## Format

| Item | This tracker |
|---|---|
| Task id | `42` |
| Reference in text | `#42` |
| Id in branch names | `42` (as in `task/42-<slug>`) |
| Reference in commits | `#42` (as in `feat(#42): …`) |
| Markup | GitHub Markdown |
| Note block | `> [!NOTE]` followed by `> ` lines |
| Record marker | A hidden HTML comment on the first line: `<!-- flow:plan -->` or `<!-- flow:summary -->` |

## Operations

Operations marked **asks** always need the user's OK first.

| Operation | How | Notes |
|---|---|---|
| `view-task` | `gh issue view <id> --json number,title,body,labels,state,assignees,url` | |
| `get-parent` | `gh api repos/{owner}/{repo}/issues/<id>/parent --jq .number` | 404 means no parent |
| `list-children` | `gh api repos/{owner}/{repo}/issues/<id>/sub_issues --jq '.[] \| {number, title, state}'` | |
| `open-blockers` | `gh api repos/{owner}/{repo}/issues/<id>/dependencies/blocked_by --jq '.[] \| select(.state=="open") \| .number'` | `issue_dependencies_summary` on the issue gives the counts |
| `create-task` | `gh issue create --title "<title>" --body-file <file>` | add `--label` for the labels in `workflow.md` |
| `create-child` | `gh issue create --title "<title>" --body-file <file> --parent <parent-id>` | older `gh`: create it, then `gh issue edit <parent-id> --add-sub-issue <id>` |
| `add-blocker` | `gh api --method POST repos/{owner}/{repo}/issues/<id>/dependencies/blocked_by -F issue_id=<blocker database id>` | the database id is `gh api repos/{owner}/{repo}/issues/<blocker> --jq .id`, not the number |
| `create-record` | `gh issue comment <id> --body-file <file>` | prints the comment URL |
| `find-record` | `gh api --paginate repos/{owner}/{repo}/issues/<id>/comments --jq '.[] \| select(.body \| contains("<!-- flow:plan -->")) \| .id'` | use `flow:summary` for the closing record |
| `edit-record` | `gh api --method PATCH repos/{owner}/{repo}/issues/comments/<comment-id> -F body=@<file>` | **asks** |
| `edit-description` | `gh issue edit <id> --body-file <file>` | **asks** |
| `assign` | `gh issue edit <id> --add-assignee @me` | **asks** |
| `move-status` | see "Status" below | **asks** |
| `delete` (optional) | `gh api --method DELETE repos/{owner}/{repo}/issues/comments/<comment-id>` for a record; issues are closed, not deleted (`gh issue close <id>`) | **asks** |
| `create-branch` | `gh issue develop <id> --name <branch> --base <base> --checkout` | links the branch in the issue's "Development" panel; `<base>` must already exist on the remote, so push a new group branch first |
| `closing-reference` | `Closes #<id>` in the PR body | GitHub closes the issue when the PR merges into the default branch; for other targets, `move-status` to done after the merge |
| `open-pr` | `gh pr create --base <target> --title "<title>" --body-file <file>` | |
| `pr-status` | `gh pr list --head <branch> --state all --json number,state,baseRefName,mergedAt` | is the task's PR open, merged, and into which branch |
| `task-url` | `https://github.com/<owner>/<repo>/issues/<id>` | |

## Status

Choose one and delete the other:

- **Labels**: `gh issue edit <id> --remove-label "<old>" --add-label "<new>"`. States: in progress `<label>`, in review `<label>`; done is closing the issue (`gh issue close <id>`), usually automatic through the `closing-reference`.
- **GitHub Project**: `gh project item-edit --owner <owner> <project-number> --url <task-url> --field "<Status>" --value "<option>"` (add the issue first with `gh project item-add <project-number> --owner <owner> --url <task-url>` if needed). States: in progress `<option>`, in review `<option>`, done `<option>`.

## Alternatives in use

None: GitHub supports every operation.
