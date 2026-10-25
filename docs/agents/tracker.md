# Task tracker

How this repo's tasks are read, created and changed. `flow-backlog` and `flow-work` never call a tracker directly: they look up each operation here, so tasks and their records look the same every time. Edit this file to change how an operation is done.

- **Tracker**: GitHub Issues in `rgarciade/airecorder`
- **Access**: GitHub CLI (`gh`) 2.94+, run inside the clone; `{owner}/{repo}` is filled in by `gh api`.
  - The active `gh` account on this machine is a work account. **Every `gh` command here runs with the personal account's token**: prefix it with `GH_TOKEN=$(gh auth token -u rgarciade)`. Never switch the active `gh` account.
  - `git push` over the default SSH key fails for this repo (the key belongs to the work account). Push over HTTPS with the personal token: `git -c credential.helper= -c credential.helper='!f(){ echo username=rgarciade; echo "password=$(gh auth token -u rgarciade)"; }; f' push`.
- **Code host**: GitHub (pull requests live in the same repo)

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

Operations marked **asks** always need the user's OK first. All commands below are run with `GH_TOKEN=$(gh auth token -u rgarciade)` in front (see Access).

| Operation | How | Notes |
|---|---|---|
| `view-task` | `gh issue view <id> --json number,title,body,labels,state,assignees,url` | |
| `get-parent` | `gh api repos/{owner}/{repo}/issues/<id>/parent --jq .number` | 404 means no parent |
| `list-children` | `gh api repos/{owner}/{repo}/issues/<id>/sub_issues --jq '.[] \| {number, title, state}'` | |
| `open-blockers` | `gh api repos/{owner}/{repo}/issues/<id>/dependencies/blocked_by --jq '.[] \| select(.state=="open") \| .number'` | `issue_dependencies_summary` on the issue gives the counts |
| `create-task` | `gh issue create --title "<title>" --body-file <file>` | no fixed labels; add `--label bug` or `--label enhancement` as fits the task. Then add it to the Project (see Status) |
| `create-child` | `gh issue create --title "<title>" --body-file <file> --parent <parent-id>` | older `gh`: create it, then `gh issue edit <parent-id> --add-sub-issue <id>` |
| `add-blocker` | `gh api --method POST repos/{owner}/{repo}/issues/<id>/dependencies/blocked_by -F issue_id=<blocker database id>` | the database id is `gh api repos/{owner}/{repo}/issues/<blocker> --jq .id`, not the number |
| `create-record` | `gh issue comment <id> --body-file <file>` | prints the comment URL |
| `find-record` | `gh api --paginate repos/{owner}/{repo}/issues/<id>/comments --jq '.[] \| select(.body \| contains("<!-- flow:plan -->")) \| .id'` | use `flow:summary` for the closing record |
| `edit-record` | `gh api --method PATCH repos/{owner}/{repo}/issues/comments/<comment-id> -F body=@<file>` | **asks** |
| `edit-description` | `gh issue edit <id> --body-file <file>` | **asks** |
| `assign` | `gh issue edit <id> --add-assignee @me` | **asks** |
| `move-status` | see "Status" below | **asks** |
| `delete` (optional) | `gh api --method DELETE repos/{owner}/{repo}/issues/comments/<comment-id>` for a record; issues are closed, not deleted (`gh issue close <id>`) | **asks** |
| `create-branch` | `gh issue develop <id> --name <branch> --base <base> --checkout` | links the branch in the issue's "Development" panel; `<base>` must already exist on the remote, so push a new group branch first (over HTTPS, see Access) |
| `closing-reference` | `Closes #<id>` in the PR body | PRs target `dev`, not the default branch `main`, so GitHub does **not** auto-close the issue on merge: after the merge, `move-status` to done and `gh issue close <id>` |
| `open-pr` | `gh pr create --base <target> --title "<title>" --body-file <file>` | |
| `pr-status` | `gh pr list --head <branch> --state all --json number,state,baseRefName,mergedAt` | is the task's PR open, merged, and into which branch |
| `task-url` | `https://github.com/rgarciade/airecorder/issues/<id>` | |

## Status

**GitHub Project #4 "Airecorder proyect"** (owner `rgarciade`), field `Status`:

- Add the issue to the Project if it isn't there yet: `gh project item-add 4 --owner rgarciade --url <task-url>`
- Move it: `gh project item-edit --owner rgarciade 4 --url <task-url> --field "Status" --value "<option>"`
- States: in progress `In progress`, in review `In review`, done `Done`. (`To triage`, `Backlog`, `Ready` and `Deployed` are managed by hand.)

## Alternatives in use

None: GitHub supports every operation.
