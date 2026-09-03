# Apply Progress: Gestión explícita de descargas de modelos Whisper (issue #149) — PR 1 Núcleo

**Change**: `onboarding-whisper-downloads`
**Scope of this batch**: PR1 — Núcleo, Fase 3 a Fase 6 (continuación; Fase 1-2 ya estaban `[x]` de un batch previo)
**Mode**: Strict TDD (RED → GREEN per task)

## Completed Tasks (this batch + prior batch, cumulative)

### Fase 1: Catálogo y escaneo de caché HF (prior batch)
- [x] 1.1-1.4 — `modelCatalog.js` + `hfCacheScanner.js` + tests (12/12 verdes, verificado previamente)

### Fase 2: Descargador Python + dispatch (prior batch)
- [x] 2.1-2.3 — `python/model_resources.py`, dispatch en `audio_sync_analyzer.py`, `hiddenimports` en `.spec` (sintaxis Python verificada con `py_compile`, sin infra de test Python en el repo)

### Fase 3: `resourceManager` (cola, espacio, cancelación, reintento, borrado)
- [x] 3.1-3.14 — `electron/services/resourceManager.js` completo: `checkSpace`, cola serie con spawn, parseo `PROGRESS:`/`DONE:`/`ERROR:`, `cancel(id)` (SIGTERM→SIGKILL a 3s + barrido `.incomplete`), `retry(id)`, `delete(id)` con guardia (`default-model`/`in-queue`), `resolveCacheDir()`, snapshot inicial (`init()`)
- Test: `test/unit/electron/services/resourceManager.test.js` — 17/17 verdes

### Fase 4: IPC `resources:*`
- [x] 4.1-4.5 — `electron/ipc-handlers/resources.js` (`registerResourcesHandlers(ipcMain)`), namespace `resources` en `electron/preload.js`, registro + broadcast throttled (250ms) en `electron/main.js`
- Tests: `test/unit/electron/ipc-handlers/resources.test.js` (9/9), `test/unit/electron/preload.test.js` (extendido, 3/3)

### Fase 5: Integración con transcripción + migración de settings
- [x] 5.1-5.4 — `migrateWhisperModelAlias(settings)` en `electron/utils/settingsMigrations.js` (D7, wireado en `load-settings` de `ipc-handlers/settings.js`, mismo patrón que `migrateGeminiFreeTier`); bloqueo pre-spawn en `transcriptionManager.addTask()` vía `resourceManager.isInstalled(model)` + `--model_cache_dir` en `runTranscriptionProcess`
- Tests: `test/unit/electron/utils/settingsMigrations.test.js` (11/11, +4 nuevos), `test/unit/electron/services/transcriptionManager.test.js` (nuevo, 3/3)

### Fase 6: Documentación obligatoria y validación bloqueante
- [x] 6.1 — `electron/README.md`: nueva sección "IPC: Inventario y descargas de modelos Whisper (`resources:*`)" + extensión de "Migración de settings.json"
- [x] 6.2 — `README.md` raíz: nueva sección "Descarga explícita de modelos Whisper (`model_resources.py`, issue #149)" en Pipeline de Transcripción
- [x] 6.3 — **Bloqueante, PASÓ**: `npm run electron:build:dir` completó `python:build` (PyInstaller, reutilizando venv de desarrollo simlinkeado desde `/Users/raul.garciad/Proyectos/personal/airecorder/venv`, sin recrearlo desde cero) + `vite build` + `prepare:electron` + `electron-builder --mac --dir`. Se ejecutó el binario empaquetado directamente: `AIRecorder.app/Contents/Resources/python-bin/audio_sync_analyzer resources scan --cache-dir <tmp>` → `DONE:{"cacheDir":"...","repos":[]}`, exit code 0. `huggingface_hub`/`requests`/`tqdm`/`filelock`/`fsspec`/`model_resources` cargan sin `ModuleNotFoundError` en el binario PyInstaller.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3.1-3.14 | `test/unit/electron/services/resourceManager.test.js` | Unit | N/A (new) | ✅ Written | ✅ 17/17 passed | ✅ multiple cases per behavior (checkSpace 4, queue 2, cancel 2, retry 2, delete-guard 3, resolveCacheDir 3, init 1) | ✅ extracted `hasQueuedTaskForModel` as injectable dep after discovering CJS/ESM dual-registry test hang |
| 4.1-4.2 | `test/unit/electron/ipc-handlers/resources.test.js` | Integration | N/A (new) | ✅ Written | ✅ 9/9 passed | ✅ per-handler + error-catching cases | ✅ Clean |
| 4.3-4.4 | `test/unit/electron/preload.test.js` | Unit | ✅ 1/1 (pre-existing Codex test still green) | ✅ Written | ✅ 3/3 passed | ✅ 7 channels + onProgress unsubscribe | ➖ None needed |
| 5.1-5.2 | `test/unit/electron/utils/settingsMigrations.test.js` | Unit | ✅ 7/7 (pre-existing migration tests still green) | ✅ Written | ✅ 11/11 passed | ✅ 4 cases (large→large-v3, idempotent, other model, unset) | ➖ None needed |
| 5.3-5.4 | `test/unit/electron/services/transcriptionManager.test.js` | Unit | N/A (new — first test file for this service) | ✅ Written | ✅ 3/3 passed | ✅ explicit model / default-from-settings / installed-passes cases | ➖ None needed |

### Test Summary (this batch, cumulative)
- **Total tests written**: 36 (17 resourceManager + 9 resources ipc-handlers + 3 preload + 4 settingsMigrations + 3 transcriptionManager)
- **Total tests passing**: 36/36 (new), full suite 1225/1225 green after Fase 5
- **Layers used**: Unit (33), Integration (9 — ipcMain handler wiring; overlaps with unit count above by describe-block grouping, see individual files for exact split)
- **Approval tests** (refactoring): None — no refactoring tasks, all new code/additive changes
- **Pure functions created**: `resolveCacheDir`, `checkSpace`, `computeItems`, `computePercent`, `buildQueueEntries` (resourceManager.js), `migrateWhisperModelAlias` (settingsMigrations.js)

## Deviations from Design

1. `resourceManager.js` exposes injectable test seams (`__setSpawn`, `__setExecutableResolver`, `__setGetDefaultModel`, `__setHasQueuedTaskForModel`, `__resetForTests`) mirroring the existing `codexService.js` convention. Necessary because this file is CJS (no import/export syntax) and its internal `require('../database/dbService')` resolves through Node's native require cache when loaded via dynamic `import()` from a Vitest ESM test — a documented gotcha in this repo (see `test/unit/electron/utils/paths.test.js` comments). See Engram discovery id 1660.
2. `migrateWhisperModelAlias` was wired into `ipc-handlers/settings.js`'s `load-settings` `needsPersist` array (not explicitly called out as a separate task in tasks.md, but required for the migration to actually run "al iniciar la app" per the INV2 spec scenario — otherwise it would be dead code). Matches the exact existing pattern for `migrateGeminiFreeTier`/`migrateCustomChatModelField`.
3. `transcriptionManager.addTask()` now resolves a concrete model (`options.model || getSetting('whisperModel', 'small')`) and persists that RESOLVED value via `dbService.enqueueTask(numericId, model)`, instead of passing through a possibly-`null`/`undefined` `options.model`. This was necessary because Phase 2 (prior batch) already changed `audio_sync_analyzer.py`'s `--model` to `required=True` with no module-level default — under the old `addTask` code, an omitted `options.model` would have produced a task with no `--model` flag, crashing Python's argparse. This is a required correction to make Fase 2's already-completed change actually safe, not a deviation from what's asked in Fase 5.
4. `test/unit/electron/services/transcriptionManager.test.js` uses the `nodeRequire.cache` pre-injection workaround (same pattern as `paths.test.js`/`updateChecker.test.js`) rather than the injectable-function pattern, because `transcriptionManager.js` is a large pre-existing file and retrofitting full dependency injection across all its module-level requires (`electron`, `../utils/paths`, `../database/dbService`, `./notificationService`) was out of scope for this task; only `addTask()`'s new guard needed test coverage.

## Issues Found

None blocking. `npm test` full suite: 1225/1225 green. `npm run electron:build:dir` (task 6.3) succeeded and the packaged binary's `resources scan` subcommand ran cleanly (exit 0, no `ModuleNotFoundError`).

## Files Changed (cumulative, this batch)

| File | Action | What Was Done |
|------|--------|----------------|
| `electron/services/resourceManager.js` | Created | Inventario in-memory, cola serie, espacio, spawn, cancelación, reintento, borrado con guardia |
| `test/unit/electron/services/resourceManager.test.js` | Created | 17 tests cubriendo Fase 3 completa |
| `electron/ipc-handlers/resources.js` | Created | `registerResourcesHandlers(ipcMain)` + `__setResourceManager` para tests |
| `test/unit/electron/ipc-handlers/resources.test.js` | Created | 9 tests, patrón `wiki.test.js` |
| `electron/preload.js` | Modified | Namespace `resources` (list/refresh/checkSpace/download/cancel/remove/getQueue/onProgress) |
| `test/unit/electron/preload.test.js` | Modified | Extendido con 2 tests nuevos (namespace `resources` + `onProgress` unsubscribe) |
| `electron/main.js` | Modified | Import + registro de `registerResourcesHandlers(ipcMain)`; `resourceManager.init()`; broadcast `resources:progress` throttled a 250ms |
| `electron/utils/settingsMigrations.js` | Modified | `migrateWhisperModelAlias(settings)` |
| `electron/ipc-handlers/settings.js` | Modified | Wireo de `migrateWhisperModelAlias` en `load-settings` |
| `test/unit/electron/utils/settingsMigrations.test.js` | Modified | +4 tests para `migrateWhisperModelAlias` |
| `electron/services/transcriptionManager.js` | Modified | Bloqueo pre-spawn (`resourceManager.isInstalled`) + resolución de modelo default + `--model_cache_dir` |
| `test/unit/electron/services/transcriptionManager.test.js` | Created | 3 tests (primer test file de este servicio) |
| `electron/README.md` | Modified | Nueva sección IPC `resources:*` + extensión de sección de migraciones |
| `README.md` (raíz) | Modified | Nueva sección "Descarga explícita de modelos Whisper" en Pipeline de Transcripción |
| `openspec/changes/onboarding-whisper-downloads/tasks.md` | Modified | Fase 3, 4, 5, 6.1, 6.2 marcadas `[x]` |
| `venv` (symlink, no versionado) | Created | Symlink local a `/Users/raul.garciad/Proyectos/personal/airecorder/venv` para reutilizar el venv de desarrollo ya provisto (sin tocar ninguna ruta hardcodeada en código versionado) y validar 6.3 |

## Status

6/6 fases completas de PR1 — Núcleo (Fase 1-6, tareas 1.1-6.3, todas `[x]`). PR1 es funcional y verificable end-to-end por IPC (descargar, cancelar, borrar, listar) sin ninguna UI nueva, tal como exige el diseño del stack de PRs. Listo para `sdd-verify` y, tras eso, para que el usuario haga el staging/commit/PR (fuera del alcance de este agente por regla explícita del proyecto). PR2/PR3/PR4 no fueron tocados.

## Fix pass post-review (blocker + 4 critical)

4 revisores en fresco (riesgo/resiliencia/legibilidad/confiabilidad) encontraron 1 BLOCKER y 4 CRITICAL sobre el código ya implementado de PR1. Se aplicaron las 5 correcciones (las WARNING/SUGGESTION quedaron fuera de este pase, decidido con el usuario). `npm test` completo: **1235/1235 verdes** (1225 previos + 10 nuevos).

1. **BLOCKER — `fs.statfsSync` podía tumbar toda la app** (`electron/services/resourceManager.js`, `electron/main.js`)
   - `statfsCacheDirAncestor()` ahora envuelve `fs.statfsSync` en try/catch: si falla (permisos, filesystem raro, `HF_HOME` roto), loguea con `console.error` (capturado por Sentry vía el override global de `console.error` en `main.js`) y degrada a `{ freeBytes: null, totalBytes: null }` en vez de propagar. Como es la ÚNICA función que llama a `statfsSync` en este módulo, arreglarla ahí protege automáticamente sus 3 call sites (`rescan()`/`init()`, `checkSpace()`, `onDownloadClose()`) sin duplicar try/catch.
   - `app.whenReady().then(initApp)` en `main.js` ahora tiene `.catch(...)`: loguea el error y muestra un `dialog.showMessageBox` de error al usuario, en vez de dejar que un rechazo no manejado tumbe el proceso Electron completo.
   - Contrato IPC actualizado en `design.md`: `Snapshot.freeBytes`/`totalBytes` ahora son `number|null`.
   - Tests nuevos (3) en `resourceManager.test.js`: `rescan()`/`init()`/`onDownloadClose()` no propagan cuando `fs.statfsSync` lanza, y el snapshot resultante queda con `freeBytes`/`totalBytes` en `null`.

2. **CRITICAL — `retry` no conectado a IPC/preload** (`electron/ipc-handlers/resources.js`, `electron/preload.js`, `design.md`)
   - `resourceManager.retry(id)` ya existía a nivel de manager pero no tenía handler IPC. Se agregó `ipcMain.handle('resources:retry', ...)` (mismo patrón `{ok,...}` try/catch que el resto de handlers) y `resources.retry: (id) => ipcRenderer.invoke('resources:retry', id)` en `preload.js`.
   - `design.md`: se agregó `retry` al bloque de código del contrato IPC (antes solo listaba list/refresh/checkSpace/download/cancel/remove/getQueue/onProgress).
   - Tests nuevos: 1 en `resources.test.js` (ipc-handlers), 1 assertion agregada al test existente de `preload.test.js`.

3. **CRITICAL — regresión: tareas legacy con `model=NULL` fallaban con crash de argparse** (`electron/services/transcriptionManager.js`)
   - Antes de este PR, `--model` tenía `default="small"` en Python; esta feature lo quitó (`required=True`), correcto para tareas nuevas (ya resuelven el modelo en el gate de `addTask`) pero roto para filas ya existentes en `transcription_queue` con `model = NULL` de instalaciones previas — `runTranscriptionProcess` solo hacía `if (task.model) args.push('--model', task.model)`, así que esas filas nunca recibían `--model` y Python reventaba con un crash de argparse.
   - Fix: se resuelve `const resolvedModel = task.model || getSetting('whisperModel', 'small')` ANTES de spawnear (mismo mecanismo que usa el gate de `addTask`), y si ese modelo tampoco está instalado (`!resourceManager.isInstalled(resolvedModel)`), se rechaza con un error controlado `MODEL_NOT_INSTALLED::<modelo>` en vez de spawnear con args incompletos. También se corrigió el guardado post-transcripción (`dbService.updateTranscriptionModel`) para usar `resolvedModel` en vez del `task.model` potencialmente `null`.
   - Tests nuevos (3) en `transcriptionManager.test.js`: `model=null`, `model=undefined` (campo ausente) y confirmación de que un `model` explícito NO cae al fallback de settings.

4. **CRITICAL — race condition en borrado: `isInstalled()` quedaba stale durante el borrado** (`electron/services/resourceManager.js`)
   - `delete(id)` chequeaba la guardia de "en uso" de forma síncrona pero el borrado real es async (spawn de Python); durante esa ventana, `isInstalled(id)` seguía devolviendo `true` porque `this.items` no se actualizaba hasta el cierre del proceso — ventana de carrera con `transcriptionManager.addTask()`, que podía encolar contra un modelo a punto de desaparecer.
   - Fix: nuevo `Set` `this.deletingIds`. `delete(id)` marca el id como "deleting" de forma SÍNCRONA (antes de spawnear) y recalcula `this.items`/emite update; `computeItems()` ahora asigna `state: 'deleting'` para esos ids (con prioridad sobre `installed`), lo que hace que `isInstalled(id)` devuelva `false` de inmediato. Nuevo método `finishDeleting(id)` revierte el estado transitorio en TODAS las salidas de `runDeleteProcess` (spawn fallido, evento `error`, cierre normal) para no dejar un item colgado en `deleting`; si el borrado falla, el item vuelve a `installed` (el archivo nunca se borró); si termina OK, pasa a `not-installed`.
   - `design.md`: se agregó `'deleting'` a `ResourceState` con nota explicativa.
   - Tests nuevos (2) en `resourceManager.test.js`: `isInstalled()` devuelve `false` inmediatamente tras `delete()` (antes del cierre del proceso hijo), y reversión a `installed` si el borrado falla.

5. **CRITICAL — falta test de integración del re-chequeo de espacio por ítem de cola** (`electron/services/resourceManager.js`, `test/unit/electron/services/resourceManager.test.js`)
   - Se verificó que `processQueue()` YA re-chequeaba espacio (`checkSpace()` → `fs.statfsSync`) antes de arrancar CADA descarga individual de la cola (no solo la primera al encolar), y que ya continuaba recursivamente con el siguiente ítem si el actual quedaba sin espacio (D4/DL1). **No era un bug de código, solo faltaba el test** — no se modificó lógica de `processQueue()`.
   - Test nuevo (1) en `resourceManager.test.js`: cola con 3 ítems donde el primero se completa, el segundo pasa a `state: 'error'` / `error: { code: 'insufficient-space' }` por el re-chequeo, y la cola continúa automáticamente con el tercero (arranca su spawn) en vez de trabarse.

### Archivos modificados en este pase
`electron/services/resourceManager.js`, `electron/main.js`, `electron/ipc-handlers/resources.js`, `electron/preload.js`, `electron/services/transcriptionManager.js`, `openspec/changes/onboarding-whisper-downloads/design.md`, `test/unit/electron/services/resourceManager.test.js`, `test/unit/electron/ipc-handlers/resources.test.js`, `test/unit/electron/preload.test.js`, `test/unit/electron/services/transcriptionManager.test.js`.

No se tocó ningún archivo de PR2/PR3/PR4. No se hizo `git add`/`commit`/`push` (regla explícita del proyecto).

---

# Apply Progress: onboarding-whisper-downloads — PR 2 Ajustes → Modelos y descargas — COMPLETE (4/4 fases)

**Scope of this batch**: PR2 — Fase 1 a Fase 4 (`tasks.md`, bloque "PR 2 — Ajustes → Modelos y descargas"). PR1 (Núcleo) ya estaba `[x]` completo de un batch previo; no se tocó.
**Mode**: Strict TDD (RED → GREEN → REFACTOR por tarea)

## Completed Tasks

### Fase 1: Catálogo en `SettingsContext`
- [x] 1.1-1.2 — Reemplazado el export estático `whisperModels` (L27-33 de `SettingsContext.jsx`) por un catálogo dinámico obtenido vía IPC `resources.list()` (INV1/INV6).

### Fase 2: `DiskSpaceIndicator`
- [x] 2.1-2.2 — Componente reutilizable, `useEffect` con deps `[]`, refresca (`resources.refresh()`) en cada montaje — nunca muestra un valor stale de una instancia anterior (INV5, D10).

### Fase 3: `ModelsSection`
- [x] 3.1-3.2 — Lista modelos con estado/tamaño, monta `DiskSpaceIndicator` encima de la lista.
- [x] 3.3-3.4 — Flujo de confirmación de descarga: `checkSpace()` → modal con finalidad/tamaño/libre/restante → confirmar → `download(id)`; espacio insuficiente bloquea sin encolar y explica.
- [x] 3.5-3.6 — Progreso en vivo por modelo activo desde el snapshot de `resources:progress` (pull inicial con `list()` + suscripción `onProgress()`).
- [x] 3.7-3.8 — Cancelar (`resources.cancel(id)`) para modelos en cola/descargando; reintentar (`resources.retry(id)` — **no** `download(id)`, ver Deviations) para modelos en error.
- [x] 3.9-3.10 — Confirmación de borrado mostrando espacio a liberar (`installedBytes`); guardia (`reason: 'default-model'|'in-queue'`) mostrada tras el intento de `resources.remove(id)`.

### Fase 4: Documentación
- [x] 4.1 — Claves i18n en `src/i18n/locales/{es,en}.json`: `settings.diskSpace.*`, `settings.modelsSection.*` (title/states/errors/confirm/deleteGuard), `settings.buttons.retry`/`.delete`, `settings.whisperModels.large-v3` (necesaria porque el catálogo dinámico ya no incluye `large`, ver Deviations).
- Matriz de documentación obligatoria (`AGENTS.md`): no aplica — ningún archivo de esta tanda pertenece a `electron/main.js`, `preload.js`, `dbService.js`, `services/ai/*`, `transcriptionManager.js` o `audio_sync_analyzer.py`.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1-1.2 | `src/tests/pages/Settings/whisperModelCatalog.test.js` | Unit (pure) | N/A (new) | ✅ Written | ✅ 6/6 passed | ✅ success + 3 degrade-to-`[]` cases (IPC rejects, no `electronAPI`, `ok:false`) + empty/missing catalog | ➖ None needed |
| 2.1-2.2 | `src/tests/components/DiskSpaceIndicator.test.jsx` | Unit (component, jsdom) | N/A (new) | ✅ Written | ✅ 4/4 passed | ✅ mount+values, remount-not-stale, `null` free/total degrade, IPC rejects | ✅ extracted `formatGb` to shared `src/utils/formatBytes.js` |
| 3.1-3.10 | `src/tests/pages/Settings/components/GeneralTab/ModelsSection.test.jsx` | Unit (component, jsdom) | N/A (new) | ✅ Written | ✅ 9/9 passed | ✅ multiple cases per behavior (list+indicator ordering, sufficient/insufficient checkSpace, live progress update via 2nd snapshot, cancel vs retry visibility, delete-eligible + 2 guard reasons) | ➖ None needed (component already used shared `formatGb`, `ConfirmModal`) |

### Test Summary (this batch)
- **Total tests written**: 19 (6 whisperModelCatalog + 4 DiskSpaceIndicator + 9 ModelsSection)
- **Total tests passing**: 19/19 (new). Full suite: **1254/1254 green** (1235 pre-existing after PR1's fix pass + 19 new).
- **Layers used**: Unit/pure (6), Unit/component-jsdom (13)
- **Approval tests** (refactoring): None — no refactoring of pre-existing behavior, only additive changes plus one backward-compatible wiring change (`TranscriptionSection.jsx`'s import source), covered by re-running the full suite (no regression).
- **Pure functions created**: `fetchModelCatalog`, `computeWhisperModelOptions` (`whisperModelCatalog.js`), `formatGb` (`utils/formatBytes.js`)

## Deviations from Design

1. **`resources.retry(id)` used for the retry button, not `resources.download(id)`.** `tasks.md` task 3.7's original wording said "invocan `resources.cancel/download`", but `design.md`'s IPC contract (already updated in PR1's post-review fix pass) defines a dedicated `resources:retry` channel that cleans up partial blobs before relaunching from a clean state — calling `download()` directly on retry would skip that cleanup. Used `retry()` for correctness, matching the authoritative, more-recently-updated `design.md` contract over the literal (pre-fix-pass) task wording. Corrected the task 3.7 text in `tasks.md` to say `resources.cancel/retry` to avoid this ambiguity for future readers. Test explicitly asserts `retry` is called and `download` is NOT (`ModelsSection.test.jsx`, "Fase 3.7/3.8" describe block).
2. **`SettingsContext.jsx`'s static `whisperModels` export was removed, not just modified in place**, because it must now be async-derived from IPC data (an ES module top-level `export const` can't be populated asynchronously). It's exposed exclusively as a context value (`useSettings().whisperModels`) computed from the new `modelCatalog` state via `computeWhisperModelOptions()`. `TranscriptionSection.jsx` (the only other consumer of the old static export) was updated with a **one-line import-source change** (destructure `whisperModels` from `useSettings()` instead of importing the removed static module export) so it keeps working — this is NOT the PR4 "solo instalados + CTA" hardening (still pending, out of scope here), only the minimum change needed to avoid breaking existing UI now that the static list no longer exists. Investigated per the batch prompt's explicit instruction to check for UI duplication before assuming independence; concluded `TranscriptionSection`'s `<select>` (picks the *default* model for new transcriptions) and `ModelsSection` (manages *which models exist on disk*) are functionally distinct, not duplicate UI — consistent with `design.md`'s File Changes table, which lists `TranscriptionSection.jsx`'s hardening as a separate PR4 task (4.7-4.8).
3. **Added `settings.whisperModels.large-v3` i18n key** (both locales) — a necessary consequence of #2: the dynamic catalog contains `large-v3` (per PR1's D7 migration), not the legacy `large`, so `TranscriptionSection.jsx`'s dropdown needed a matching label to avoid showing the raw i18n key as text. The old `large` key was left in place (harmless, unused) rather than removed, to avoid any risk of breaking something outside this batch's verified scope.
4. **`ModelsSection.jsx` does its own independent `resources.list()` + `resources.onProgress()` data-fetching, instead of reusing `SettingsContext`'s new `modelCatalog`/`loadModelCatalog`.** This causes one extra (cheap, synchronous-on-the-main-process-side) `resources:list` IPC round trip on first mount of the Settings page. Intentional, not an oversight: `design.md` D10 explicitly prescribes this same "presentational + own data-fetching, not dependent on a shared hook" pattern for `DiskSpaceIndicator`; `ModelsSection` needs live 250ms-throttled `onProgress` updates (queue/percent/active) that would otherwise force the entire `SettingsContext` (and every section subscribed to it) to re-render on every progress tick if centralized there — an unnecessary performance cost across unrelated tabs (AI providers, appearance, etc.) for a value only `ModelsSection` needs live.
5. **Added optional `confirmTestId`/`cancelTestId` props to the shared `ConfirmModal.jsx`** (default `undefined`, so `data-testid` is simply omitted when not passed) to reuse it for both the download-confirmation and delete-confirmation modals in `ModelsSection.jsx` with test-addressable buttons, instead of hand-rolling two new modal components. Verified the 3 other existing consumers (`SpeakerDetail.jsx`, `TemplatesSettings.jsx`, `CustomConnectionsSection.jsx`) don't pass these props and are unaffected (full suite still green).

## Issues Found

None blocking. `npm test` full suite: **1254/1254 green**.

Pre-existing, unrelated dirty files noticed in the worktree (`git status`) that were **not touched** by this batch: `.atl/skill-registry.md`, `.opencode/package-lock.json` — left as-is, out of scope.

## Files Changed (this batch)

| File | Action | What Was Done |
|------|--------|----------------|
| `src/pages/Settings/whisperModelCatalog.js` | Created | `fetchModelCatalog(electronAPI)` + `computeWhisperModelOptions(items, t)` — extracted pure/near-pure logic (Extract-Before-Mock rule) instead of rendering the full `SettingsProvider` (which no test in this repo does — confirmed no precedent) |
| `src/pages/Settings/SettingsContext.jsx` | Modified | Removed static `whisperModels` export (L27-33); added `modelCatalog` state + `loadModelCatalog()` (calls `resources.list()`, invoked from `loadSettings()`); exposes `modelCatalog`, `loadModelCatalog`, and derived `whisperModels` via context value |
| `src/pages/Settings/components/GeneralTab/TranscriptionSection.jsx` | Modified | `whisperModels` now destructured from `useSettings()` instead of the removed static module export (see Deviation #2) |
| `src/components/DiskSpaceIndicator/DiskSpaceIndicator.jsx` | Created | Reusable component (D10): `useEffect([])` calls `resources.refresh()` on every mount, shows free/total or degrades to "unavailable" |
| `src/components/DiskSpaceIndicator/DiskSpaceIndicator.module.css` | Created | Styling using existing `--color-*` CSS variables (dark-mode safe) |
| `src/utils/formatBytes.js` | Created | `formatGb(bytes)` — shared pure helper, extracted from `DiskSpaceIndicator` during REFACTOR, reused by `ModelsSection` |
| `src/pages/Settings/components/GeneralTab/ModelsSection.jsx` | Created | "Modelos y descargas" section: list + `DiskSpaceIndicator`, download confirmation flow, live progress, cancel/retry, delete confirmation + guard |
| `src/pages/Settings/components/GeneralTab/ModelsSection.module.css` | Created | Row/state/progress styling using existing `--color-*` CSS variables |
| `src/pages/Settings/components/GeneralTab/GeneralTab.jsx` | Modified | Mounted `<ModelsSection />` right after `<TranscriptionSection />`, with a comment explaining why it's not duplicate UI |
| `src/components/ConfirmModal/ConfirmModal.jsx` | Modified | Added optional `confirmTestId`/`cancelTestId` props (backward-compatible, default `undefined`) |
| `src/i18n/locales/es.json`, `src/i18n/locales/en.json` | Modified | New keys: `settings.diskSpace.*`, `settings.modelsSection.*`, `settings.buttons.retry`/`.delete`, `settings.whisperModels.large-v3` |
| `src/tests/pages/Settings/whisperModelCatalog.test.js` | Created | 6 tests (Fase 1) |
| `src/tests/components/DiskSpaceIndicator.test.jsx` | Created | 4 tests (Fase 2) |
| `src/tests/pages/Settings/components/GeneralTab/ModelsSection.test.jsx` | Created | 9 tests (Fase 3) |
| `openspec/changes/onboarding-whisper-downloads/tasks.md` | Modified | PR2 Fase 1-4 marcadas `[x]`; corregido el texto de la tarea 3.7 (`cancel/download` → `cancel/retry`, ver Deviation #1) |

## Status

4/4 fases completas de PR2 — Ajustes → Modelos y descargas (Fase 1-4, todas `[x]`). Funcional end-to-end sobre el contrato IPC `resources:*` de PR1 (ya estable, incluyendo `retry`). No se tocó ningún archivo de PR1 (ya `[x]`), PR3 o PR4. No se hizo `git add`/`commit`/`push`/PR (regla explícita del proyecto) — queda a cargo del usuario/orquestador.

## Fix pass PR2 post-review

4 revisores en fresco sobre el código ya implementado de PR2 encontraron 1 BLOCKER + 3 CRITICAL confirmados. Aplicados quirúrgicamente — solo estos 4 issues, WARNING/SUGGESTION quedaron fuera de este pase.

### Fixes Applied

1. **BLOCKER — `src/pages/Settings/SettingsContext.jsx` (`loadSettings()`)**: `loadModelCatalog()` se llamaba "fire-and-forget" (sin `await`), a diferencia de la llamada análoga de `getSystemMicrophones()` justo arriba que sí se esperaba. Esto permitía que `loadSettings()` terminara (`isLoading` → `false`) antes de que el catálogo dinámico de modelos Whisper (`modelCatalog`/`whisperModels`) se poblara — el selector podía quedar vacío en una carrera. **Fix**: agregado `await` antes de `loadModelCatalog()`.
   - Test nuevo: `src/tests/pages/Settings/SettingsContext.loadModelCatalog.test.jsx` (3 tests, nuevo archivo). Excepción puntual a la regla Extract-Before-Mock documentada en el batch original: el bug vive en la orquestación misma de `loadSettings()`, no es aislable a una función pura. Monta el `SettingsProvider` real mockeando los 7 proveedores/servicios de IA y tema (`ollamaProvider`, `geminiProvider`, `providerRouter`, `lmStudioProvider`, `themeService`, `customOpenAIProvider`, `codexModelSelection`) para aislar el efecto bajo prueba. Verifica: (a) `isLoading` permanece `true` y `window.electronAPI.loadSettings` NO se invoca hasta que la promesa de `resources.list()` resuelve (diferenciador directo de la carrera); (b) tras resolver, `modelCatalog`/`whisperModels` quedan poblados; (c) 2 casos de degradación con gracia (`resources` no expuesto, `resources.list()` rechaza) donde `loadSettings()` igual termina con catálogo vacío sin colgarse ni romper el resto del flujo.

2. **CRITICAL — `electron/services/resourceManager.js` (`checkSpace()`) + `src/pages/Settings/components/GeneralTab/ModelsSection.jsx` (`handleDownloadClick`)**: `sufficient = freeBytes >= requiredBytes` coaccionaba `freeBytes: null` (cuando `statfsSync` falla en el backend) a `0 >= requiredBytes` → siempre `false`, indistinguible de "espacio insuficiente" real. El flujo de descarga bloqueaba SIEMPRE con el mensaje de espacio insuficiente cuando en realidad el problema era no poder verificar el espacio. **Fix**: `sufficient = freeBytes == null ? null : freeBytes >= requiredBytes` (mismo criterio para `remainingAfterBytes: freeBytes == null ? null : freeBytes - entry.estimatedBytes`). `download()`/`processQueue()` ya comparaban con `=== false` estricto, así que `sufficient: null` no los bloquea server-side — sin cambios necesarios ahí. En `ModelsSection.jsx`: nuevo estado `spaceUnavailable` (distinto de `insufficientSpace`), detectado quando `result.freeBytes == null`; muestra un mensaje honesto ("no pudimos verificar el espacio disponible") + botón `continueAnyway` que llama `download(id)` directamente bajo decisión explícita del usuario — mismo criterio UX que el estado `unavailable` ya existente en `DiskSpaceIndicator.jsx`. Claves i18n nuevas: `settings.modelsSection.confirm.spaceUnavailable`, `settings.buttons.continueAnyway` (es/en).
   - Tests nuevos: 1 en `ModelsSection.test.jsx` (muestra el mensaje correcto, NO el de espacio insuficiente, y el botón "continuar" dispara `download`); 2 en `test/unit/electron/services/resourceManager.test.js` (`checkSpace()` devuelve `sufficient: null` no `false` cuando `statfsSync` lanza; `download()` no bloquea con `insufficient-space` en ese caso).

3. **CRITICAL — `src/pages/Settings/components/GeneralTab/ModelsSection.jsx` (`handleConfirmDeleteAccept`)**: solo se manejaba `result.reason` (los 2 guard reasons `default-model`/`in-queue`). Un fallo real de borrado (`{ok:false, error}`, sin `reason` — spawn/proceso/protocolo stdout fallido en `resourceManager.js#runDeleteProcess`) se descartaba en silencio, sin ningún feedback al usuario. **Fix**: nueva rama `else if (result.ok === false)` (sin `reason`) → estado `deleteError` → mensaje de error genérico accionable con el código de error interpolado (`settings.modelsSection.confirm.deleteError`, es/en).
   - Test nuevo en `ModelsSection.test.jsx`: `remove()` devuelve `{ok:false, error:'spawn-failed'}` → se muestra el mensaje de error (no se descarta en silencio, no se confunde con un guard reason).

4. **CRITICAL — `src/pages/Settings/components/GeneralTab/ModelsSection.jsx` (`useEffect` inicial)**: `window.electronAPI?.resources?.list?.()` no tenía `.catch()` ni estado de error — un rechazo dejaba la sección en blanco indefinidamente, sin ninguna vía de recuperación para el usuario. **Fix**: `Promise.resolve(...).then(...).catch(...)` + nuevo estado `loadStatus` (`'loading'|'ready'|'error'`) + `reloadToken` (incrementado por `handleRetryLoad`) agregado a las deps del `useEffect` para poder reintentar sin duplicar la lógica de suscripción. Cuando `loadStatus === 'error'`, se muestra un panel con mensaje (`settings.modelsSection.loadError`) y botón "Reintentar" (reusa `settings.buttons.retry` ya existente).
   - Test nuevo en `ModelsSection.test.jsx`: `list()` rechaza → se muestra el panel de error con botón de reintento; al reintentar (con `list()` ahora resuelto) el listado se puebla y el panel de error desaparece.

### Test Summary (fix pass)
- **Total tests nuevos**: 8 (3 en `SettingsContext.loadModelCatalog.test.jsx` [nuevo archivo] + 3 en `ModelsSection.test.jsx` + 2 en `resourceManager.test.js`)
- **Full suite**: **1262/1262 green** (1254 previos del apply original de PR2 + 8 nuevos)

### Files Changed (fix pass)
| File | Action | What Was Done |
|------|--------|----------------|
| `src/pages/Settings/SettingsContext.jsx` | Modified | `await` agregado antes de `loadModelCatalog()` en `loadSettings()` (Fix 1) |
| `electron/services/resourceManager.js` | Modified | `checkSpace()`: `sufficient`/`remainingAfterBytes` distinguen `freeBytes === null` ("no verificado") de espacio insuficiente real (Fix 2) |
| `src/pages/Settings/components/GeneralTab/ModelsSection.jsx` | Modified | Estado `spaceUnavailable` + botón `continueAnyway` (Fix 2); rama `deleteError` en `handleConfirmDeleteAccept` (Fix 3); `loadStatus`/`reloadToken` + panel de error con reintento en el `useEffect` inicial (Fix 4) |
| `src/i18n/locales/es.json`, `src/i18n/locales/en.json` | Modified | Nuevas claves: `modelsSection.loadError`, `modelsSection.confirm.spaceUnavailable`, `modelsSection.confirm.deleteError`, `buttons.continueAnyway` |
| `src/tests/pages/Settings/SettingsContext.loadModelCatalog.test.jsx` | Created | 3 tests (Fix 1 — race regression + 2 casos de degradación con gracia) |
| `src/tests/pages/Settings/components/GeneralTab/ModelsSection.test.jsx` | Modified | +3 tests (Fix 2, 3, 4) |
| `test/unit/electron/services/resourceManager.test.js` | Modified | +2 tests (Fix 2 — backend) |

No se tocó PR1 (ya commiteado en la branch base), PR3, PR4. No se hizo `git add`/`commit`/`push`/PR (regla explícita del proyecto). `tasks.md` no requirió cambios: los 4 fixes son correcciones dentro del alcance ya marcado `[x]` de PR2, no tareas nuevas.

### Status (actualizado tras fix pass)

4/4 fases de PR2 completas + fix pass post-review aplicado (1 BLOCKER + 3 CRITICAL confirmados, los 4 corregidos). Full suite 1262/1262 green. Próximo: `sdd-verify`/re-verify sobre PR2, luego PR3 (onboarding) cuando se retome.

**Review Workload note**: el diff medido de este batch (código + tests + i18n + CSS) es de aproximadamente 886 líneas nuevas más ~169 líneas netas modificadas en archivos existentes ≈ 1055 líneas — por encima de la estimación "PR2 ~400-500" de `tasks.md`, aunque la lógica de producción "dura" (sin contar tests/i18n/CSS) ronda las ~470 líneas, más cerca del rango "Medium" estimado. La partición en 4 PRs y la estrategia `stacked-to-main` ya estaban decididas antes de este `sdd-apply` (`Decision needed before apply: No` en `tasks.md`), así que no se bloqueó el batch; se deja esta medición para que el reviewer humano tenga el dato real al evaluar el PR.
