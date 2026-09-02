# Tasks: Gestión explícita de descargas de modelos Whisper (issue #149)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | PR1 ~1600-2000 · PR2 ~400-500 · PR3 ~350-450 · PR4 ~800-1000 |
| 400-line budget risk | PR1 High · PR2 Medium · PR3 Medium · PR4 High |
| Chained PRs recommended | Yes (ya resuelto: 4 PRs vía `gh stack`) |
| Suggested split | PR1 → PR2 → PR3 → PR4 (partición fijada por el usuario, no reabrir) |
| Delivery strategy | Partición y mecanismo de entrega ya decididos antes de este `sdd-tasks` (no aplica `ask-on-risk`) |
| Chain strategy | `stacked-to-main` (gh stack retarget automático al mergear la base) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

**Nota sobre PR1 y PR4**: exceden individualmente los 400 líneas incluso dentro de la partición fijada de 4 PRs. No se proponen más PRs (decisión ya tomada). Mitigación: aplicar work-unit commits por fase (cada fase de este documento = 1 commit atómico revisable dentro del mismo PR), y que el reviewer humano evalúe cada PR grande bajo el criterio de `size:exception` documentado en la descripción del PR (cohesión funcional: PR1 es la única forma de tener el núcleo verificable por IPC sin UI a medias; PR4 es la única forma de no dejar el bocadillo y los 4 selectores en estados inconsistentes).

### Suggested Work Units

| Unit | Goal | Likely PR | Base (gh stack) | Notes |
|------|------|-----------|------------------|-------|
| 1 | Núcleo: Python download + `resourceManager` + IPC `resources:*` + catálogo + espacio + validación PyInstaller | PR 1 | tronco/main (primer PR de la pila) | Sin UI nueva; verificable end-to-end por IPC/tests |
| 2 | Ajustes → Modelos y descargas + `DiskSpaceIndicator` + guardia de borrado UI | PR 2 | PR 1 | Depende de contrato IPC de PR1 |
| 3 | Paso de onboarding "Modelo de transcripción" | PR 3 | PR 2 | Depende funcionalmente solo de PR1; se apila sobre PR2 por orden de pila |
| 4 | Bocadillo global + hardening de los 4 selectores | PR 4 | PR 3 | Depende de PR1 (IPC) y PR2 (patrón de guardias); último de la pila |

## Leyenda de requisitos

`INV*` = `whisper-model-inventory` · `DL*` = `whisper-model-downloads` · `ONB*` = `onboarding-model-selection` · `IND*` = `download-status-indicator`

INV1 Catálogo versionado · INV2 Migración `large→large-v3` · INV3 Adopción caché SO · INV4 Caché gestionada por la app · INV5 `DiskSpaceIndicator` · INV6 Fuente única para selectores
DL1 Validación de espacio · DL2 Cola con progreso · DL3 Cancelar · DL4 Reintentar · DL5 Borrado con guardia
ONB1 Paso independiente · ONB2 Preselección `small` · ONB3 Paso no bloqueante · ONB4 Persistir default
IND1 Visibilidad global · IND2 Contraído/expandido · IND3 Click abre Ajustes · IND4 Cerrar no cancela · IND5 Ocultamiento automático · IND6 Coexistencia con `RecordingOverlay`

---

## PR 1 — Núcleo (Python + Electron main + IPC, sin UI)

**Chain Context**: 📍 PR 1 de 4 · Base: main/tronco · Sin dependencias previas · Habilita PR2/PR3/PR4 · Fuera de alcance: cualquier componente React.

### Fase 1: Catálogo y escaneo de caché HF

- [x] 1.1 [RED] Test `test/unit/electron/services/resources/modelCatalog.test.js` (nuevo): el catálogo expone `tiny/base/small/medium/large-v3` con `id/repoId/estimatedBytes/recommended` — INV1
- [x] 1.2 [GREEN] Crear `electron/services/resources/modelCatalog.js` — catálogo estático versionado — INV1
- [x] 1.3 [RED] Test `test/unit/electron/services/resources/hfCacheScanner.test.js` (nuevo): fixture de árbol HF en `tmpdir` — modelo `installed` válido, `.incomplete` → no instalado, dedupe de tamaño por realpath — INV3, INV4
- [x] 1.4 [GREEN] Crear `electron/services/resources/hfCacheScanner.js` — algoritmo D3 (`refs/main→sha→snapshots`, `fs.realpathSync`, dedupe) — INV3, INV4

### Fase 2: Descargador Python + dispatch

- [x] 2.1 [GREEN] Crear `python/model_resources.py` — subcomandos `scan`/`download`/`delete`; `download` usa `snapshot_download` + `tqdm_class` propio → `PROGRESS:`/`DONE:`/`ERROR:`; `delete` usa `scan_cache_dir().delete_revisions().execute()` — DL1, DL2, DL3, DL4, DL5
- [x] 2.2 [GREEN] Modificar `python/audio_sync_analyzer.py`: dispatch temprano `resources` tras `freeze_support()`; borrar `WHISPER_MODEL="large"` (L49); `--model` `required=True` sin default; nuevo `--model_cache_dir`; `load_whisper_model()` con `download_root=args.model_cache_dir, local_files_only=True`; `ERROR:MODEL_NOT_INSTALLED::{model}` si falta (D8) — INV4, DL1
- [x] 2.3 [GREEN] Modificar `python/audio_sync_analyzer.spec` — añadir a `hiddenimports`: `model_resources`, `requests`, `tqdm`, `filelock`, `fsspec`, `huggingface_hub.utils`

Sin infraestructura de test Python en el repo: 2.1-2.2 se verifican manualmente en Fase 6 (validación PyInstaller) y por los tests de Node que ejercitan el contrato stdout.

### Fase 3: `resourceManager` (cola, espacio, cancelación, reintento, borrado)

- [x] 3.1 [RED] Test `test/unit/electron/services/resourceManager.test.js` (nuevo): `checkSpace` con `fs.statfsSync` mockeado — suficiente / justo / insuficiente — DL1
- [x] 3.2 [GREEN] Implementar `resourceManager.checkSpace(id)` — `freeBytes = bavail*bsize`, `requiredBytes = catalog[id].bytes + 500MB` — DL1
- [x] 3.3 [RED] Test: cola serie — 2 descargas encoladas, solo 1 activa, progreso individual + global — DL2
- [x] 3.4 [GREEN] Implementar cola serie + spawn `audio_sync_analyzer resources download` + parseo `PROGRESS:`/`DONE:`/`ERROR:` (extiende patrón `transcriptionManager.js:257`) — DL2
- [x] 3.5 [RED] Test: cancelación — entrada activa → `SIGTERM`→`SIGKILL` a 3s + barrido `.incomplete`; entrada en cola → removida sin spawn — DL3
- [x] 3.6 [GREEN] Implementar `resourceManager.cancel(id)` (D6) — DL3
- [x] 3.7 [RED] Test: reintento — descarga `error` → `retry` limpia parciales y relanza desde estado limpio — DL4
- [x] 3.8 [GREEN] Implementar `resourceManager.retry(id)` reutilizando el flujo de `download()` tras limpieza — DL4
- [x] 3.9 [RED] Test: guardia de borrado — bloquea si `id === settings.whisperModel`; bloquea si hay tarea `pending`/`processing` en `transcription_queue` (BD en memoria, patrón `test/unit/electron/database/*`) — DL5
- [x] 3.10 [GREEN] Implementar `resourceManager.delete(id)` con guardia (`reason: 'default-model'|'in-queue'`) + spawn `resources delete` — DL5
- [x] 3.11 [RED] Test: `resolveCacheDir()` resuelve `HF_HUB_CACHE` → `HF_HOME/hub` → default OS (D2) — INV4
- [x] 3.12 [GREEN] Implementar `resourceManager.resolveCacheDir()` — INV4
- [x] 3.13 [RED] Test: snapshot inicial al arrancar detecta modelos válidos en caché existente y los marca `installed` sin descargar — INV3
- [x] 3.14 [GREEN] Implementar inicialización de `resourceManager` (snapshot inicial) — INV3, INV1

### Fase 4: IPC `resources:*`

- [x] 4.1 [RED] Test `test/unit/electron/ipc-handlers/resources.test.js` (nuevo, patrón `wiki.test.js`): `list/refresh/check-space/download/cancel/delete/get-queue` devuelven `{ok,...}` sin lanzar — INV1, DL1-DL5
- [x] 4.2 [GREEN] Crear `electron/ipc-handlers/resources.js` — `registerResourcesHandlers()` — INV1, DL1-DL5
- [x] 4.3 [RED] Extender `test/unit/electron/preload.test.js`: namespace `resources` expone `list/refresh/checkSpace/download/cancel/remove/getQueue/onProgress` con unsubscribe — DL2
- [x] 4.4 [GREEN] Modificar `electron/preload.js` — namespace `resources` (patrón `wiki:160`/`templates:396`) — DL2
- [x] 4.5 [GREEN] Modificar `electron/main.js` — `registerResourcesHandlers()` (L106-127) + broadcast `resources:progress` throttle 250ms (L250-261) — DL2, IND1

### Fase 5: Integración con transcripción + migración de settings

- [x] 5.1 [RED] Test: `migrateWhisperModelAlias` remapea `large→large-v3`, idempotente si ya es `large-v3` — `test/unit/electron/utils/settingsMigrations.test.js` — INV2
- [x] 5.2 [GREEN] Implementar `migrateWhisperModelAlias(settings)` en `electron/utils/settingsMigrations.js` (patrón `migrateGeminiFreeTier`) — INV2
- [x] 5.3 [RED] Test: `transcriptionManager` bloquea el spawn si `resourceManager.isInstalled(model)` es `false`, error accionable, sin encolar — INV6, DL1
- [x] 5.4 [GREEN] Modificar `electron/services/transcriptionManager.js` — bloqueo pre-spawn + `--model_cache_dir` (L306-311) — INV6, DL1

### Fase 6: Documentación obligatoria y validación bloqueante

- [x] 6.1 [GREEN] Actualizar `electron/README.md` (Sección IPC/Comunicación) — documentar canal `resources:*`
- [x] 6.2 [GREEN] Actualizar `README.md` raíz (Sección Pipeline de Transcripción) — `model_resources.py`, dispatch, `local_files_only`
- [x] 6.3 **Bloqueante**: ejecutar `npm run electron:build:dir` y correr `audio_sync_analyzer resources scan` desde el binario empaquetado; confirmar que `huggingface_hub`/`requests`/`tqdm` cargan sin `ModuleNotFoundError`

**Entrega PR1**: `gh stack` — primer PR de la pila, base = main/tronco.

---

## PR 2 — Ajustes → Modelos y descargas

**Chain Context**: 📍 PR 2 de 4 · Base: PR 1 · Depende de: contrato IPC `resources:*` (PR1) · Habilita: PR4 (guardia de selectores) · Fuera de alcance: bocadillo global, onboarding.

### Fase 1: Catálogo en `SettingsContext`

- [x] 1.1 [RED] Test: `SettingsContext` obtiene el catálogo de modelos vía `resources.list()` (IPC), no de lista estática — INV1, INV6
- [x] 1.2 [GREEN] Modificar `src/pages/Settings/SettingsContext.jsx` (L27-33) — catálogo desde IPC — INV1, INV6

### Fase 2: `DiskSpaceIndicator`

- [x] 2.1 [RED] Test: al montar llama `resources.refresh()` y muestra libre/total; al desmontar+remontar vuelve a llamar (sin valor stale) — INV5
- [x] 2.2 [GREEN] Crear `src/components/DiskSpaceIndicator/` (`.jsx` + `.module.css`) — `useEffect` con deps `[]` — INV5

### Fase 3: `ModelsSection`

- [x] 3.1 [RED] Test: `ModelsSection` lista modelos con estado/tamaño y monta `DiskSpaceIndicator` encima de la lista — INV1, INV5
- [x] 3.2 [GREEN] Crear `src/pages/Settings/components/GeneralTab/ModelsSection.jsx` — INV1, INV5
- [x] 3.3 [RED] Test: click descargar → `resources.checkSpace()` muestra finalidad/tamaño/libre/restante; confirmar → `resources.download(id)`; espacio insuficiente bloquea sin encolar — DL1, DL2
- [x] 3.4 [GREEN] Implementar flujo de confirmación de descarga en `ModelsSection.jsx` — DL1, DL2
- [x] 3.5 [RED] Test: modelo `descargando` muestra % en vivo desde `resources:progress` — DL2
- [x] 3.6 [GREEN] Conectar `ModelsSection.jsx` al snapshot de progreso — DL2
- [x] 3.7 [RED] Test: botones cancelar/reintentar visibles según estado, invocan `resources.cancel/retry` — DL3, DL4
- [x] 3.8 [GREEN] Implementar acciones cancelar/reintentar en `ModelsSection.jsx` — DL3, DL4
- [x] 3.9 [RED] Test: borrar deshabilitado/con mensaje si `reason: 'default-model'|'in-queue'`; confirmación muestra espacio a liberar — DL5
- [x] 3.10 [GREEN] Implementar confirmación + guardia de borrado en `ModelsSection.jsx` — DL5

### Fase 4: Documentación

- [x] 4.1 [GREEN] Añadir claves i18n `src/i18n/locales/{es,en}.json` para `ModelsSection`/`DiskSpaceIndicator` (estados, acciones, mensajes de guardia)

**Entrega PR2**: `gh stack` apilado sobre PR1.

---

## PR 3 — Onboarding: paso "Modelo de transcripción"

**Chain Context**: 📍 PR 3 de 4 · Base (pila): PR 2 · Depende funcionalmente de: PR1 (IPC) · Independiente de PR2 en funcionalidad, apilado por orden de pila · Habilita: nada adicional · Fuera de alcance: refactor del resto de `Onboarding.jsx`.

### Fase 1: Hook de estado

- [x] 1.1 [RED] Test `useModelDownloadStep`: preselecciona `small`; expone `selectModel/startDownload/status`; no persiste `whisperModel` hasta completar — ONB2, ONB4
- [x] 1.2 [GREEN] Crear `src/pages/Onboarding/useModelDownloadStep.js` — ONB2, ONB4

### Fase 2: Paso UI

- [x] 2.1 [RED] Test `ModelStep`: catálogo visible con tamaños/estados; `small` preseleccionado — ONB1, ONB2
- [x] 2.2 [GREEN] Crear `src/pages/Onboarding/ModelStep.jsx` — ONB1, ONB2
- [x] 2.3 [RED] Test: cambiar selección a `medium` actualiza el modelo activo para una descarga posterior — ONB2
- [x] 2.4 [GREEN] Implementar cambio de selección en `ModelStep.jsx` — ONB2
- [x] 2.5 [RED] Test: avanzar/completar el wizard sin iniciar descarga (botón "Siguiente" nunca bloqueado por estado de descarga) — ONB3
- [x] 2.6 [GREEN] Asegurar avance no bloqueante en `ModelStep.jsx` — ONB3
- [x] 2.7 [RED] Test: descarga completada desde el paso → `settings.whisperModel` = modelo descargado; fallida/cancelada → no persiste — ONB4 (test vive en `useModelDownloadStep.test.jsx`, ver Deviations — el GREEN real está en el hook, no en `ModelStep.jsx`)
- [x] 2.8 [GREEN] Implementar persistencia condicional en `useModelDownloadStep.js` (transición a `installed` del id activo → `updateSettings({whisperModel: id})`) — ONB4

### Fase 3: Wiring en `Onboarding.jsx`

- [x] 3.1 [RED] Test de integración: `Onboarding.jsx` incluye "Modelo de transcripción" en `STEPS` y lo renderiza en su posición — ONB1
- [x] 3.2 [GREEN] Modificar `src/pages/Onboarding/Onboarding.jsx` — entrada en `STEPS` + render de `ModelStep` (sin estado nuevo en el wizard) — ONB1

### Fase 4: Documentación

- [x] 4.1 [GREEN] Añadir claves i18n `src/i18n/locales/{es,en}.json` para el paso "Modelo de transcripción"

**Entrega PR3**: `gh stack` apilado sobre PR2 (orden de pila; dependencia funcional real es solo PR1).

---

## PR 4 — Bocadillo global + hardening de los 4 selectores

**Chain Context**: 📍 PR 4 de 4 (último) · Base: PR 3 · Depende de: PR1 (IPC), PR2 (patrón de guardias) · Cierra el change · Fuera de alcance: nuevos recursos no-Whisper.

### Fase 1: `useDownloadManager`

- [ ] 1.1 [RED] Test `useDownloadManager`: pull inicial `resources.getQueue()` + suscripción `resources.onProgress()` con unsubscribe en cleanup (patrón `src/hooks/useQueueManager.js`) — IND1, DL2
- [ ] 1.2 [GREEN] Crear `src/hooks/useDownloadManager.js` — IND1, DL2

### Fase 2: `DownloadIndicator`

- [ ] 2.1 [RED] Test contraído: muestra nombre + % de la descarga activa — IND2
- [ ] 2.2 [GREEN] Crear `src/components/DownloadIndicator/` (estado contraído) — IND2
- [ ] 2.3 [RED] Test expandir: click alterna a detalle de cola + resumen "N de M descargas" — IND2
- [ ] 2.4 [GREEN] Implementar estado expandido en `DownloadIndicator` — IND2
- [ ] 2.5 [RED] Test: click navega a Ajustes → Modelos y descargas (excepto botón cerrar) — IND3
- [ ] 2.6 [GREEN] Implementar navegación on-click en `DownloadIndicator` — IND3
- [ ] 2.7 [RED] Test: cerrar oculta el bocadillo sin llamar `resources.cancel()` — IND4
- [ ] 2.8 [GREEN] Implementar botón cerrar (solo oculta estado local) — IND4
- [ ] 2.9 [RED] Test: todas `listo` → oculto automático; alguna `falló` → visible con acción reintentar — IND5
- [ ] 2.10 [GREEN] Implementar lógica de visibilidad automática en `useDownloadManager`/`DownloadIndicator` — IND5

### Fase 3: `BottomLeftStack` + coexistencia con `RecordingOverlay`

- [ ] 3.1 [RED] Test `BottomLeftStack`: renderiza `DownloadIndicator` + `RecordingOverlay` simultáneamente en `column-reverse`, bocadillo debajo del overlay — IND6
- [ ] 3.2 [GREEN] Crear `src/components/BottomLeftStack/` — IND6
- [ ] 3.3 [GREEN] Modificar `src/components/RecordingOverlay/RecordingOverlay.module.css` — clase `inStack` neutraliza `position/bottom/left` propios (L3-6) — IND6
- [ ] 3.4 [GREEN] Modificar `src/App.jsx` (L236-245) — montar `BottomLeftStack` + `useDownloadManager` — IND1, IND6

### Fase 4: Hardening de los 4 selectores (solo-instalados)

- [ ] 4.1 [RED] Test `src/pages/Home/Home.jsx` (L243,478): solo ofrece modelos `installed`; sin ninguno instalado, CTA de bloqueo a Ajustes — INV6
- [ ] 4.2 [GREEN] Modificar `Home.jsx` — filtrar por instalados + CTA de bloqueo — INV6
- [ ] 4.3 [RED] Test `src/components/RecordingOverlay/RecordingOverlay.jsx` (L228): mismo criterio — INV6
- [ ] 4.4 [GREEN] Modificar `RecordingOverlay.jsx` — filtrar + CTA — INV6
- [ ] 4.5 [RED] Test `src/pages/RecordingDetail/RecordingDetailWithTranscription.jsx` (L62,1587,2227): elimina catálogo hardcodeado propio sin i18n, usa inventario central; solo instalados + CTA — INV6
- [ ] 4.6 [GREEN] Modificar `RecordingDetailWithTranscription.jsx` — migrar a inventario central — INV6
- [ ] 4.7 [RED] Test selector de Ajustes en `src/pages/Settings/components/GeneralTab/TranscriptionSection.jsx`: solo instalados + CTA — INV6
- [ ] 4.8 [GREEN] Modificar `TranscriptionSection.jsx` — filtrar por instalados + CTA — INV6
- [ ] 4.9 [RED] Test transversal: seleccionar cualquier opción (instalada o atenuada) en los 4 selectores nunca dispara `resources.download()` — INV6
- [ ] 4.10 [GREEN] Auditoría final de los 4 selectores — confirmar ausencia de `onChange`→`download` residual — INV6

### Fase 5: Defaults y documentación

- [ ] 5.1 [GREEN] Modificar `src/services/settingsService.js` — `whisperModel: 'small'` en defaults
- [ ] 5.2 [GREEN] Añadir claves i18n `src/i18n/locales/{es,en}.json` para `DownloadIndicator` y CTAs de bloqueo de los 4 selectores

**Entrega PR4**: `gh stack` apilado sobre PR3 (último de la pila).
