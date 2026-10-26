# Record templates

Templates for the two records `flow-work` keeps on a task, read from `SKILL.md` ("The task is the source of truth"). They are in GitHub Markdown: adapt them to the tracker's markup, note block and record marker, and write them in the task language.

Plan record template (10 to 15 lines below the header):

```markdown
<!-- flow:plan -->
> [!NOTE]
> **Implementation notes**: how this task is being built. The requirements are in the task description; flow-work updates these notes when the plan changes.
> Last update: <YYYY-MM-DD> · branch `<task branch>`

### Seams under test
- `<public interface>`: what it catches

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
- **ADRs**: <ADR-NNNN title, or none>
- **Docs**: <documents created or updated, or none>
```
