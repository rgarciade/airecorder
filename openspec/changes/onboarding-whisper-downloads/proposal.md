# Proposal: Gestión explícita de descargas de modelos Whisper (issue #149)

## Intent

Hoy la primera transcripción descarga el modelo Whisper de forma implícita dentro de `WhisperModel(...)` (`python/audio_sync_analyzer.py:106-123`), sin que el usuario sepa qué se descarga, cuánto pesa ni si tiene espacio. El fallo por disco se detecta **reactivamente**, parseando un warning de stderr cuando la descarga ya falló (`transcriptionManager.js:340-367`). Resultado: fallos opacos y abandono en el onboarding. Convertimos la descarga en explícita, visible y gestionable.

## Scope

### In Scope

- **Inventario de modelos**: catálogo versionado (`tiny/base/small/medium/large-v3`) con tamaño, estado y espacio ocupado; caché HF fijada por la app (hoy no controlada).
- **Descarga explícita**: script Python dedicado con `huggingface_hub.snapshot_download` + progreso; validación **preventiva** de espacio (total a descargar / libre / restante estimado); cancelar y reintentar.
- **Paso de onboarding independiente** "Modelo de transcripción" (`small` preseleccionado), no bloqueante: se puede terminar sin descargar.
- **Ajustes → Transcripción → "Modelos y descargas"**: estado por modelo, descargar/reintentar/borrar con confirmación. Guardia de borrado: bloqueado si es el `whisperModel` default **o** tiene tareas `pending`/`processing`. Incluye `DiskSpaceIndicator`: componente **reutilizable** (libre/total del volumen de la caché) ubicado encima de la lista de modelos, que refresca el dato en cada montaje — pensado para reusarse en otros puntos de la app más adelante.
- **Bocadillo global** persistente (inferior izquierda) con progreso y cola; cerrar no cancela; click abre Ajustes. Soporta **contraído/expandido**: contraído muestra info mínima (nombre del recurso + %); expandido muestra el detalle de cola. Se ubica debajo de `RecordingOverlay` cuando ambos están visibles a la vez (no se ocultan mutuamente).
- **Selectores solo-instalados** (nunca disparan descarga) en los **4** puntos existentes. Sin modelo instalado, la acción de transcribir queda bloqueada con CTA directo a Ajustes → Modelos y descargas (no se encola para fallar después).

### Out of Scope

- Empaquetar modelos en el DMG; descargar todo o diarización automáticamente; cambio de modelo automático sin confirmación; descargar desde el selector.
- Modelos `.en`, cuantizaciones alternativas, recursos no-Whisper (aunque el inventario se diseña extensible).
- Refactor completo del wizard monolítico `Onboarding.jsx` (solo se extrae el estado nuevo a un hook propio).

## Capabilities

### New Capabilities

- `whisper-model-inventory`: catálogo versionado, estado por modelo, caché controlada, espacio en disco; única fuente para todos los selectores.
- `whisper-model-downloads`: cola de descargas explícita, progreso, cancelación, reintento, borrado con guardia.
- `onboarding-model-selection`: paso propio del wizard, no bloqueante, persiste el default.
- `download-status-indicator`: indicador global persistente entre vistas.

### Modified Capabilities

- Ninguna (`openspec/specs/` está vacío).

## Approach

**Enfoque 1 de la exploración, confirmado**: Node orquesta, Python ejecuta.

- **Python**: script nuevo dedicado a descargas (separado de `audio_sync_analyzer.py`) que llama `snapshot_download` y emite `PROGRESS:`/`DONE`/`ERROR` por stdout. `audio_sync_analyzer.py` pasa a `local_files_only=True` y elimina el default hardcodeado `"large"` (fallback silencioso de 3 GB).
- **Node**: `resourceManager` nuevo en `electron/services/` con inventario, cola serie, chequeo de espacio y broadcast de progreso.
- **IPC**: canal nuevo `resources:*` (estilo `ai:codex-login-progress`, con unsubscribe explícito), aislado de `queue-update`.
- **Renderer**: hook `useDownloadManager` montado en `App.jsx` (patrón `useQueueManager`), alimentando el bocadillo y la sección de Ajustes.

### Partición recomendada

Toca Python + Electron main + IPC + 4 áreas de UI: excede el presupuesto de 400 líneas. Recomendación para `sdd-tasks` (confirmar con forecast):

| PR | Contenido | Depende de |
|----|-----------|------------|
| 1 | Núcleo: Python download + `resourceManager` + IPC + inventario + espacio + catálogo versionado | — |
| 2 | Ajustes → Modelos y descargas + guardia de borrado | 1 |
| 3 | Paso de onboarding | 1 |
| 4 | Bocadillo global + hardening de los 4 selectores | 1, 2 |

## Decisiones de producto resueltas (ronda de preguntas post-proposal)

| Decisión | Resolución |
|----------|------------|
| Transcribir sin modelo instalado | Bloquear la acción con CTA directo a Ajustes → Modelos y descargas; no se encola para fallar después |
| Modelos ya en caché HF del SO (usuarios existentes) | Adoptar: al iniciar, detectar y registrar como "instalados" en el inventario nuevo, sin re-descargar |
| Bocadillo vs. `RecordingOverlay` | Coexisten (uno debajo del otro); el bocadillo soporta contraído (nombre + %) / expandido (detalle de cola) |
| Migración `large` → `large-v3` en settings existentes | Silenciosa: remapeo automático al actualizar, sin pedir confirmación |

## Decisiones a resolver en `sdd-design`

1. Dónde vive el inventario: tabla SQLite nueva vs. JSON en `userData` (el estado "descargando" es efímero y probablemente no debe persistir).
2. Chequeo de espacio en Node (`fs.statfsSync`) vs. Python (`shutil.disk_usage`).
3. Contrato IPC exacto de `resources:*` (métodos, shape de eventos, semántica de cancelación).
4. Mecanismo concreto de detección/adopción de la caché HF preexistente del SO (cómo identificar qué modelos ya están completos y válidos sin re-descargar).

## Affected Areas

| Área | Impacto | Descripción |
|------|---------|-------------|
| `python/audio_sync_analyzer.py` | Modified | `local_files_only=True`; quitar default `"large"` |
| `python/` (script nuevo) | New | Descarga instrumentada con progreso |
| `electron/services/resourceManager.js` | New | Inventario + cola + espacio |
| `electron/services/transcriptionManager.js` | Modified | Chequeo preventivo antes del spawn |
| `electron/ipc-handlers/resources.js`, `preload.js`, `main.js` | New/Modified | Canal `resources:*` |
| `src/pages/Onboarding/Onboarding.jsx` + step nuevo | Modified/New | `STEPS` + hook de estado propio |
| `src/pages/Settings/SettingsContext.jsx`, `GeneralTab/TranscriptionSection.jsx` | Modified | Catálogo + sección nueva |
| `src/components/DiskSpaceIndicator/` | New | Componente reutilizable de espacio en disco (libre/total), refresca en cada montaje; primer uso en Ajustes → Modelos y descargas |
| `src/App.jsx` + `useDownloadManager` + `DownloadIndicator` | Modified/New | Bocadillo global |
| `src/pages/Home/Home.jsx:243,478`, `RecordingOverlay.jsx:228`, `RecordingDetailWithTranscription.jsx:62,1587,2227` | Modified | 4 selectores → solo instalados |
| `src/services/settingsService.js` | Modified | Añadir `whisperModel` al default |
| `electron/README.md`, `README.md`, i18n `es/en.json` | Modified | Doc obligatoria + claves nuevas |

## Risks

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| `huggingface_hub`/`requests`/`tqdm` no declarados en hidden imports de PyInstaller → binario roto en DMG | Alta | Auditar `.spec` y validar con build real en PR 1, antes de tocar UI |
| Fijar caché HF propia hace que usuarios existentes "pierdan" modelos ya descargados y re-descarguen hasta 3 GB | Media | Resuelto: adoptar la caché existente del SO al iniciar (mecanismo exacto en decisión 4 de design) |
| Fallback silencioso si `task.model` es falsy — **corregido por `sdd-design`**: cae a `default="small"` del parser (`audio_sync_analyzer.py:1091`), no a `large` (`WHISPER_MODEL="large"` de la L49 es código muerto, `main()` siempre lo sobreescribe con `args.model`) | Baja (antes sobrestimado como Media/3GB) | Eliminarlo en PR 1 igual; fallar explícito con error accionable en vez de fallback implícito |
| `Onboarding.jsx` (~720 líneas) crece más y viola la regla anti-monolitos de `AGENTS.md` | Media | Estado de descargas en hook/contexto dedicado desde el inicio |
| Colisión visual del bocadillo con `RecordingOverlay` | Media | Definir prioridad/offset en design |
| `RecordingDetailWithTranscription.jsx` tiene su propio catálogo hardcodeado sin i18n (gap no visto en la exploración) | Media | Migrarlo al inventario central en PR 4 |
| 4 PRs encadenados alargan la entrega y dejan estados intermedios sin UI | Media | PR 1 verificable por IPC; ningún PR rompe el flujo de transcripción actual |

## Rollback Plan

- Cada PR es revertible por separado; PR 1 es la única base.
- Revert de PR 1 restaura la descarga implícita: `WhisperModel()` sin `local_files_only` vuelve a descargar bajo demanda.
- Si se persiste el inventario en SQLite, la migración debe ser aditiva (tabla nueva, sin alterar tablas existentes) para que el revert no corrompa la BD.
- El cambio de caché HF es el único con efecto en disco del usuario: documentar la ruta y no borrar la caché anterior en el revert.

## Dependencies

- `huggingface_hub` disponible y correctamente empaquetado en el binario PyInstaller.
- `faster-whisper>=1.0.0` (`requirements.txt:6`) soporta `large-v3`.
- Conectividad a HuggingFace en el momento de la descarga.

## Success Criteria

- [ ] Ninguna transcripción dispara una descarga implícita: sin modelo instalado, la acción queda bloqueada con CTA a Ajustes, no se encola para fallar después.
- [ ] El usuario ve finalidad, tamaño, espacio libre y espacio restante estimado antes de confirmar cada descarga.
- [ ] El onboarding se puede completar con o sin modelo descargado, y la descarga no bloquea el avance del wizard.
- [ ] El bocadillo es visible en toda la app mientras haya descargas activas; cerrarlo no cancela; un error queda accionable.
- [ ] Los 4 selectores de modelo ofrecen solo modelos instalados y nunca inician descargas.
- [ ] Borrar el modelo default o uno con tareas `pending`/`processing` está bloqueado con explicación.
