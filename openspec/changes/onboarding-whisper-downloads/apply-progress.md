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
