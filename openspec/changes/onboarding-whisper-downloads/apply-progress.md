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

---

# Apply Progress: onboarding-whisper-downloads — PR 3 Onboarding: paso "Modelo de transcripción" — COMPLETE (4/4 fases)

**Scope of this batch**: PR3 — Fase 1 a Fase 4 (`tasks.md`, bloque "PR 3 — Onboarding: paso 'Modelo de transcripción'"). PR1 (Núcleo) y PR2 (Ajustes → Modelos y descargas) ya estaban `[x]` completos de batches previos; no se tocó ningún archivo de PR1/PR2/PR4.
**Mode**: Strict TDD (RED → GREEN por tarea)

## Completed Tasks

### Fase 1: Hook de estado
- [x] 1.1-1.2 — `useModelDownloadStep()` (`src/pages/Onboarding/useModelDownloadStep.js`): preselecciona `small` (ONB2), expone `{items, queue, selectedId, selectModel, startDownload, status}`, hace su propio pull inicial (`resources.list()`) + suscripción (`resources.onProgress()`) — mismo patrón de data-fetching propio que `DiskSpaceIndicator.jsx`/`ModelsSection.jsx` (design.md D10).

### Fase 2: Paso UI
- [x] 2.1-2.2 — `ModelStep.jsx` (`src/pages/Onboarding/ModelStep.jsx`): catálogo visible con tamaño (`formatGb`) y estado por modelo (radio buttons), `small` preseleccionado.
- [x] 2.3-2.4 — Cambiar la selección (`selectModel(id)`) actualiza `selectedId` sin iniciar ninguna descarga; una `startDownload()` posterior usa la selección actualizada.
- [x] 2.5-2.6 — El botón "Siguiente" (`onNext`) NUNCA se deshabilita — a diferencia de `PermissionsStep`/`AiConfigStep` (que sí condicionan su avance), este paso es no bloqueante por diseño (ONB3), incluso con una descarga activa en curso.
- [x] 2.7-2.8 — Persistencia condicional: `useModelDownloadStep.js` rastrea internamente (`activeDownloadIdRef`, no expuesto) el id de la descarga que ESTE hook inició; solo cuando ese id transiciona a `installed` (`previousStatesRef` detecta el cambio de estado) llama `updateSettings({whisperModel: id})`. Fallida (`error`)/cancelada (D6: barrido de `.incomplete` → vuelve a `not-installed`)/modelo instalado por fuera de este paso sin `startDownload()` propio → nunca persiste (ONB4). Ver Deviations #1 sobre dónde vive el test 2.7.

### Fase 3: Wiring en `Onboarding.jsx`
- [x] 3.1-3.2 — `STEPS` (ahora exportado con `export const STEPS`, ver Deviations #2) incluye `{ id: 'model' }`; `Onboarding.jsx` renderiza `<ModelStep t={onNext=handleNext} onBack={handleBack} StepProgressComponent={...} />` en `currentStep === 2`, siguiendo el mismo patrón de props (`t/onBack/onNext/StepProgressComponent`) que `PermissionsStep`/`PreferencesStep`/`LocalAiInfoStep`. Sin estado nuevo dentro de `Onboarding.jsx` — todo vive en `useModelDownloadStep.js` (regla anti-monolito de `AGENTS.md`). Posición elegida (ver Deviations #3): justo después de `aiInfo`, antes de `ai`.

### Fase 4: Documentación
- [x] 4.1 — Claves i18n nuevas en `src/i18n/locales/{es,en}.json`: `onboarding.model.*` (`title/subtitle/loading/loadError/downloadBtn/nextBtn`) y `onboarding.steps.model`. Reutiliza (no duplica) `settings.modelsSection.states.*` y `settings.misc.recommended` — mismo criterio de reuso cross-namespace ya usado en `ReadyStep.jsx` (`settings.roles.*`).
- Matriz de documentación obligatoria (`AGENTS.md`): no aplica — ningún archivo de esta tanda pertenece a `electron/main.js`, `preload.js`, `dbService.js`, `services/ai/*`, `transcriptionManager.js` o `audio_sync_analyzer.py`.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1-1.2, 2.7-2.8 | `src/tests/pages/Onboarding/useModelDownloadStep.test.jsx` | Unit (hook, jsdom) | N/A (new) | ✅ Written | ✅ 8/8 passed | ✅ multiple cases per behavior (preselect, exposed API, no-persist-before-complete, selection→download id, persist-on-installed with no-double-persist check, no-persist-on-error, no-persist-on-cancel/revert, no-persist-for-externally-installed-model) | ➖ None needed (hook has no CSS/markup to refactor; extracted refs instead of nested setState tricks during first pass) |
| 2.1-2.6 | `src/tests/pages/Onboarding/ModelStep.test.jsx` | Unit (component, jsdom) | N/A (new) | ✅ Written | ✅ 4/4 passed | ✅ catalog+preselection, selection-change+download-id, next-never-blocked (idle + actively-downloading cases) | ➖ None needed |
| 3.1-3.2 | `src/tests/pages/Onboarding/Onboarding.test.jsx` | Integration (jsdom) | N/A (first test file for `Onboarding.jsx`) | ✅ Written | ✅ 3/3 passed | ✅ STEPS-array assertion + rendered-position assertion + advance-moves-forward assertion | ➖ None needed |

### Test Summary (this batch)
- **Total tests written**: 15 (8 useModelDownloadStep + 4 ModelStep + 3 Onboarding wiring)
- **Total tests passing**: 15/15 (new). Full suite: **1277/1277 green** (1262 pre-existing after PR2's fix pass + 15 new).
- **Layers used**: Unit/hook-jsdom (8), Unit/component-jsdom (4), Integration/jsdom (3)
- **Approval tests** (refactoring): None — no refactoring of pre-existing behavior. `Onboarding.jsx`'s STEPS/labels/render-switch renumbering is additive insertion, not behavior change for the other 6 pre-existing steps; verified by the full suite staying green and by the new Onboarding.test.jsx itself exercising the real (non-stubbed) welcome→aiInfo transition.
- **Pure functions created**: none new (`formatGb` reused from PR2); state-transition detection logic in `useModelDownloadStep.js` (`applySnapshot`) is not extracted as a standalone pure function because it necessarily closes over refs or would need them passed as arguments — kept inline given the hook itself is already small and directly tested.

## Deviations from Design

1. **Task 2.7's RED test lives in `useModelDownloadStep.test.jsx`, not in a `ModelStep.test.jsx` "Fase 2.7" describe block**, even though `tasks.md` numbers it under "Fase 2: Paso UI". `tasks.md`'s own GREEN counterpart (2.8) says "Implementar persistencia condicional en `useModelDownloadStep.js`" — the logic genuinely lives in the hook, not in `ModelStep.jsx` (which is purely presentational). Testing it where the logic actually executes (with full control over synthetic `resources:progress` snapshots and no risk of coupling the assertion to DOM structure) is more precise and avoids inflating `ModelStep.test.jsx` with backend-shape-heavy setup for a concern that isn't rendering-related. Same precedent as PR2 Deviation #1 (aligning test placement with where implementation actually lives over literal task-file section headers). `tasks.md` task 2.7's text was left as-is (already accurate about WHAT is tested, just not WHICH file) plus a parenthetical note pointing to this deviation.
2. **`STEPS` is now `export const STEPS` instead of a private `const`.** Minimal, backward-compatible change (no runtime behavior difference — `Onboarding.jsx` still uses it exactly as before) needed to write a real, non-brittle "Fase 3.1" integration test asserting `ONB1` ("Onboarding.jsx incluye el paso en STEPS") without parsing the component's rendered DOM as a STEPS-array proxy.
3. **Step position: `model` was placed right after `aiInfo` and before `ai`** (index 2 of 7), not at the end or immediately before `permissions`/`preferences`. Neither `proposal.md`, `spec.md`, nor `design.md` specify an exact wizard position (`spec.md`'s ONB1 only requires "a step of its own, separate from the others"). Product rationale: transcription is the front of the whole pipeline — the "ai" step configures the LLM used to analyze/summarize the ALREADY-transcribed text, so picking/downloading the Whisper model before configuring that LLM follows the real audio → transcription → AI-analysis order. Secondary, non-decisive factor: `aiInfo` and `preferences` are the only two pre-existing steps whose "next" action has no gating condition (`AiConfigStep` gates on `canProceed`, `PermissionsStep` gates on `micStatus === 'granted'`), which made this position the cleanest to reach via real (non-mocked) navigation in `Onboarding.test.jsx` — a happy side effect of the product rationale above, not the primary driver.
4. **No `resources:check-space` confirmation flow in `ModelStep.jsx`** (unlike `ModelsSection.jsx`'s `checkSpace()` → modal → confirm → `download()` flow from PR2). Not in `tasks.md`'s PR3 scope (no DL1 reference in the PR3 task list, only ONB1-4) and not in `spec.md`'s onboarding-model-selection requirements. `startDownload()` calls `resources.download(id)` directly; the backend (`resourceManager.processQueue()`, already fixed in PR1's post-review pass) still re-checks space before actually starting the download and sets `item.error = {code:'insufficient-space',...}` if it doesn't fit — surfaced via the existing `settings.modelsSection.states.error`/state text in `ModelStep.jsx`'s per-item state label, same criterion as `ModelsSection.jsx`'s `ERROR_CODE_KEY_MAP`, just without a dedicated error-detail message component (out of scope here). This intentionally does NOT repeat the `freeBytes: null` coercion bug fixed in PR2's fix-pass, because this flow never reads `checkSpace()`'s `sufficient`/`freeBytes` fields at all — there is nothing to coerce.
5. **Download button only shown when `item.state === 'not-installed'`** (no cancel/retry/delete affordances in the onboarding step). Cancel/retry/delete are PR2-scoped (Settings → Modelos y descargas) per the design's File Changes table and are reachable later from there; repeating them here was out of `tasks.md`'s PR3 scope and would have duplicated `ModelsSection.jsx` logic for a step whose whole point (ONB3) is that the user is never blocked by download state — if a download fails, the user can simply click "Siguiente" and manage it later from Ajustes.

## Issues Found

None blocking. `npm test` full suite: **1277/1277 green**.

## Files Changed (this batch)

| File | Action | What Was Done |
|------|--------|----------------|
| `src/pages/Onboarding/useModelDownloadStep.js` | Created | Hook de estado: catálogo + selección + descarga + persistencia condicional (Fase 1, 2.7-2.8) |
| `src/pages/Onboarding/ModelStep.jsx` | Created | Paso UI presentacional: catálogo con radio buttons, botón de descarga, footer con "Siguiente" no bloqueante (Fase 2) |
| `src/pages/Onboarding/Onboarding.jsx` | Modified | `STEPS` exportado + entrada `{ id: 'model' }`; `labels` de `renderStepProgress` extendido; render switch renumerado (`currentStep 2..6`) e inserción de `<ModelStep>` en `currentStep === 2` (Fase 3) |
| `src/i18n/locales/es.json`, `src/i18n/locales/en.json` | Modified | Nuevas claves `onboarding.model.*` y `onboarding.steps.model` (Fase 4) |
| `src/tests/pages/Onboarding/useModelDownloadStep.test.jsx` | Created | 8 tests (Fase 1, 2.7-2.8) |
| `src/tests/pages/Onboarding/ModelStep.test.jsx` | Created | 4 tests (Fase 2.1-2.6) |
| `src/tests/pages/Onboarding/Onboarding.test.jsx` | Created | 3 tests (Fase 3.1-3.2) |
| `openspec/changes/onboarding-whisper-downloads/tasks.md` | Modified | PR3 Fase 1-4 marcadas `[x]`, nota agregada a la tarea 2.7 (ver Deviation #1) |

## Status

4/4 fases completas de PR3 — Onboarding: paso "Modelo de transcripción" (Fase 1-4, tareas 1.1-4.1, todas `[x]`). Funcional end-to-end sobre el contrato IPC `resources:*` de PR1 (ya estable), independiente en funcionalidad de PR2 (solo comparte la dependencia de PR1). No se tocó ningún archivo de PR1, PR2 o PR4. No se hizo `git add`/`commit`/`push`/PR (regla explícita del proyecto) — queda a cargo del usuario/orquestador. Próximo: `sdd-verify` sobre PR3, luego PR4 (bocadillo global + hardening de los 4 selectores) cuando se retome.

## Fix pass PR3 post-review

4 revisores en fresco encontraron 2 BLOCKER y 1 CRITICAL confirmados sobre el código ya implementado de PR3. Aplicados quirúrgicamente — solo estos 3 issues, WARNING/SUGGESTION quedaron fuera de este pase. `npm test` completo: **1283/1283 verdes** (1277 previos + 6 nuevos).

### Fixes Applied

1. **BLOCKER — `startDownload()` descartaba en silencio el fallo síncrono de `resources:download`** (`src/pages/Onboarding/useModelDownloadStep.js`, `src/pages/Onboarding/ModelStep.jsx`)
   - `resourceManager.download(id)` puede devolver `{ ok: false, error: 'insufficient-space'|'unknown-model'|'already-queued'|'already-installed' }` de forma SÍNCRONA, ANTES de encolar nada — no pasa por el mecanismo de estado de error por ítem que sí cubre `processQueue()` (ese solo aplica a fallos DESPUÉS de encolar). El código anterior hacía `await window.electronAPI?.resources?.download?.(selectedId);` sin mirar el resultado: un fallo (p. ej. espacio insuficiente al hacer clic en "Descargar") no mostraba nada al usuario.
   - Fix: `startDownload()` ahora captura el resultado; si `result.ok === false`, setea un nuevo estado `startError: { code }` (distinto de `items[].error`, que sigue cubriendo los fallos post-cola) y NO llama a `onDownloadStart` (ver Fix 2 — nada que trackear si nunca arrancó). `ModelStep.jsx` renderiza `data-testid="model-start-error"` reutilizando las claves i18n ya existentes `settings.modelsSection.errors.*` (cross-namespace, mismo criterio que el resto del archivo) vía un mapeo local mínimo (`START_ERROR_KEY_MAP`, solo `insufficient-space`→`insufficientSpace`, el resto→`unknown`) — no hizo falta duplicar el `ERROR_CODE_KEY_MAP` completo de PR2 porque los códigos síncronos de `download()` no coinciden con los códigos de `items[].error.code` de `processQueue()`. El botón de descarga sigue visible para reintentar: el ítem nunca sale de `not-installed` porque `download()` nunca llegó a encolar nada.
   - Coincide con lo reportado por los revisores, sin hallazgos adicionales.
   - Tests nuevos: 2 en `useModelDownloadStep.test.jsx` (`startError` se setea con el código; se limpia en un reintento exitoso posterior) + 2 en `ModelStep.test.jsx` (mensaje visible + botón de reintento disponible; `onDownloadStart` NO se llama cuando falla).

2. **BLOCKER — la persistencia ONB4 se perdía si el usuario avanzaba el wizard con la descarga en curso** (`src/pages/Onboarding/useOnboardingModelPersistence.js` [nuevo], `src/pages/Onboarding/useModelDownloadStep.js`, `src/pages/Onboarding/ModelStep.jsx`, `src/pages/Onboarding/Onboarding.jsx`)
   - El tracking de "qué modelo hay que persistir como default al completarse" vivía en `activeDownloadIdRef`/`previousStatesRef`, refs LOCALES a `useModelDownloadStep.js`, llamado desde `ModelStep.jsx`. Como `ModelStep` se desmonta al avanzar a otro paso del wizard (render condicional por `currentStep` en `Onboarding.jsx`), esos refs morían junto con el componente — la detección de "pasó a `installed`" dejaba de correr apenas el usuario avanzaba con la descarga en background, violando el escenario explícito del spec ("Terminar el onboarding con una descarga en curso", ONB4). Bug secundario relacionado: el ref de un solo slot (`activeDownloadIdRef`) se pisaba si el usuario cambiaba de modelo seleccionado mientras uno ya estaba descargando, perdiendo el tracking del primero.
   - **Diseño elegido**: se subió el tracking a un hook nuevo, `useOnboardingModelPersistence.js`, poseído por `Onboarding.jsx` — el único componente que permanece montado durante TODO el wizard, a diferencia de cada step individual. Expone `trackDownload(id)`, que `ModelStep.jsx` invoca (vía el nuevo prop `onDownloadStart` reenviado a `useModelDownloadStep({ onDownloadStart })`) cuando una descarga arranca con éxito. El hook elevado tiene su PROPIA suscripción a `resources.onProgress()` — independiente y paralela a la de `useModelDownloadStep` (ambas coexisten sin conflicto: `preload.js#onProgress` usa `ipcRenderer.on`/`removeListener`, que soporta múltiples listeners simultáneos sin problema) — por lo que sigue activa sin importar en qué paso del wizard esté el usuario. Usa un `Map` (id → último estado conocido) en vez de un único ref, así que soporta más de una descarga en tracking simultáneo sin pisarse. `useModelDownloadStep.js` dejó de poseer este estado por completo (se eliminaron `activeDownloadIdRef`/`previousStatesRef` y la persistencia inline en `applySnapshot`); ahora solo notifica el arranque exitoso, sin saber ni importarle quién persiste.
   - Alternativas descartadas: (a) Context de React dedicado — evaluado pero un hook simple devuelto por `Onboarding.jsx` y pasado por props alcanza para un solo consumidor (`ModelStep`) sin la ceremonia de un Provider nuevo; (b) construir ya la infraestructura completa del bocadillo global de PR4 — explícitamente fuera de alcance de esta corrección (ver instrucciones del batch), hubiera sido sobre-ingeniería para lo que este BLOCKER puntual necesita.
   - Fuera de alcance (documentado, no un defecto de esta corrección): sobrevivir un cierre completo de la app — el `Map` vive en un `useRef` de `Onboarding.jsx`, que se desmonta cuando termina/cierra el onboarding. Alcanza con sobrevivir mientras el wizard sigue abierto, que es lo que exige el escenario del spec.
   - Coincide con lo reportado por los revisores, sin hallazgos adicionales.
   - Tests nuevos: `src/tests/pages/Onboarding/Onboarding.modelPersistence.test.jsx` (archivo nuevo, 2 tests) — monta `Onboarding.jsx` real (con `ModelStep` real, NO stubeado, a diferencia de `Onboarding.test.jsx`; solo se stubea `AiConfigStep` para poder navegar más allá de "model" sin acoplar el test a esa UI) y simula el bus de `resources:progress` con múltiples listeners independientes (como el `ipcRenderer.on` real) para poder desuscribir solo el de `ModelStep` al desmontarlo y verificar que el de `Onboarding` sigue vivo. Caso 1: inicia descarga de `small`, avanza el wizard (desmonta `ModelStep`), completa la descarga vía snapshot → `updateSettings({whisperModel:'small'})` se llama igual. Caso 2: inicia `small`, cambia la selección a `medium` mid-descarga e inicia esa también, ambas completan en momentos distintos → ambas se persisten (`updateSettings` llamado 2 veces, una por cada una, sin perder la primera).

3. **CRITICAL — faltaba cobertura de test del path de fallo de carga del catálogo** (`src/tests/pages/Onboarding/useModelDownloadStep.test.jsx`, `src/tests/pages/Onboarding/ModelStep.test.jsx`)
   - No había ningún test que ejerciera `resources.list()` rechazando. El código YA manejaba el caso (`.catch(() => setStatus('error'))`, agregado en la implementación original de PR3 Fase 1) — no era un bug de lógica, solo faltaba la prueba, mismo patrón que el hallazgo #5 del fix-pass de PR1.
   - Nota sobre el caso "`resources.list` no existe" (mencionado como alternativa en el pedido): NO se agregó como caso adicional de `status: 'error'` porque, con `window.electronAPI?.resources?.list?.()`, la ausencia de la función hace que la expresión completa evalúe a `undefined` en vez de lanzar — `Promise.resolve(undefined)` RESUELVE (no rechaza), y el hook llega a `status: 'ready'` con catálogo vacío (degradación silenciosa intencional para entornos sin `electronAPI`, p. ej. preview de navegador, mismo criterio ya usado en otros hooks de este batch). Forzar `'error'` en ese caso hubiera sido un cambio de comportamiento no confirmado por los revisores, fuera del alcance de este CRITICAL (que es sobre falta de cobertura, no sobre un bug de comportamiento adicional).
   - De paso (pedido explícito del batch): los mocks de `Snapshot` en ambos archivos de test no incluían `cacheDir`/`freeBytes`/`totalBytes` (divergían del shape real que sí usan los fixtures de PR1/PR2, ver `resourceManager.js#rescan()` y `ModelsSection.test.jsx`). Se agregaron a `makeSnapshot()` en ambos archivos para que el mock refleje el contrato real, aunque el código de PR3 no los lea todavía.
   - Coincide con lo reportado por los revisores; el matiz sobre "o no existe" fue una precisión de alcance, no una discrepancia sobre el hallazgo en sí.
   - Tests nuevos: 1 en `useModelDownloadStep.test.jsx` (`status` llega a `'error'`, no queda colgado en `'loading'`) + 1 en `ModelStep.test.jsx` (`data-testid="model-step-load-error"` se renderiza con el mensaje que promete "podés continuar y descargarlo después", y el botón `model-step-next` NO queda bloqueado — ONB3).

### Test Summary (fix pass)
- **Total tests nuevos**: 6 (2 en `useModelDownloadStep.test.jsx` [Fix 1 startError] + 1 en `useModelDownloadStep.test.jsx` [Fix 3 catalog-error] − 4 tests de persistencia removidos de ese mismo archivo + 5 agregados [2 onDownloadStart + 2 startError + 1 catalog-error] = neto 8/8 en ese archivo; 4 nuevos en `ModelStep.test.jsx` [Fix 1 x2, Fix 2 wiring x1, Fix 3 x1] = 8/8 en ese archivo; 2 nuevos en `Onboarding.modelPersistence.test.jsx` [archivo nuevo, Fix 2] = 2/2)
- **Full suite**: **1283/1283 green** (1277 previos del apply original de PR3 + 6 netos nuevos)
- Ver el conteo detallado por archivo en la salida de `npx vitest run src/tests/pages/Onboarding --reporter=verbose`: `useModelDownloadStep.test.jsx` 8/8, `ModelStep.test.jsx` 8/8, `Onboarding.modelPersistence.test.jsx` 2/2 (nuevo), `Onboarding.test.jsx` 3/3 (sin cambios) — 21/21 en el directorio.

### Files Changed (fix pass)
| File | Action | What Was Done |
|------|--------|----------------|
| `src/pages/Onboarding/useOnboardingModelPersistence.js` | Created | Hook elevado: `Map` de tracking + suscripción propia a `resources.onProgress()` + `trackDownload(id)` (Fix 2) |
| `src/pages/Onboarding/useModelDownloadStep.js` | Modified | Eliminados `activeDownloadIdRef`/`previousStatesRef` y la persistencia inline en `applySnapshot` (Fix 2); nuevo parámetro `{ onDownloadStart }` y estado `startError` en `startDownload()` (Fix 1) |
| `src/pages/Onboarding/ModelStep.jsx` | Modified | Nuevo prop `onDownloadStart` reenviado al hook (Fix 2); render de `data-testid="model-start-error"` con `START_ERROR_KEY_MAP` (Fix 1) |
| `src/pages/Onboarding/Onboarding.jsx` | Modified | Usa `useOnboardingModelPersistence()`, pasa `trackDownload` como `onDownloadStart` a `<ModelStep>` (Fix 2) |
| `src/tests/pages/Onboarding/useModelDownloadStep.test.jsx` | Modified | Reescrito: removidos los 4 tests de persistencia (ahora cubiertos en `Onboarding.modelPersistence.test.jsx`), agregados tests de `onDownloadStart`/`startError`/catálogo (Fix 1, 2, 3) |
| `src/tests/pages/Onboarding/ModelStep.test.jsx` | Modified | +4 tests (Fix 1 x2, Fix 2 wiring x1, Fix 3 x1); `makeSnapshot()` extendido con `cacheDir`/`freeBytes`/`totalBytes` (Fix 3) |
| `src/tests/pages/Onboarding/Onboarding.modelPersistence.test.jsx` | Created | 2 tests de integración (Fix 2 — sobrevive desmontaje de `ModelStep`, trackea más de una descarga simultánea) |

No se tocó PR1, PR2 (ya commiteados en la branch base) ni PR4. No se hizo `git add`/`commit`/`push`/PR (regla explícita del proyecto). `tasks.md` no requirió cambios: los 3 fixes son correcciones dentro del alcance ya marcado `[x]` de PR3, no tareas nuevas.

### Status (actualizado tras fix pass)

4/4 fases de PR3 completas + fix pass post-review aplicado (2 BLOCKER + 1 CRITICAL confirmados, los 3 corregidos). Full suite 1283/1283 green. Próximo: `sdd-verify`/re-verify sobre PR3, luego PR4 (bocadillo global + hardening de los 4 selectores) cuando se retome.

---

# Apply Progress: onboarding-whisper-downloads — PR 4 Bocadillo global + hardening de los 4 selectores — COMPLETE (5/5 fases)

**Scope of this batch**: PR4 — Fase 1 a Fase 5 (`tasks.md`, bloque "PR 4 — Bocadillo global + hardening de los 4 selectores"), el último de la pila. PR1/PR2/PR3 ya estaban `[x]` completos de batches previos; no se tocó ningún archivo de esos tres salvo los 4 selectores que son alcance explícito de PR4 (`Home.jsx`, `RecordingOverlay.jsx`, `RecordingDetailWithTranscription.jsx`, `TranscriptionSection.jsx`).
**Mode**: Strict TDD (RED → GREEN → REFACTOR por tarea)

## Completed Tasks

### Fase 1: `useDownloadManager`
- [x] 1.1-1.2 — `src/hooks/useDownloadManager.js`: pull inicial `resources.getQueue()` + suscripción `resources.onProgress()` con unsubscribe en cleanup (patrón `useQueueManager.js`). Además del snapshot crudo, trackea (en un `Set` en un ref) los ids vistos en `queue` durante el "batch" actual para poder calcular visibilidad (IND1/IND5) incluso después de que un id salga de `queue` (al pasar a `installed` o `error`).

### Fase 2: `DownloadIndicator`
- [x] 2.1-2.2 — Estado contraído: nombre + % de la descarga activa (o resumen de error si no hay activa pero sí una trackeada en error).
- [x] 2.3-2.4 — Click en la cápsula contraída expande el detalle de cola + resumen "N de M descargas" (`batchTotal`/`batchDone`, calculados por `useDownloadManager`).
- [x] 2.5-2.6 — Click en el CUERPO expandido navega a Ajustes → Modelos y descargas; los botones explícitos (colapsar, cerrar, reintentar) usan `stopPropagation` para no disparar la navegación — ver Deviations #1 sobre esta interpretación del "click".
- [x] 2.7-2.8 — Botón cerrar: solo llama `onClose` (delegado a `useDownloadManager().close`), nunca `resources.cancel()`.
- [x] 2.9-2.10 — Visibilidad automática (IND5) calculada en `useDownloadManager`: visible mientras `queue.length > 0` O algún id trackeado esté en `error`; se limpia el batch (y deja de reclamar visibilidad) solo cuando AMBAS condiciones son falsas. Un id nuevo en `queue` siempre resetea `closed` a `false` (una descarga nueva reabre el bocadillo aunque el usuario lo haya cerrado antes).

### Fase 3: `BottomLeftStack` + coexistencia con `RecordingOverlay`
- [x] 3.1-3.2 — `src/components/BottomLeftStack/`: contenedor `column-reverse` genérico (sin conocimiento de sus hijos).
- [x] 3.3 — `RecordingOverlay.module.css`: clase `.inStack` neutraliza `position/bottom/left/z-index` propios; `RecordingOverlay.jsx` recibe prop `inStack` (default `false`, backward-compatible).
- [x] 3.4 — `App.jsx`: `useDownloadManager()` montado a nivel de app (siempre activo, incluso con el bocadillo oculto — necesario para detectar descargas nuevas y reabrir tras un cierre); `<BottomLeftStack>` envuelve `RecordingOverlay` (con `inStack`) y `DownloadIndicator`, montados en ESE orden — con `column-reverse`, el primer hijo en DOM queda al fondo del stack, así que `RecordingOverlay` primero + `DownloadIndicator` después coloca el bocadillo VISUALMENTE ENCIMA del overlay, tal como pide D9.

### Fase 4: Hardening de los 4 selectores (solo-instalados, INV6)
- [x] 4.1-4.2 — `Home.jsx` (`handleTranscribe`, `handleConfirmImport`): antes de encolar, resuelve `settings.whisperModel` (o `'small'`) y confirma que esté `installed` vía `resolveTranscribableModel()`. Si no lo está, `window.confirm(t('home.noModelInstalledConfirm'))` → si acepta, navega a Ajustes → Modelos y descargas (`onSettings('general', 'models-and-downloads-section')`); si no, no hace nada. Nunca encola.
- [x] 4.3-4.4 — `RecordingOverlay.jsx` (`handleSaveDetails`, auto-transcripción al guardar): mismo `resolveTranscribableModel()`, reutilizando el `settings` ya cargado (sin round-trip IPC extra). Si el modelo no está instalado, se omite el encolado con un `console.warn` — **sin diálogo bloqueante** (ver Deviations #2, decisión de producto documentada explícitamente).
- [x] 4.5-4.6 — `RecordingDetailWithTranscription.jsx`: eliminado el array `whisperModels` hardcodeado sin i18n (L62-68 original); nuevo estado `whisperModelItems` poblado vía `resources.list()` en `handleReTranscribeClick()` (refresca cada vez que se abre el modal, D10) — si el modelo previamente seleccionado ya no está instalado, se autoselecciona el primer modelo instalado disponible. El `<select>` usa `buildSelectableModelOptions()` (opciones no instaladas quedan `disabled`); el botón "Start Transcription" queda `disabled` si el modelo seleccionado no está instalado; si NINGÚN modelo está instalado, aparece un CTA de texto clickeable que cierra el modal y navega a Ajustes → Modelos y descargas (`onNavigateToSettings('general', 'models-and-downloads-section')` — requirió extender la firma de esa prop en `App.jsx` para reenviar el segundo argumento `targetElement`, antes se descartaba).
- [x] 4.7-4.8 — `TranscriptionSection.jsx`: reemplazado el consumo de `whisperModels` (ya "aplanado", sin info de instalación) por `modelCatalog` crudo + `buildSelectableModelOptions()` — opciones no instaladas quedan `disabled` con etiqueta "(no instalado — ir a Ajustes)"; si NINGÚN modelo está instalado, aparece un texto de ayuda (`data-testid=whisper-model-none-installed-cta`) señalando la sección "Modelos y descargas" más abajo EN LA MISMA página (sin necesidad de navegación — ya están en Ajustes → General).
- [x] 4.9-4.10 — Auditoría transversal: `rg -n "resources\.download" Home.jsx RecordingOverlay.jsx RecordingDetailWithTranscription.jsx TranscriptionSection.jsx` → cero resultados en los 4 archivos. Cubierto explícitamente por test en `TranscriptionSection.test.jsx` ("never triggers a download when the selection changes") y por diseño en los otros 3 (ninguno tiene código que invoque `resources.download`).

### Fase 5: Defaults y documentación
- [x] 5.1 — `src/services/settingsService.js`: `whisperModel: 'small'` agregado al objeto de defaults de `getSettings()` (antes ausente — el fallback `settings.whisperModel || 'small'` disperso en varios call-sites ya asumía esto implícitamente, ahora es explícito y consultable por `resolveTranscribableModel()`/`TranscriptionSection`/`ModelStep` sin depender de que cada call-site repita el `|| 'small'`).
- [x] 5.2 — Claves i18n nuevas (es/en): `downloadIndicator.{title,activeLabel,errorLabel,summary}`, `settings.whisperModels.notInstalledSuffix`, `settings.helpText.whisperModelNoneInstalled`, `home.noModelInstalledConfirm`.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1-1.2 | `src/tests/hooks/useDownloadManager.test.jsx` | Unit (hook, jsdom) | N/A (new) | ✅ Written | ✅ 7/7 passed | ✅ visible/hidden, IND4 close, IND5 auto-hide, IND5 stays-visible-on-error, IND1-over-close re-open | ➖ None needed |
| 2.1-2.10 | `src/tests/components/DownloadIndicator.test.jsx` | Unit (component, jsdom) | N/A (new) | ✅ Written | ✅ 6/6 passed | ✅ collapsed label, expand+summary, navigate-except-close, close-no-cancel, error-summary+retry(not download) | ➖ None needed |
| 3.1-3.2 | `src/tests/components/BottomLeftStack.test.jsx` | Unit (component, jsdom) | N/A (new) | ✅ Written | ✅ 2/2 passed | ✅ two children (DOM order) + single child | ➖ None needed (purely structural container) |
| 4.1-4.2, 4.3-4.4 | `src/tests/utils/resolveTranscribableModel.test.jsx`, `src/tests/utils/whisperModelGuard.test.js` | Unit (pure, DI) | N/A (new) | ✅ Written | ✅ 6/6 + 11/11 passed | ✅ installed/not-installed/unknown-id/null-guard/fails-closed-on-reject/fails-closed-on-ok-false/default-window.electronAPI | ➖ None needed — ver Deviations #3 sobre por qué NO se montó `Home.jsx`/`RecordingOverlay.jsx` completos |
| 4.5-4.6 | `src/tests/utils/whisperModelGuard.test.js` (`buildSelectableModelOptions`) | Unit (pure) | N/A (new) | ✅ Written | ✅ (incluido en los 11/11 de arriba) | ✅ disabled flag + label distinto para no-instalados + catálogo vacío/null | ➖ None needed — ver Deviations #3 sobre `RecordingDetailWithTranscription.jsx` |
| 4.7-4.8 | `src/tests/pages/Settings/components/GeneralTab/TranscriptionSection.test.jsx` | Unit (component, jsdom) | N/A (primer test file de este componente) | ✅ Written | ✅ 4/4 passed | ✅ disabled options, onChange nunca descarga, CTA visible sin instalados, CTA ausente con al menos 1 instalado | ➖ None needed |
| 5.1 | `src/tests/services/settingsService.test.jsx` | Unit | N/A (primer test file de este servicio) | ✅ Written | ✅ 1/1 passed | ➖ Triangulación innecesaria (tarea puramente estructural — un solo campo default, un solo resultado posible) — "Triangulation skipped: constant/default value addition, no branching" | ➖ None needed |

### Test Summary (this batch)
- **Total tests written**: 37 (7 useDownloadManager + 6 DownloadIndicator + 2 BottomLeftStack + 11 whisperModelGuard + 6 resolveTranscribableModel + 4 TranscriptionSection + 1 settingsService)
- **Total tests passing**: 37/37 (new). Full suite: **1320/1320 green** (1283 pre-existing tras fix pass PR3 + 37 nuevos).
- **Layers used**: Unit/hook-jsdom (7), Unit/component-jsdom (12), Unit/pure-DI (18)
- **Approval tests** (refactoring): None — `TranscriptionSection.jsx`/`RecordingDetailWithTranscription.jsx`/`Home.jsx`/`RecordingOverlay.jsx` son cambios aditivos+wiring sobre comportamiento existente, verificados por la suite completa quedando verde (sin regresiones) en vez de approval tests dedicados, dado que ninguno tenía test previo que capturar.
- **Pure functions created**: `isModelInstalled`, `hasAnyInstalledModel`, `buildSelectableModelOptions` (`whisperModelGuard.js`); `resolveTranscribableModel` (composición async con inyección de dependencias, no 100% pura pero sin mocks de infraestructura)

## Deviations from Design

1. **Interpretación del "click" de `DownloadIndicator` (IND2 vs IND3)**: el spec/tasks.md pide simultáneamente "click en contraído lo expande" (IND2) y "click navega a Ajustes... excepto botón cerrar" (IND3) sin distinguir contraído/expandido explícitamente. Implementado como progresión: click en la CÁPSULA CONTRAÍDA → expande (consistente con el propio `RecordingOverlay` minimizado, que también expande al click); click en el CUERPO EXPANDIDO → navega a Ajustes. Los botones explícitos (colapsar/cerrar/reintentar) siempre `stopPropagation`. Es una interpretación defendible y no ambigua de un requisito que, leído literalmente, sería contradictorio si se aplicara "click siempre navega" también al estado contraído (nunca se podría expandir).

2. **`RecordingOverlay.jsx` (auto-transcripción al guardar) NO muestra un diálogo bloqueante cuando el modelo no está instalado**, a diferencia de `Home.jsx` (que sí usa `window.confirm`). Decisión de producto explícita: este disparo es automático (parte del flujo "Guardar y Salir" de una grabación recién terminada), no una acción explícita de "transcribir" iniciada por el usuario — interrumpirlo con un diálogo de confirmación en medio de ese flujo sería intrusivo. Se omite el encolado (no se rompe la regla "no se encola") y se deja un `console.warn` accionable para debugging; el usuario puede transcribir manualmente más tarde desde Home, que SÍ muestra el CTA. Documentado explícitamente porque el batch pidió "mismo criterio" en los 4 puntos — este es el único de los 4 que se aparta del patrón de diálogo bloqueante, con motivo de UX razonado, no un descuido.

3. **Ningún test monta `Home.jsx`, `RecordingOverlay.jsx` o `RecordingDetailWithTranscription.jsx` completos.** Los tres son archivos grandes y preexistentes con 7+ dependencias externas cada uno (`recordingsService`, `recordingAiService`, `providerRouter`, `audioService`, múltiples proveedores de IA, `ragService`, etc.) — montarlos violaría la regla de higiene de mocks de `strict-tdd.md` ("7+ mocks → STOP, estás testeando en la capa equivocada"). Aplicado el mismo criterio Extract-Before-Mock ya usado en PR2 (`whisperModelCatalog.js`) y PR3 (hooks aislados): la lógica de DECISIÓN (¿está instalado el modelo?, ¿qué opciones mostrar atenuadas?) se extrajo a `src/utils/whisperModelGuard.js` (pura) y `src/utils/resolveTranscribableModel.js` (async con inyección de dependencias), ambos testeados exhaustivamente SIN mocks de framework. El wiring dentro de los 3 componentes grandes es deliberadamente delgado (pocas líneas, llama a las funciones ya testeadas) y se verificó por: (a) syntax check (`esbuild`) antes de correr la suite, (b) lectura manual del diff, (c) la suite completa quedando 1320/1320 verde (ningún test preexistente de estos archivos se rompió porque no existían — no hay regresión posible en ese sentido, pero tampoco hay cobertura de regresión FUTURA sobre el wiring exacto). Riesgo residual documentado: un futuro refactor accidental de `handleReTranscribeClick`/`handleTranscribe`/`handleSaveDetails` que rompa la llamada a la función guardia no sería detectado por un test automático hasta que alguien agregue cobertura de montaje completo de estos 3 componentes (fuera de alcance de PR4).

4. **`ModelsSection.jsx` recibió `id="models-and-downloads-section"`** (no pedido explícitamente en las tareas de Fase 4/5, pero necesario para que el patrón de navegación con anchor ya usado en la app — `handleOpenSettings(tab, targetElement)` + `Settings.jsx`'s `scrollIntoView` por `getElementById` — funcione desde el bocadillo global, `Home.jsx` y `RecordingDetailWithTranscription.jsx`). Sin este `id`, los 3 CTAs de navegación cruzada quedarían rotos (navegarían a la pestaña "General" pero sin hacer scroll a la sección correcta).

5. **`App.jsx`'s `onNavigateToSettings` para `RecordingDetailWithTranscription` extendido** de `(tab) => handleOpenSettings(tab)` a `(tab, targetElement) => handleOpenSettings(tab, targetElement)` — cambio de una línea, necesario para que el nuevo CTA de la Fase 4.6 pueda pasar el `targetElement` (antes se descartaba silenciosamente, aunque ningún consumidor previo lo necesitaba).

6. **`SettingsContext.jsx`'s `whisperModels` (contexto ya computado, `computeWhisperModelOptions`) quedó sin consumidores** tras el cambio de Fase 4.7-4.8 (`TranscriptionSection.jsx` ahora usa `modelCatalog` crudo + `buildSelectableModelOptions` directamente, porque necesita el `.state` de cada item para atenuar). Se DEJÓ el campo en el valor de contexto (no se borró) — quitar un valor de la API pública de `SettingsContext` es un cambio arquitectónico más amplio no pedido por `tasks.md`, y `computeWhisperModelOptions`/`whisperModelCatalog.js` (PR2) siguen teniendo su propia cobertura de test intacta.

## Decisión de consolidación: `useOnboardingModelPersistence` vs `useDownloadManager` global

**Decisión: NO consolidar. Se mantienen como hooks independientes, con suscripciones paralelas a `resources.onProgress()`.**

**Evaluación explícita pedida por el batch — ¿es un problema real o están bien así?**

1. **¿Hay riesgo técnico de duplicación/inconsistencia por dos (ahora tres, contando `useDownloadManager`) suscripciones paralelas al mismo evento IPC?** No. `preload.js#onProgress` usa `ipcRenderer.on('resources:progress', wrapped)` / `removeListener` — el `EventEmitter` nativo de Electron soporta N listeners independientes sobre el mismo canal sin conflicto; cada uno recibe el mismo snapshot y mantiene su PROPIO estado local completamente aislado (esto ya se validó y quedó documentado en el fix pass BLOCKER #2 de PR3, cuando `useOnboardingModelPersistence` se elevó precisamente para coexistir con la suscripción de `useModelDownloadStep`). Agregar una tercera suscripción (`useDownloadManager`, ahora en `App.jsx`) no introduce ningún riesgo nuevo de esa clase.

2. **¿Son responsabilidades semánticamente distintas, o es la misma lógica duplicada dos veces?** Son distintas, y consolidarlas sería una REGRESIÓN funcional, no una simplificación:
   - `useOnboardingModelPersistence`: regla de negocio ACOTADA a un origen específico — "si ESTA descarga fue iniciada explícitamente desde el paso de onboarding (`trackDownload(id)` llamado por `ModelStep`), y termina bien, conviértela en el modelo por defecto". Es un opt-in explícito por origen.
   - `useDownloadManager`: hook GLOBAL, agnóstico al origen — trackea CUALQUIER descarga que aparezca en la cola (iniciada desde onboarding, desde Ajustes → Modelos y descargas, o desde cualquier punto futuro), solo para fines de UI (mostrar/ocultar el bocadillo, progreso, error). No tiene ni debería tener opinión sobre si debe persistirse como default.
   - Si `useDownloadManager` absorbiera la persistencia, CUALQUIER descarga completada en cualquier parte de la app (p. ej. un usuario que en Ajustes descarga `medium` solo para tenerlo disponible, sin intención de cambiar su modelo por defecto) sobrescribiría silenciosamente `settings.whisperModel` — esto contradice el diseño ya implementado y revisado de `ModelsSection.jsx` (PR2), que deliberadamente NO cambia `whisperModel` al completar una instalación (el usuario cambia su default explícitamente desde el `<select>` de `TranscriptionSection`).

3. **Conclusión**: no hay beneficio real en unificar — solo se compartiría el nombre del evento IPC que escuchan, no la lógica de negocio. Mantenerlos separados es la opción MÁS SEGURA (menos acoplamiento entre un flujo de onboarding acotado y un hook global de UI) y ya está validada en producción de código (PR3's fix pass) como un patrón sin efectos secundarios.

## Issues Found

None blocking. `npm test` (`vitest run`) — full suite: **1320/1320 green**.

## Files Changed (this batch)

| File | Action | What Was Done |
|------|--------|----------------|
| `src/hooks/useDownloadManager.js` | Created | Hook global: pull inicial + suscripción + visibilidad automática (IND1/IND4/IND5) |
| `src/components/DownloadIndicator/DownloadIndicator.jsx` + `.module.css` | Created | Bocadillo contraído/expandido, navegación, cerrar, reintentar |
| `src/components/BottomLeftStack/BottomLeftStack.jsx` + `.module.css` | Created | Contenedor `column-reverse` compartido |
| `src/components/RecordingOverlay/RecordingOverlay.jsx` | Modified | Prop `inStack` (default `false`) |
| `src/components/RecordingOverlay/RecordingOverlay.module.css` | Modified | Clase `.inStack` |
| `src/App.jsx` | Modified | Monta `useDownloadManager()` + `BottomLeftStack` (`RecordingOverlay` + `DownloadIndicator`); extiende `onNavigateToSettings` de `RecordingDetailWithTranscription` para reenviar `targetElement` |
| `src/utils/whisperModelGuard.js` | Created | `isModelInstalled`, `hasAnyInstalledModel`, `buildSelectableModelOptions` — lógica pura compartida por los 4 selectores |
| `src/utils/resolveTranscribableModel.js` | Created | Resuelve `settings.whisperModel` + confirma instalación, con inyección de dependencias (usado por `Home.jsx`/`RecordingOverlay.jsx`) |
| `src/pages/Home/Home.jsx` | Modified | `handleTranscribe`/`handleConfirmImport`: guardia INV6 + CTA (`window.confirm` → `onSettings`) |
| `src/components/RecordingOverlay/RecordingOverlay.jsx` | Modified | `handleSaveDetails`: guardia INV6 sin diálogo bloqueante (ver Deviations #2) |
| `src/pages/RecordingDetail/RecordingDetailWithTranscription.jsx` | Modified | Eliminado catálogo hardcodeado sin i18n; inventario dinámico + opciones atenuadas + botón deshabilitado + CTA de navegación |
| `src/pages/Settings/components/GeneralTab/TranscriptionSection.jsx` | Modified | Opciones atenuadas vía `buildSelectableModelOptions(modelCatalog, t)` + CTA in-page |
| `src/pages/Settings/components/GeneralTab/ModelsSection.jsx` | Modified | `id="models-and-downloads-section"` (target de los CTAs de navegación) |
| `src/services/settingsService.js` | Modified | `whisperModel: 'small'` en defaults |
| `src/i18n/locales/es.json`, `src/i18n/locales/en.json` | Modified | Claves nuevas: `downloadIndicator.*`, `settings.whisperModels.notInstalledSuffix`, `settings.helpText.whisperModelNoneInstalled`, `home.noModelInstalledConfirm` |
| `src/tests/hooks/useDownloadManager.test.jsx` | Created | 7 tests |
| `src/tests/components/DownloadIndicator.test.jsx` | Created | 6 tests |
| `src/tests/components/BottomLeftStack.test.jsx` | Created | 2 tests |
| `src/tests/utils/whisperModelGuard.test.js` | Created | 11 tests |
| `src/tests/utils/resolveTranscribableModel.test.jsx` | Created | 6 tests |
| `src/tests/pages/Settings/components/GeneralTab/TranscriptionSection.test.jsx` | Created | 4 tests (primer test file de este componente) |
| `src/tests/services/settingsService.test.jsx` | Created | 1 test (primer test file de este servicio) |
| `openspec/changes/onboarding-whisper-downloads/tasks.md` | Modified | PR4 Fase 1-5 marcadas `[x]` (con notas de Deviation en 4.1/4.3/4.5) |

### Files Changed (fix pass post-review)

| File | Action | What Was Done |
|------|--------|----------------|
| `src/hooks/useDownloadManager.js` | Modified | Bug fix: `batchDone` cuenta solo `state==='installed'`, no "salió de `queue`" |
| `src/tests/hooks/useDownloadManager.test.jsx` | Modified | Assertions nuevas de `batchDone`/`batchTotal` en el escenario mixto instalado+error (sin test nuevo) |
| `src/tests/components/BottomLeftStack.test.jsx` | Modified | +3 tests: composición REAL (`RecordingOverlay`+`DownloadIndicator`, no stubs) en los 3 escenarios (IND6) |
| `src/tests/components/RecordingOverlay.test.jsx` | Created | 2 tests: wiring INV6 de `handleSaveDetails` (feliz + sin-modelo-instalado) |
| `src/tests/pages/Home/Home.test.jsx` | Created | 2 tests: wiring INV6 de `handleTranscribe` (feliz + sin-modelo-instalado) |
| `src/tests/pages/RecordingDetail/RecordingDetailWithTranscription.test.jsx` | Created | 2 tests: wiring INV6 del modal de re-transcripción (botón deshabilitado + CTA) |

## Status (PR4 — cierre del change)

5/5 fases completas de PR4 (Fase 1-5, tareas 1.1-5.2, todas `[x]`). Full suite **1320/1320 green**. Este era el ÚLTIMO PR de la pila de 4 (`gh stack`, `stacked-to-main`) — con PR4 completo, el change `onboarding-whisper-downloads` (issue #149) queda funcionalmente completo end-to-end: núcleo IPC (PR1), Ajustes → Modelos y descargas (PR2), paso de onboarding (PR3), y bocadillo global + hardening de selectores (PR4). No se hizo `git add`/`commit`/`push`/PR (regla explícita del proyecto) — queda a cargo del usuario. Próximo recomendado: `sdd-verify` sobre PR4 (y idealmente una pasada de judgment-day igual que en PR1/PR2/PR3, dado el patrón ya establecido de encontrar BLOCKER/CRITICAL reales en cada PR previo).

## Fix pass PR4 post-review (2 CRITICAL + 1 bug real) — todos confirmados y corregidos

4 revisores en fresco (judgment-day) encontraron 2 CRITICAL (huecos de cobertura de cero verificación automática, no bugs de comportamiento) y 1 defecto de comportamiento real (reportado como WARNING pero corregido como bug). La deuda de duplicación entre hooks (4ta reimplementación de boilerplate `resources.*`, canal IPC `resources:get-queue` duplicado de `resources:list`) quedó explícitamente FUERA de este pase — pendiente como issue aparte.

1. **CRITICAL — IND6 (bocadillo + `RecordingOverlay` conviviendo) sin ningún test que montara la composición REAL.** El único test existente (`BottomLeftStack.test.jsx`) usaba stubs genéricos (`<div data-testid=...>`), nunca `RecordingOverlay`/`DownloadIndicator` reales — la neutralización de `position/bottom/left` vía la clase `.inStack` estaba verificada solo por lectura manual. **Fix**: nueva `describe` en `BottomLeftStack.test.jsx` que monta `RecordingOverlay` (con `inStack`) y `DownloadIndicator` REALES (no stubs) en los 3 escenarios — solo grabación, solo descarga, ambas a la vez — y verifica `classList.contains(overlayStyles.inStack)` en el DOM real (comparando contra el mismo import de `RecordingOverlay.module.css` que usa el componente, para que el hash de CSS Modules coincida sin necesidad de computar estilos). Requirió mockear `react-redux` (`useDispatch`) y `services/settingsService` (`getSettings`, para que el `useEffect` de diarización de `RecordingOverlay` no dispare un `getSettings()` real sin `window.electronAPI`) — mismo criterio de higiene de mocks ya usado en el resto de PR4.
2. **CRITICAL — wiring de los 3 selectores grandes (`Home.jsx`, `RecordingOverlay.jsx`, `RecordingDetailWithTranscription.jsx`) sin ningún test de integración.** Solo la lógica PURA reutilizada (`resolveTranscribableModel.js`, `whisperModelGuard.js`) tenía cobertura exhaustiva (Deviation #3 original) — el wiring que las invoca desde los 3 componentes reales nunca se había montado ni una vez. **Fix**: 3 archivos nuevos, cada uno monta el componente REAL con Extract-Before-Mock aplicado a sus dependencias pesadas no relacionadas (IA, chat, RAG, audio):
   - `src/tests/components/RecordingOverlay.test.jsx` (2 tests): camino feliz (modelo instalado → `recordingsService.transcribeRecording` se llama al completar el flujo "detener y guardar" → "Guardar y salir") y camino sin-modelo-instalado (omite el encolado con `console.warn`, confirma que NUNCA llama a `window.confirm` — Deviation #2 sigue vigente).
   - `src/tests/pages/Home/Home.test.jsx` (2 tests): camino feliz (`window.electronAPI.transcribeRecording` se llama directo, sin `window.confirm`) y camino sin-modelo-instalado (`window.confirm(t('home.noModelInstalledConfirm'))` → acepta → `onSettings('general','models-and-downloads-section')`, nunca encola).
   - `src/tests/pages/RecordingDetail/RecordingDetailWithTranscription.test.jsx` (2 tests): abre el modal de re-transcripción real vía el menú de acciones y verifica `disabled={!selectedInstalled}` en el botón "Start Transcription" + que el CTA (`retranscribe-no-model-cta`) cierra el modal y navega a Ajustes.
   - Gotcha de montaje: `RecordingDetailWithTranscription.jsx` importa estáticamente `TranscriptionChatTab` (que a su vez importa `ChatInterface.jsx` → `chatCommands.js`) aunque `activeTab==='overview'` por defecto nunca lo renderice — un import estático se evalúa igual. `chatCommands.js` necesita `MIN_COMPACT_HISTORY_MESSAGES`/`MIN_SUMMARY_HISTORY_MESSAGES` de `services/chat/chatTokens.js` — mockear ese módulo (como se intentó al principio) rompe el import estático porque el mock no re-exporta esas constantes. Se dejó `chat/chatTokens.js`/`chat/chatHistory.js` SIN mockear (son módulos puros sin I/O ni dependencias pesadas) y solo se mockeó `hooks/useChatCommands` (el hook que sí ejecuta lógica de chat).
3. **Bug real — `batchDone`/`batchTotal` en `useDownloadManager.js` contaba descargas fallidas como completadas.** `batchDone = trackedIds.length - queue.length` contaba cualquier ítem que salió de `queue`, sin importar si terminó en `installed` (éxito) o `error` (fallo) — con 1 instalado + 1 error de 2 trackeados, el bocadillo mostraba "2 de 2" en vez de "1 de 2". **Fix** (`src/hooks/useDownloadManager.js`): `batchDone` ahora filtra `trackedIds` por `item?.state === 'installed'` — los ítems en `error` siguen contando en `batchTotal` pero no en `batchDone`. Ajustado el test existente ("stays visible with an actionable error... IND5", `useDownloadManager.test.jsx`) con assertions explícitas: `batchTotal` 2, `batchDone` 1 en ese escenario mixto. No se tocó `DownloadIndicator.jsx` — ya consumía `batchDone`/`batchTotal` correctamente, el bug estaba solo en el cálculo del hook.

**Test Summary (fix pass)**: 9 tests nuevos (3 BottomLeftStack + 2 RecordingOverlay + 2 Home + 2 RecordingDetailWithTranscription) + 1 test existente reforzado con assertions nuevas (sin sumar al conteo). Full suite: **1329/1329 green** (1320 + 9).

No se tocó PR1/PR2/PR3. No se tocó la deuda de duplicación (`resources:get-queue`, 4ta reimplementación del hook `resources.*`) — queda pendiente como issue aparte, tal como se pidió. No `git add`/`commit`/`push` (regla explícita del proyecto).
