# Skill Registry — AIRecorder
_Generated: 2026-04-14_

## Project Conventions

| File | Role |
|------|------|
| `AGENTS.md` (= `CLAUDE.md` symlink) | Reglas para agentes: idioma, commits, matriz de mantenimiento de docs |
| `electron/README.md` | Main process Electron: IPC handlers, SQLite, audio, OAuth |
| `src/services/ai/README.md` | Proveedores de IA, prompts, protocolo de chat, timestamps |
| `README.md` | Raíz: pipeline de audio Python, Whisper, estructura del proyecto |

**Reglas clave de AGENTS.md:**
- Responder SIEMPRE en español
- NUNCA crear commits de git de forma autónoma
- Evitar archivos monolíticos — dividir por módulos de contexto
- Actualización obligatoria de docs: modificar código → actualizar su README correspondiente

---

## Available Skills

### Project-level skills (`/.agents/skills/`)

| Skill | Trigger |
|-------|---------|
| `electron` | Electron main/renderer/IPC, gestión de ventanas, APIs de escritorio |

### User-level skills (`~/.config/opencode/skills/`)

| Skill | Trigger |
|-------|---------|
| `sdd-init` | Inicializar contexto SDD, "sdd init", "iniciar sdd" |
| `sdd-propose` | Crear propuesta de cambio, "sdd propose", "nuevo cambio" |
| `sdd-explore` | Explorar/investigar features antes de comprometerse |
| `sdd-spec` | Escribir especificaciones con Given/When/Then |
| `sdd-design` | Documento de diseño técnico |
| `sdd-tasks` | Desglosar un cambio en checklist de tareas |
| `sdd-apply` | Implementar tareas de un cambio |
| `sdd-verify` | Validar implementación contra specs |
| `sdd-archive` | Archivar un cambio completado |
| `sdd-onboard` | Guía completa del flujo SDD |
| `branch-pr` | Crear pull requests |
| `issue-creation` | Crear issues de GitHub |
| `go-testing` | Tests en Go, Bubbletea TUI |
| `judgment-day` | Revisión adversarial dual |
| `skill-creator` | Crear nuevas skills de agentes de IA |
| `skill-registry` | Actualizar registro de skills |

### User-level skills (`~/.agents/skills/`)

| Skill | Trigger |
|-------|---------|
| `electron` | Guía del framework Electron |
| `vue-best-practices` | Vue 3 / Composition API / Pinia |
| `accessibility-compliance` | WCAG 2.2, ARIA, lectores de pantalla |
| `contrast-checker` | Análisis de contraste de color WCAG |
| `figma` | Figma MCP, diseño-a-código |
| `find-skills` | Descubrir skills instalables |
| `skill-creator` | Crear nuevas skills de agentes |
| `azure-*` (múltiples) | Servicios cloud de Azure |
| `microsoft-foundry` | Agentes Foundry end-to-end |

### Project custom skills (`~/.claude/skills/`)

| Skill | Trigger |
|-------|---------|
| `create-version` | Crear nueva versión de AIRecorder |
| `release-notes` | Generar y publicar notas de versión |

---

## Notes

- **Sin test runner** — Strict TDD Mode no disponible
- **Linter**: ESLint 8 con `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
  - ⚠️ Usa flat config (`eslint.config.js`) — correr con `npx eslint .` NO con `npm run lint` (el script tiene flag `--ext` incompatible)
- **Sin formatter** (no Prettier en devDependencies)
- **Bundler**: Vite 5 con `@vitejs/plugin-react`
- **Persistencia SDD**: engram (modo engram, sin directorio `openspec/`)
