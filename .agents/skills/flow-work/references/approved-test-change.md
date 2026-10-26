# Changing an approved test

The only way an approved test may change. Read from `SKILL.md` whenever a subagent or the user suspects an approved test is wrong, in pair and autonomous mode alike.

Sometimes implementation shows that an approved test was wrong: the requirement was misread, a library behaves differently than assumed, or the seam was badly chosen. That is legitimate. Changing a test because it is inconvenient for the code is not. Approved tests change only through this procedure, in pair and autonomous mode alike:

1. **Detect.** The subagent that hits the problem stops without touching the test, and returns: which test (`path:line`), why it believes the test is wrong, the evidence (the code, the library docs, or the requirement that contradicts it), and the change it proposes.
2. **The user decides.** Show it in a few lines with your recommendation, and say which case it is: the test was wrong, or the requirement changed. If the honest answer is "the test is right and the code is hard", say so and recommend keeping the test.
3. **Change.** After the user's OK, brief the tests subagent (strong tier) to change **only** those tests. Each must again fail for the expected reason, or pass if the implementation already covers it. Never loosen an assertion only to make it pass.
4. **Record.**
   - Give the commit command `git add <test files> && git commit -m "test(<commit-ref>): adjust <what> (<why>)" && git push`. Once the user confirms it, that commit becomes the new approved-tests reference for the checks; save its hash in the tests note. With the `.scratch` record instead, refresh the manifest.
   - Propose a line under "Changes to the plan" in the plan record (an edit, so it needs the user's OK).
   - If a requirement changed, also propose the `## Changes` line in the issue description.
5. **Continue** implementing against the new tests.
