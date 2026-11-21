# Base branch drift

Read from `SKILL.md` (Phase 8, before opening the PR) and from `references/pr-review.md` (before pushing fixes, if the PR has been open for a while).

The target branch (the group branch for a child task, the base branch for a standalone task) may have moved since the task branch was created. Check before the PR, so the PR does not open with conflicts or code tested against an old base.

1. Run `git fetch origin`, then `git rev-list --count HEAD..origin/<target>`. At `0`, say nothing and go on.
2. Above `0`, tell the user how many commits the target has that the task branch lacks, and propose merging them in with the exact command, which runs only with the user's OK:

   ```sh
   git merge origin/<target>
   ```

3. **Never rebase.** The branch is already pushed, so a rebase would need a force push, which this flow never does.
4. **On conflicts**, stop and show the conflicting files. Resolving them is the user's decision. You may propose a resolution for each file, but never touch a test file this way: a test that must change goes through `references/approved-test-change.md`.
5. **After the merge**, re-run the Phase 6 checks: the full suite (no new failures beyond `failing before`), the typecheck and the frozen-tests diff. If a new failure appears, it is a finding to show, not something to fix silently.
6. Give the push command (`git push`). In autonomous mode this always stops for the user: the merge changes shared state.
