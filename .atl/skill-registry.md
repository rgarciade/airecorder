# Skill Registry — AIRecorder
_Generated: 2026-04-13_

## Project Conventions

| File | Role |
|------|------|
| `AGENTS.md` (= `CLAUDE.md` symlink) | Agent rules: language, commit policy, doc maintenance matrix |
| `electron/README.md` | Electron main process: IPC handlers, SQLite, audio, OAuth |
| `src/services/ai/README.md` | AI providers, prompts, chat protocol, timestamps |
| `README.md` | Root: Python audio pipeline, Whisper, project structure |

**Key rules from AGENTS.md:**
- Respond always in Spanish
- NEVER create git commits autonomously
- Avoid monolithic files — split by context modules
- Mandatory doc updates: modify code → update its README

---

## Available Skills

### Project-level skills (`/.agents/skills/`)

| Skill | Trigger |
|-------|---------|
| `electron` | Electron main/renderer/IPC, window management, desktop app, Electron-specific APIs |

### User-level skills (`~/.config/opencode/skills/`)

| Skill | Trigger |
|-------|---------|
| `sdd-init` | Initialize SDD context, "sdd init", "iniciar sdd" |
| `sdd-propose` | Create change proposal, "sdd propose", "new change" |
| `sdd-explore` | Explore/investigate features before committing |
| `sdd-spec` | Write specifications with Given/When/Then |
| `sdd-design` | Technical design document |
| `sdd-tasks` | Break down change into task checklist |
| `sdd-apply` | Implement tasks from a change |
| `sdd-verify` | Validate implementation against specs |
| `sdd-archive` | Archive completed change |
| `sdd-onboard` | Guided SDD walkthrough |
| `branch-pr` | Create pull requests |
| `issue-creation` | Create GitHub issues |
| `go-testing` | Go tests, Bubbletea TUI |
| `judgment-day` | Adversarial dual review |
| `skill-creator` | Create new AI agent skills |
| `skill-registry` | Update skill registry |

### User-level skills (`~/.agents/skills/`)

| Skill | Trigger |
|-------|---------|
| `electron` | Electron framework guidance |
| `vue-best-practices` | Vue 3 / Composition API / Pinia |
| `accessibility-compliance` | WCAG 2.2, ARIA, screen readers |
| `contrast-checker` | WCAG color contrast analysis |
| `figma` | Figma MCP, design-to-code |
| `find-skills` | Discover installable skills |
| `skill-creator` | New agent skill creation |
| `azure-*` (multiple) | Azure cloud services |
| `microsoft-foundry` | Foundry agents end-to-end |

### Project custom skills (`~/.claude/skills/`)

| Skill | Trigger |
|-------|---------|
| `create-version` | Create new AIRecorder release version |
| `release-notes` | Generate and publish release notes |

---

## Notes

- No test runner detected — strict TDD mode unavailable
- Linter: ESLint 8 with `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- No formatter configured (no Prettier in devDependencies)
- Bundler: Vite 5 with `@vitejs/plugin-react`
