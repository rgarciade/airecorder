# Exploración: Gestión de descargas de modelos Whisper y recursos locales (issue #149)

### 1. Disparo actual de descarga de modelos Whisper

- `python/audio_sync_analyzer.py:37` importa `from faster_whisper import WhisperModel`.
- `load_whisper_model()` (líneas 106-123) instancia `WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8", cpu_threads=CPU_THREADS)`. Esta llamada es la que dispara la descarga IMPLÍCITA (vía `huggingface_hub`) la primera vez que ese modelo no está en caché local — no hay ningún paso previo explícito de descarga.
- `WHISPER_MODEL` es una global con default `"large"` (línea 49) pero se sobreescribe en `main()` (línea 1158-1159) con `args.model` (arg CLI `--model`, definido en línea 1089).
- El proceso hijo se spawnea desde `electron/services/transcriptionManager.js`, método `runTranscriptionProcess()` (líneas 280-378). Ahí `args.push('--model', task.model)` (línea 308) solo si `task.model` está definido — si no, Python usa su default hardcodeado `"large"` (riesgo: fallback silencioso a un modelo de 3 GB no seleccionado por el usuario).
- `task.model` viene de `dbService.enqueueTask(numericId, options.model)` (línea 106 de `transcriptionManager.js`), y `options.model` es pasado por el frontend en cada punto de invocación de `transcribeRecording` — hoy leído directamente de `settings.whisperModel` en 3 sitios distintos (no centralizado): `src/pages/Home/Home.jsx:243,478` y `src/components/RecordingOverlay/RecordingOverlay.jsx:228`.
- El proceso Python en producción es un binario PyInstaller (`resourcesPath/python-bin/audio_sync_analyzer`, ver `transcriptionManager.js:296`); no hay build hook visible que gestione o empaquete modelos Whisper en el DMG — confirma que hoy NINGÚN modelo va empaquetado (coincide con "fuera de alcance: incluir modelos en el DMG").
- No se encontró ninguna configuración de `HF_HOME` / `HUGGINGFACE_HUB_CACHE` / `download_root` en el código — `faster-whisper`/`huggingface_hub` usa su caché default del SO (`~/.cache/huggingface/hub` o equivalente en macOS). Esto significa que hoy la app NO controla ni inventaría el directorio de caché de modelos.
- `requirements.txt:6` fija `faster-whisper>=1.0.0`.

### 2. Flujo de onboarding actual

- `src/pages/Onboarding/Onboarding.jsx` — wizard de 6 pasos controlados por índice (`STEPS` array, líneas 20-27): `welcome → aiInfo → ai → permissions → preferences → finish`. NO existe ningún paso de "modelos/recursos locales" hoy. Habría que insertar un paso nuevo (candidato natural: entre `ai`/`aiInfo` — que ya habla de IA local — y `permissions`, o como parte de `preferences`).
- Cada paso es un componente separado en `src/pages/Onboarding/*Step.jsx` (`PermissionsStep.jsx`, `PreferencesStep.jsx`, `LocalAiInfoStep.jsx`, `AiConfigStep/index.jsx`), todos reciben `t`, callbacks (`onBack`, `onNext`), y `StepProgressComponent` (ver `Onboarding.jsx:640-717` para el patrón exacto de props). El wizard central (`Onboarding.jsx`) mantiene TODO el estado en un solo componente de +700 líneas (viola la regla de "no monolitos" del README raíz — habría que modularizar el nuevo estado de descargas en un hook/contexto aparte).
- `OnboardingFooter.jsx` es el layout de pie de página común (botón "Back" + slot `children` para el botón "Next/Finish").
- Persistencia: `saveAndClose()` (`Onboarding.jsx:326-393`) arma un objeto `settingsToSave` y llama a `updateSettings()` (de `src/services/settingsService.js`) una sola vez al final del wizard. Hoy NO hay guardado incremental por paso — el modelo Whisper elegido tendría que sumarse a ese objeto final como `whisperModel`, pero si el requisito es "poder terminar el onboarding sin descargar ningún modelo", la descarga en sí debe ser una operación asíncrona independiente del guardado de settings (no bloquear `handleNext`).
- `checkPermissions()` es el patrón de referencia para I/O con el proceso principal desde un paso del onboarding (usa `window.electronAPI?.xxx?.()` con fallback).

### 3. Settings actual de transcripción

- `whisperModel` vive en `src/pages/Settings/SettingsContext.jsx` como estado React simple (línea 62: `useState('small')`), cargado en `SettingsContext.jsx:243` (`savedSettings.whisperModel || 'small'`) y guardado en `SettingsContext.jsx:641`.
- Lista estática de modelos: `whisperModels` (`SettingsContext.jsx:27-33`) = `tiny | base | small | medium | large`, con labels ya traducidos vía `t('settings.whisperModels.*')`. No incluye `large-v3` ni variantes `.en`.
- UI: `src/pages/Settings/components/GeneralTab/TranscriptionSection.jsx:49-63` — es un `<select>` HTML plano sin ningún indicador de estado (descargado/no descargado/tamaño). Seleccionar un modelo no descargado hoy simplemente hace que la próxima transcripción dispare la descarga implícita al vuelo.
- `src/services/settingsService.js` — el objeto default de `getSettings()` (líneas 37-89, fallback usado solo si `loadSettings()` IPC falla) NO incluye `whisperModel` en absoluto; el default real `'small'` vive solo en `SettingsContext.jsx`. Sitio a unificar si se centraliza el estado de recursos.
- No existe ninguna tabla SQLite ni archivo JSON de "inventario de recursos/modelos descargados" en `electron/database/`. Habría que crear una fuente de verdad nueva compartida entre onboarding, Ajustes y selectores (el issue lo pide explícitamente).

### 4. Detección de espacio insuficiente ya existente

- **Es reactiva, no preventiva.** `electron/services/transcriptionManager.js:340-352`: mientras el proceso Python corre, se escucha `stderr` y se hace `msg.match(/expected file size is:\s*([\d.]+)\s*MB.*?only has\s*([\d.]+)\s*MB free/is)` — este es el `UserWarning` que `huggingface_hub` imprime a stderr justo ANTES de que la descarga falle por falta de espacio, no una consulta activa al SO.
- Si el proceso termina con código ≠0 y se capturó ese warning, se rechaza la promesa con `Error('DISK_SPACE::<expectedMb>::<freeMb>')` (línea 367).
- `src/pages/TranscriptionQueue/TranscriptionQueue.jsx:33-38` parsea ese prefijo `DISK_SPACE::` con regex y renderiza `t('transcriptionQueue.errors.diskSpace', {expectedMb, freeMb})` (claves en `src/i18n/locales/es.json:809` / `en.json:809`).
- **Conclusión clave para el proposal**: NO existe en el código ningún utility que consulte espacio libre de disco de forma proactiva (no hay `fs.statfsSync`, ni paquete tipo `check-disk-space`, ni equivalente en Python `shutil.disk_usage`). Lo único reutilizable es (a) el patrón de mensaje estructurado `DISK_SPACE::x::y` y (b) las claves i18n ya traducidas. El chequeo preventivo real (antes de iniciar cada descarga) hay que construirlo desde cero.

### 5. Mecanismo IPC de progreso ya usado

- Patrón establecido para operaciones largas con progreso: el proceso Python escribe a stdout líneas `PROGRESS:\s*(\d+)` que Node parsea con regex (`transcriptionManager.js:257-260` y `:334-337`) y traduce a `onProgress(percent)`.
- `updateProgress(percent, step)` (`transcriptionManager.js:410-415`) persiste en SQLite (`dbService.updateTask`) y llama `this.notifyUpdate()`.
- `notifyUpdate()` invoca el callback registrado en `main.js:251-255`: `transcriptionManager.setUpdateCallback((queueState) => BrowserWindow.getAllWindows().forEach(win => win.webContents.send('queue-update', queueState)))` — broadcast a TODAS las ventanas, no solo la que inició la tarea.
- Frontend: `electron/preload.js:181-182` expone `onQueueUpdate(callback)` / `offQueueUpdate()`; consumido por el hook `src/hooks/useQueueManager.js` (polling inicial vía `getTranscriptionQueue()` + suscripción push), que alimenta `queueCount`/`queueState` en `App.jsx:76` y de ahí al badge del Sidebar (`src/components/Sidebar/Sidebar.jsx:31`, `badge: queueCount > 0 ? queueCount : null`) y a la página `TranscriptionQueue`.
- Existe un segundo patrón más moderno con nombre de canal namespaced y función de unsubscribe explícita: `ai:codex-login-progress` (`preload.js:67`) — mejor candidato de estilo a copiar para un canal nuevo `resources:download-progress` que `queue-update`/`offQueueUpdate` (que usa `removeAllListeners`, más propenso a colisiones entre múltiples suscriptores).
- **No existe hoy ningún progreso de descarga de modelos** — la descarga ocurre dentro de la llamada bloqueante `WhisperModel(...)` de huggingface_hub (que internamente usa `tqdm` en stderr), y ese stderr NO se parsea para progreso, solo para el warning de espacio y errores genéricos. Habrá que instrumentar la descarga explícitamente (p.ej. usar `huggingface_hub.snapshot_download`/`hf_hub_download` directamente con un callback/tqdm personalizado que emita `PROGRESS:` a stdout) en vez de depender del side-effect de `WhisperModel()`.

### 6. Estado global / UI persistente entre pantallas

- No hay React Router — `src/App.jsx` usa `currentView` (string) gestionado por el hook `src/hooks/useNavigation.js`, con un bloque de renderizado condicional por vista (líneas 148-234) montado dentro de un único `<div className={styles.mainContent}>`.
- Patrones YA existentes de UI persistente "por encima" de la vista activa, montados a nivel `App.jsx` root (candidatos de referencia directa para el "bocadillo" pedido):
  - **Banner fijo superior** (`App.jsx:118-141`): `dbFallbackBanner`, `position: fixed, top:0, zIndex:9999`, condicionado a `currentView !== 'onboarding'`, con botón de cierre que solo oculta el banner (no cancela la causa) — mismo comportamiento pedido para el bocadillo de descargas ("cerrar no cancela").
  - **`RecordingOverlay`** (`App.jsx:237-245`): overlay condicional (`isRecording && currentView !== 'onboarding'`) montado al nivel raíz, independiente de la vista — es el patrón estructural más cercano a un widget flotante persistente controlado por estado global (acá viene de Redux `state.recording.isRecording` + estado local `currentRecorder`).
  - **Badge de contador en Sidebar** (`Sidebar.jsx:31`, alimentado por `useQueueManager`) — patrón reusable para "2 de 3" en el bocadillo.
  - **`WhatsNewModal`** — modal simple gestionado por `useSession` hook, patrón de "mostrar/ocultar" más simple.
- No existe ningún sistema de toast/snackbar en el proyecto (`grep -ri "toast|snackbar"` sobre `src/` no arrojó resultados) — el bocadillo de descargas sería el primer componente de este tipo; no hay que adaptar uno existente, hay que crearlo.
- Recomendación de patrón: un hook nuevo `useDownloadManager` (mismo shape que `useQueueManager`) montado en `App.jsx`, alimentando un componente `DownloadIndicator` renderizado a nivel raíz (mismo patrón condicional que `RecordingOverlay`/banner), con click que navega a Ajustes→Transcripción reusando `handleOpenSettings('general', 'download-settings-anchor-id')` (ya existe ese patrón de scroll-to-anchor: ver `App.jsx:222` `onNavigateToSettings={() => handleOpenSettings('general', 'diarization-settings')}` y el `targetElement` prop de `Settings`).

### 7. Modelos de Whisper disponibles (tamaños aproximados, vía HuggingFace `Systran/faster-whisper-*`, no documentados en el código)

| Modelo | Tamaño aprox. `model.bin` |
|---|---|
| tiny | ~78 MB |
| base | ~148 MB |
| small | ~486 MB |
| medium | ~1.53 GB |
| large-v3 | ~3.09 GB |

Nota: el código actual solo ofrece `tiny/base/small/medium/large` (sin sufijo de versión) — `large` es un alias legado de faster-whisper que puede resolver a una versión distinta de `large-v3` según la versión de la librería; el proposal debe decidir si migrar la lista a nombres explícitos con versión (`large-v3`) para que los tamaños estimados sean fiables.

### Áreas afectadas (archivos concretos a tocar en el proposal)

- `python/audio_sync_analyzer.py` (líneas 37, 49, 106-123, 1089, 1158-1166) — reemplazar carga implícita por descarga explícita instrumentada.
- `electron/services/transcriptionManager.js` (líneas 280-378, 308, 340-367) — el chequeo de espacio pasaría a ser preventivo antes del spawn, no solo parseo reactivo de stderr.
- Nuevo módulo backend (no existe hoy): gestor de recursos/inventario de modelos, expuesto vía nuevos `ipc-handlers/resources.js` (patrón: `ipc-handlers/rag.js` o `ipc-handlers/attachments.js` como referencia de estilo).
- `electron/preload.js` — nuevos métodos + canal de progreso de descarga (patrón `ai:codex-login-progress`, líneas 67-72, mejor que `queue-update`/`offQueueUpdate`).
- `electron/main.js` (líneas 250-261) — registrar nuevo callback/broadcast para progreso de descargas.
- `src/pages/Onboarding/Onboarding.jsx` (STEPS array línea 20-27, `saveAndClose` línea 326-393) — nuevo step + persistencia de `whisperModel` sin bloquear el cierre del onboarding.
- `src/pages/Settings/SettingsContext.jsx` (líneas 27-33, 62, 243, 641) y `TranscriptionSection.jsx` (líneas 49-63) — nueva sección "Modelos y descargas" con estados por modelo.
- `src/services/settingsService.js` (línea 37-89) — añadir `whisperModel` al default object para consistencia.
- `src/App.jsx` (líneas 76, 118-141, 236-245) + nuevo hook `useDownloadManager` — bocadillo global.
- Selectores existentes que leen `settings.whisperModel` directamente sin pasar por un selector centralizado: `src/pages/Home/Home.jsx:243,478`, `src/components/RecordingOverlay/RecordingOverlay.jsx:228` — deben migrar a un selector "solo modelos instalados" según requisito 4 del issue.
- `electron/database/recordings/queries.js` (columna `transcription_model`) — única fuente actual para determinar "modelo en uso"; no hay query que cruce esto con `settings.whisperModel` (default) ni con tareas `pending/processing` en cola — hay que construir esa lógica de guardia de borrado desde cero.

### Riesgos / incógnitas técnicas

1. **Sin control de caché HF hoy**: no hay `HF_HOME`/`download_root` configurado; para poder inventariar "qué está descargado" de forma confiable hay que fijar explícitamente el directorio de caché (dentro de `userData` o similar) y no depender del default del SO — esto es un cambio de comportamiento, no solo una feature nueva.
2. **Progreso de descarga no instrumentado**: la descarga ocurre dentro de la llamada bloqueante `WhisperModel()`; para tener progreso real hay que llamar explícitamente a `huggingface_hub.snapshot_download`/`hf_hub_download` con callback de progreso ANTES de instanciar `WhisperModel`, y pasar `local_files_only=True` después para evitar reintentos de red silenciosos.
3. **Empaquetado PyInstaller**: `huggingface_hub` y sus dependencias de red (`requests`, `tqdm`, `filelock`) deben confirmarse como incluidas en `python/audio_sync_analyzer.spec` (no se auditó a fondo el `.spec` en esta exploración) — riesgo de que el binario empaquetado falle al importar dinámicamente algo no declarado en hidden imports.
4. **Fallback silencioso a `WHISPER_MODEL="large"`**: si `task.model` es `undefined`/falsy en el spawn, el script Python cae al default hardcodeado de 3 GB sin que el usuario lo haya elegido — riesgo de UX y de disco ya presente HOY, agravado si el nuevo flujo permite terminar el onboarding sin modelo.
5. **Guardia "modelo en uso"**: falta definir la fuente de verdad — ¿"en uso" significa ser el `whisperModel` default en settings, tener tareas `pending/processing` en cola con ese modelo, o haber sido usado alguna vez en `recordings.transcription_model`? El issue pide explícitamente no permitir borrar un modelo "en uso activo", pero el código actual no tiene ese concepto modelado.
6. **Wizard monolítico**: `Onboarding.jsx` ya tiene ~720 líneas concentrando estado de 8+ proveedores de IA; sumar estado de descargas de modelos ahí violaría la regla de "evitar archivos monolíticos" del `AGENTS.md` raíz — se recomienda extraer a un hook/contexto dedicado desde el inicio.
7. **Nombres de modelo sin versión**: la lista actual (`tiny/base/small/medium/large`) no distingue versiones de `large` (`v1/v2/v3`), lo que puede generar estimaciones de tamaño incorrectas o comportamiento distinto según la versión de `faster-whisper` instalada.

### Preguntas abiertas para el proposal

- ¿Dónde vive el nuevo inventario de recursos: SQLite (nueva tabla) o JSON en `userData` (como `settings.json`)? Dado que ya existe SQLite con migraciones automáticas (`dbService.init()`), una tabla nueva parece más consistente, pero el estado "descargando ahora mismo" es efímero y probablemente no deba persistirse en BD.
- ¿El nuevo step de onboarding reemplaza/se fusiona con `LocalAiInfoStep` (que ya habla de IA local) o va como paso independiente entre `preferences` y `finish`?
- ¿Se migra la lista de modelos a nombres versionados (`large-v3`) como parte de este cambio, o se mantiene `large` y se asume que apunta a la versión más reciente soportada por la versión de `faster-whisper` fijada en `requirements.txt`?
- ¿El chequeo preventivo de espacio debe hacerse en Node (Electron main, vía `fs.statfsSync` o paquete `check-disk-space`) o delegarse a Python (`shutil.disk_usage`) antes de invocar `snapshot_download`? Node es más consistente con el resto de la infraestructura de descargas/UI, pero Python ya conoce la ruta de caché real de `huggingface_hub`.
- ¿El canal IPC de progreso de descargas debe ser una extensión de `queue-update` (reusar infraestructura) o un canal completamente nuevo `resources:*` (más aislado, evita acoplar "cola de transcripción" con "cola de descargas de recursos")? Recomendación de esta exploración: canal nuevo, dado que son conceptualmente independientes (se puede descargar sin transcribir y viceversa).

### Enfoques de alto nivel (para el proposal)

1. **Gestor de recursos nuevo en Electron main + descarga explícita en Python vía huggingface_hub** — Node orquesta (inventario, cola de descargas, chequeo de espacio, IPC de progreso); Python solo ejecuta `snapshot_download` con callback y reporta `PROGRESS:`/`DONE`/`ERROR` por stdout, reusando el patrón de spawn ya existente en `transcriptionManager.js`.
   - Pros: reusa 100% la infraestructura IPC/progreso ya probada; consistente con "todo pasa por Node como orquestador" (patrón del README de Electron).
   - Contras: requiere nuevo script/modo Python dedicado a descargas (separado de `audio_sync_analyzer.py`) para no acoplar descarga con transcripción.
   - Esfuerzo: Medio.

2. **Descarga 100% en Node usando la API HTTP de HuggingFace directamente (sin pasar por Python)** — Node descarga los ficheros del repo (`model.bin`, `config.json`, etc.) a un directorio propio, y se pasa `download_root`/`HF_HOME` a Python apuntando a esa caché para que `WhisperModel(..., local_files_only=True)` nunca dispare red.
   - Pros: progreso nativo en Node (más simple de exponer a React sin parsear stdout), no depende de instrumentar Python ni de que `huggingface_hub` esté bien empaquetado en el binario PyInstaller.
   - Contras: hay que replicar en JS la resolución de nombres de repo/revisión que hace `faster-whisper` internamente (mapeo modelo→repo HF); riesgo de desincronización si `faster-whisper` cambia esa resolución en una actualización de versión.
   - Esfuerzo: Medio-Alto.

3. **Mantener descarga dentro de Python pero solo agregar progreso instrumentado (sin gestor de inventario nuevo)** — mínimo cambio: instrumentar `huggingface_hub` con callback de progreso y mejorar el chequeo de espacio a preventivo, pero sin un "gestor de recursos" ni pantalla de Ajustes dedicada.
   - Pros: menor esfuerzo, menor superficie de cambio.
   - Contras: NO cumple los requisitos 2 y 3 del issue (pantalla de Ajustes→Modelos y descargas, borrar/gestionar, bocadillo global) — insuficiente para el alcance pedido.
   - Esfuerzo: Bajo (pero incompleto).

### Recomendación

Enfoque 1 (gestor en Node + descarga explícita instrumentada en Python vía `huggingface_hub`, canal IPC nuevo `resources:*` separado de `queue-update`) es el que mejor equilibra reuso de patrones ya validados en el código (spawn + stdout `PROGRESS:` + broadcast a todas las ventanas) con el aislamiento conceptual que pide el issue (descargas de recursos ≠ cola de transcripción).

### Listo para Proposal

Sí. Hay suficiente evidencia del código real para que `sdd-propose` defina: (a) esquema de inventario de recursos, (b) contrato IPC de descargas, (c) ubicación del nuevo step de onboarding, (d) diseño de la sección Ajustes→Transcripción→Modelos y descargas, y (e) diseño del bocadillo global — resolviendo las preguntas abiertas listadas arriba como parte de las decisiones de producto/arquitectura del proposal.
