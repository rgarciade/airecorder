# Group architecture review

Run before opening a group PR, when every child of a parent task is done. Read from `SKILL.md` ("After the merge").

Before the group PR, brief a read-only subagent (strong tier) with the parent issue and its "Architecture notes", its children and their plan records, the ADRs and glossary, and the whole group diff (`git diff <base branch>...feature/<parent-id>-<slug>`). It saves under `flow/<repo>/<parent-id>/architecture-review` and returns, in at most 15 lines:

- whether the feature holds together as a whole, against the parent's "Architecture notes";
- duplication or inconsistencies between children (two helpers doing the same thing, different names for one concept, diverging patterns);
- decisions that were made but have no ADR, and code that contradicts an ADR;
- glossary drift;
- whether the feature as a whole is documented: an overview that no single child writes (what the feature does, its main pieces, how to use it). If it is missing or stale, propose it as a document to write on the group branch, with the user's OK and a `docs(<parent commit-ref>)` commit.

Show it to the user. For each finding they want addressed, propose either a new child issue under the parent (through `flow-backlog`'s template, developed with `flow-work` before the group PR) or a follow-up issue for later. Missing ADRs can be written directly on the group branch, with the user's OK and a `docs(<parent commit-ref>)` commit. If the user changed the architecture along the way, propose updating the parent's "Architecture notes" (an edit, so it asks).
