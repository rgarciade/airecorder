# ADR template

Architecture Decision Records live where `docs/agents/domain.md` says (by default `docs/adr/`), one file per decision, numbered in order: `NNNN-<short-title>.md`, for example `0007-use-postgres-for-orders.md`. Take the next free number.

Write an ADR only for a decision that is **hard to reverse**, **affects more than one module**, or was **chosen between real alternatives**. Most tasks have none.

Keep it under a page. Write it in the language the repo's docs already use.

```markdown
# <NNNN>. <Decision, as a short statement>

- **Status**: accepted
- **Date**: <YYYY-MM-DD>
- **Task**: <ref>

## Context

What problem or force made a decision necessary. Two to five sentences.

## Decision

What was decided, stated plainly.

## Alternatives considered

- **<Alternative>**: why it was not chosen.

## Consequences

What becomes easier, what becomes harder, and what to watch for.
```

When a later decision replaces this one, set its status to `superseded by <NNNN>` and link the new ADR. Never delete an ADR.
