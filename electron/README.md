# 🖥️ Documentación de Electron Backend (AIRecorder)

Este directorio contiene el "Proceso Principal" (Main Process) de la aplicación, encargado de manejar ventanas, sistema de archivos, procesos hijos (Python), bases de datos y la comunicación con el Frontend de React.

---

## 🧪 Tests Unitarios (Speaker Re-identification)

Los tests para el sistema de re-identificación de hablantes se encuentran en `src/tests/`.
No requieren ninguna dependencia extra: usan únicamente el módulo `assert` nativo de Node.js.

### Cómo ejecutar

```bash
# Todos los tests (recomendado)
node src/tests/run-all.mjs

# Suites individuales
node src/tests/speakerCompatibility.test.mjs   # Tests de hasEditableSpeakerResolution
node src/tests/speakersSlice.test.mjs          # Tests del reducer Redux (mergeSpeakers, updateAlias, etc.)
node src/tests/speakerLabel.test.mjs           # Tests de lógica de SpeakerLabel (legacy vs v2.0)
```

### Estructura de tests

| Archivo | Qué prueba | Tests |
|---------|-----------|-------|
| `speakerCompatibility.test.mjs` | `hasEditableSpeakerResolution()` — válida si speakerResolution contiene UUIDs | 14 |
| `speakersSlice.test.mjs` | Reducer Redux: `setAliases`, `updateAlias`, `mergeSpeakers`, `clearAliases`, `selectDisplayName` | 21 |
| `speakerLabel.test.mjs` | Lógica de `SpeakerLabel`: `canEdit`, `displayName`, retro-compat legacy vs v2.0 | 16 |

**Total: 51 tests — todos sin framework, ejecutables con `node` directamente.**

### Escenarios de spec cubiertos

| Escenario del spec | Archivo de test | Estado |
|--------------------|-----------------|--------|
| Legacy: `SpeakerLabel` con `ephemeralId` sin resolución → no editable | `speakerLabel.test.mjs` | ✅ |
| Nuevo: `SpeakerLabel` con `speakerResolution` UUID → editable | `speakerLabel.test.mjs` | ✅ |
| Merge: Redux `mergeSpeakers` unifica ephemeralIds a un UUID | `speakersSlice.test.mjs` | ✅ |
| Alias assignment: `updateAlias` persiste correctamente en el mapa | `speakersSlice.test.mjs` | ✅ |

---

## 1. El Orquestador: `main.js` y `ipc-handlers/`

El archivo `main.js` es el corazón de la aplicación y actúa como orquestador. Para mantener el código limpio y evitar un archivo monolítico, la lógica de comunicación está dividida:

*   **Inicialización (`main.js`):** Lee `settings.json` para determinar la ruta de BD (por defecto `{userData}/recordings.db`, o la ruta personalizada `databasePath`). Si el disco no está disponible, muestra un `dialog.showMessageBox` nativo y usa el fallback, estableciendo `global.usingFallbackDb = true`. Arranca la base de datos (`dbService.init()`), sincroniza archivos vs base de datos (`migrationService.syncRecordings()`), arranca el `transcriptionManager` y crea la ventana.
*   **Manejadores IPC (`ipc-handlers/`):** Todos los eventos que escuchan peticiones desde el frontend de React (`ipcMain.handle`) han sido extraídos a archivos específicos por dominio dentro de la carpeta `ipc-handlers/` (ej. `audio.js`, `settings.js`, `projects.js`). `main.js` los importa y les inyecta explícitamente las dependencias que necesitan.

### Patrón de Retorno IPC (¡Obligatorio!)
Todo manejador de IPC en `main.js` debe estar envuelto en un bloque `try/catch` para evitar crasheos silenciosos de la app, y **siempre** debe devolver un objeto unificado:

```javascript
// Ejemplo de patrón obligatorio para IPC
ipcMain.handle('mi-evento', async (event, params) => {
    try {
        const resultado = await hacerAlgo(params);
        return { success: true, data: resultado };
    } catch (error) {
        console.error("Error en mi-evento:", error);
        return { success: false, error: error.message || String(error) };
    }
});
```

## 2. Comunicación Frontend <-> Backend

*   **React al Backend:** Ocurre invocando métodos definidos en `window.electronAPI`.
*   **Puente Seguro:** `preload.js` expone de forma segura (Context Bridge) las funciones necesarias al renderizador, mapeándolas con `ipcRenderer.invoke()`.
*   **Backend al React:** El backend puede enviar eventos no solicitados (como actualizaciones de estado de transcripción) utilizando `win.webContents.send('evento-nombre', datos)`. El frontend debe tener listeners (ej. `window.electronAPI.onQueueUpdate()`).

### IPC: `transcribe-recording` — descarte puntual de diarización

`ipc-handlers/transcription.js` expone `transcribe-recording(recordingId, model, options)`, donde `options.skipDiarization` (boolean opcional) marca `recordings.skip_diarization` vía `transcriptionManager.addTask()` antes de encolar la tarea.

*   `RecordingOverlay.jsx` muestra un checkbox "Descartar diarización" en el diálogo de detalles al terminar la grabación (solo si `settings.enableDiarization` está activo globalmente) y lo pasa como `{ skipDiarization }` a `recordingsService.transcribeRecording()`.
*   `transcriptionManager.processQueue()` combina `settings.enableDiarization && !recording.skip_diarization` para decidir si ejecuta `diarization_analyzer.py`. El flag persiste en la fila del recording, así que también aplica si la tarea se reintenta o se re-encola manualmente.
*   Los demás puntos de entrada (`RecordingList`, `RecordingDetail`, `Home`) no pasan `options`, por lo que no tocan el flag y respetan el valor ya guardado en el recording.

### IPC: IA / Conexiones OpenAI personalizadas

Se añadió el handler `electron/ipc-handlers/ai.js` para operaciones de IA que deben ejecutarse en el proceso principal.

| Canal IPC | Payload | Respuesta |
|-----------|---------|-----------|
| `ai:custom-list-models` | `connectionId` | `{ success: true, models: [{ name, label, description }] }` o `{ success: false, error }` |

Método expuesto en `preload.js`:

```js
window.electronAPI.listCustomModels(connectionId) // → Promise<{ success, models?, error? }>
```

El handler lee `settings.customConnections`, busca la conexión por `id` y realiza `GET ${baseUrl}/v1/models` con autenticación Bearer. Cualquier error de red o HTTP se devuelve como objeto `{ success: false, error }` para evitar crasheos en el renderer.

### IPC: RAG — Reindexado masivo

Se añadió el handler `rag:reindex-all` en `electron/ipc-handlers/rag.js` para reindexar todas las grabaciones que ya tienen un índice RAG (`vectordb/`) usando el modelo de embeddings actualmente configurado.

| Canal IPC | Payload | Respuesta |
|-----------|---------|-----------|
| `rag:reindex-all` | — | `{ success: true, reindexed: number, total: number, lastEmbeddingModelId: string }` o `{ success: false, error }` |

Método expuesto en `preload.js`:

```js
window.electronAPI.ragReindexAll() // → Promise<{ success, reindexed?, total?, lastEmbeddingModelId?, error? }>
```

El handler delega en `ragService.reindexAllRecordings()`; por cada grabación con `vectordb/` existente llama a `indexRecording` y finalmente escribe `{ lastEmbeddingModelId, reindexedAt }` en `rag_metadata.json` dentro del directorio de grabaciones. El frontend compara el nuevo id con `settings.lastEmbeddingModelId` y muestra un banner de aviso cuando cambia, permitiendo al usuario ejecutar el reindexado manualmente.

### IPC: Wiki de Proyecto

Se añadió un nuevo handler `electron/ipc-handlers/wiki.js` y una API segura en `preload.js` bajo `window.electronAPI.wiki`.

| Canal IPC | Payload | Respuesta |
|-----------|---------|-----------|
| `wiki:list-pages` | `projectId` | `{ success: true, pages: WikiPage[] }` |
| `wiki:create-page` | `{ project_id, title, slug? }` | `{ success: true, page }` |
| `wiki:update-page` | `id, { title, slug, content_md }` | `{ success: true, page }` |
| `wiki:delete-page` | `id` | `{ success: true }` |
| `wiki:generate-starter-page` | `projectId, { language, projectName? }` | `{ success: true, page }` \| `{ success: true, skipped: true }` \| `{ success: true, error: 'no_analysis' }` |

Métodos expuestos en preload:

```js
window.electronAPI.wiki = {
  listPages(projectId),
  createPage(data),
  updatePage(id, data),
  deletePage(id),
  generateStarterPage(projectId, options),
}
```

### Bundle budget (NFR-WIKI-004)

Medición realizada con `npm run build` (2026-06-14):

- `dist/assets/index-BG7mzrvb.js` → **660.69 kB gzip**
- `dist/assets/index-C3wqrVIJ.css` → **57.78 kB gzip**

Observaciones:

- El código de Wiki (incluyendo `@uiw/react-md-editor`) está dentro del chunk principal `index-BG7mzrvb.js`.
- No hay chunk lazy dedicado para el editor en el build actual.
- Por lo tanto, el incremento atribuible a Wiki no puede aislarse con precisión desde este build monolítico; el límite de **100 kB gzip** para la feature queda **en riesgo / no demostrable** y debe tratarse como **NFR no verificado (potencial FAIL)** hasta separar el editor en carga diferida.

### Captura de Audio del Sistema (`electron-audio-loopback`)

La captura de audio del sistema usa el paquete `electron-audio-loopback` (requiere Electron >= 31). Este paquete evita la necesidad del permiso de "Grabación de pantalla" en macOS:

*   **macOS:** Usa Core Audio Tap API (solo requiere permiso de "System Audio Recording", no "Screen Recording").
*   **Windows:** Usa WASAPI (Windows Audio Session API), sin permisos especiales.
*   **Linux:** Usa PulseAudio.

**Flujo:**
1.  `initMain()` se llama en `main.js` **antes** de `app.whenReady()` para configurar los switches de Chromium.
2.  El renderer llama a `window.electronAPI.enableLoopbackAudio()` antes de iniciar la captura.
3.  Se invoca `getDisplayMedia({ video: true, audio: true })` — interceptado por la librería para devolver solo audio loopback.
4.  Al detener la grabación, se llama a `window.electronAPI.disableLoopbackAudio()`.

**Entitlements macOS:** Se requiere `NSAudioCaptureUsageDescription` en `Info.plist` y el entitlement `com.apple.security.device.audio-input` (configurados en `build/entitlements.mac.plist` y `package.json`).

## 3. Bases de Datos (`/database`)

### SQLite (`dbService.js`)
*   Se utiliza `better-sqlite3`, el cual es **síncrono** (no necesitas `await` para las queries).
*   **WAL Mode:** Está activado el modo WAL (Write-Ahead Logging) para mejor rendimiento concurrente.
*   **Auto-migraciones:** Al iniciar, se ejecutan las migraciones:
    *   Crea tablas con `CREATE TABLE IF NOT EXISTS`.
    *   Añade columnas nuevas dinámicamente usando `ALTER TABLE`.
    *   `recordings.source` se agrega automáticamente si no existe para distinguir el origen de la grabación (`audio` vs `conversation-import`).
    *   `recordings.skip_diarization` (`INTEGER DEFAULT 0`) se agrega automáticamente si no existe. Permite descartar la diarización para una grabación puntual aunque `settings.enableDiarization` esté activo globalmente.
*   **Estados atascados:** Restablece tareas con estado `processing` en la cola a `pending` o `failed` si la app se cerró de forma inesperada.
*   **Ruta configurable:** La BD se inicializa con la ruta que `main.js` le pasa (por defecto `{userData}/recordings.db`, o la personalizada de `settings.databasePath`). El singleton `DbService` expone:
    *   `init(dbPath)` — abre/crea la BD en la ruta indicada y registra `this.dbPath`.
    *   `close()` — cierra la conexión actual (necesario antes de cambiar la ruta en caliente).
    *   `getCurrentPath()` — devuelve la ruta activa de la BD.

### Tabla `project_wiki_pages`

Tabla para páginas Markdown de wiki por proyecto.

| Columna | Tipo | Restricción |
|---------|------|-------------|
| `id` | INTEGER | `PRIMARY KEY AUTOINCREMENT` |
| `project_id` | INTEGER | `NOT NULL`, FK a `projects(id)` con `ON DELETE CASCADE` |
| `slug` | TEXT | `NOT NULL` |
| `title` | TEXT | `NOT NULL` |
| `content_md` | TEXT | `DEFAULT ''` |
| `source_recording_ids` | TEXT | `DEFAULT '[]'` (JSON en texto) |
| `version` | INTEGER | `DEFAULT 1` |
| `is_verified` | INTEGER | `DEFAULT 0` |
| `created_at` | TEXT | `DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | TEXT | `DEFAULT CURRENT_TIMESTAMP` |

Restricciones extra:
- `UNIQUE(project_id, slug)`
- FK `project_id -> projects(id)` con borrado en cascada

### IPC: Esquema / Mind-Map de Grabación

Dos handlers en `electron/ipc-handlers/analysis.js`. El esquema se persiste como JSON en el sistema de archivos (mismo patrón que `ai_summary.json`).

| Canal IPC | Payload | Respuesta |
|-----------|---------|-----------|
| `save-recording-schema` | `recordingId, schema` | `{ success: true }` |
| `get-recording-schema` | `recordingId` | `{ success: true, schema }` \| `{ success: false, error }` |

Archivo en disco: `<recordings>/<folderName>/analysis/recording_schema.json`

Formato del esquema:
```json
{
  "branches": [
    { "title": "Información de la reunión", "items": [ { "label": "...", "start": null } ] },
    { "title": "Notas", "items": [ { "label": "...", "start": 192.4 } ] },
    { "title": "Próximos pasos", "items": [ { "label": "...", "start": 750.0 } ] },
    { "title": "Sugerencias de IA", "items": [ { "label": "...", "start": null } ] }
  ]
}
```

Métodos expuestos en preload:
```js
window.electronAPI.saveRecordingSchema(recordingId, schema)  // → Promise<{ success, error? }>
window.electronAPI.getRecordingSchema(recordingId)           // → Promise<{ success, schema?, error? }>
```

Frontend: `src/services/recordingsService.js` expone `saveRecordingSchema(id, schema)` y `getRecordingSchema(id)`.

### Almacenamiento Dual (Dual Storage)
El sistema guarda metadatos en la base de datos (ID, duración, estados), pero el contenido pesado (archivos WAV, archivos JSON de los resúmenes de IA, transcripciones txt) reside en el sistema de archivos (Filesystem).
*   *Importante:* El ID de la grabación (`recordingId`) en la base de datos es numérico. En el disco, las carpetas de las grabaciones usan strings (`relative_path`). La función `getFolderPathFromId()` se utiliza para traducir el ID numérico a la ruta correcta en disco.

## 4. Monitor de Micrófono del Sistema (`services/microphoneMonitor.js`)

Detecta cuándo otro proceso del sistema activa el micrófono y notifica al usuario para que pueda iniciar una grabación.

### Arquitectura

- **`services/microphoneMonitor.js`**: Singleton `EventEmitter` que sondea el estado del audio de entrada vía `ioreg` (macOS) cada 3 segundos. Emite `'activated'` / `'deactivated'` según el estado detectado.
- Integrado en `main.js` (paso 10 de `initApp()`).
- **IPC `set-app-recording-state`**: El renderer avisa al main si la propia app está grabando; mientras sea `true`, las activaciones detectadas se ignoran para evitar auto-disparos.

### Flujo

1. `microphoneMonitor.start()` arranca el polling.
2. Al detectar un engine de audio de entrada activo (`AppleHDAEngineInput` / `IOAudioEngineInput`):
   - **App en primer plano** → envía evento IPC `mic-activated` al renderer → se muestra un banner in-app.
   - **App en segundo plano** → lanza una `Notification` nativa con botón "Grabar ahora" (macOS) / solo notificación (otros SO).
3. "Grabar ahora" envía `start-recording-from-notification` → el renderer inicia la grabación automáticamente.

### Métodos expuestos en `preload.js`

| Método | Descripción |
|--------|-------------|
| `onMicActivated(cb)` | Listener: micrófono activado (app en primer plano) |
| `onStartRecordingFromNotification(cb)` | Listener: usuario pulsó "Grabar ahora" en notificación nativa |
| `setAppRecordingState(bool)` | Informa al main si la app está grabando (suprime falsas alarmas) |

### Limitación conocida

El comando `ioreg -r -c AppleHDAEngineInput` funciona en Macs Intel y algunos M-chip. Si el nombre del driver difiere en hardware futuro, puede que no detecte la actividad. Se puede refinar la clase de búsqueda en `_isMicActive()`.

---

## 5. Sistema de Actualizaciones (`services/updateChecker.js` + `ipc-handlers/updates.js`)

Sistema de notificación de actualizaciones manuales usando GitHub Releases API (la app no está firmada, por lo que no usa `electron-updater`).

### Arquitectura
- **`services/updateChecker.js`**: Singleton que consulta `https://api.github.com/repos/rgarciade/airecorder/releases/latest` usando `https` nativo. Compara la versión remota (`tag_name`) con `app.getVersion()` usando comparación semántica.
- **`ipc-handlers/updates.js`**: Expone 3 handlers IPC: `check-for-updates`, `get-app-version`, `open-download-url`.

### Flujo
1. Al arrancar la app (`initApp()`), se llama a `updateChecker.startPeriodicCheck()`.
2. Tras 5 segundos, se ejecuta la primera verificación (no silenciosa → muestra `dialog.showMessageBox` si hay actualización).
3. Cada 4 horas se verifica silenciosamente (solo envía evento `update-available` al renderer).
4. El usuario puede verificar manualmente desde Settings → General → "Buscar actualizaciones".
5. Si acepta, se abre el navegador con `shell.openExternal(release.html_url)` para descarga manual.

### Métodos expuestos en `preload.js`
| Método | Descripción |
|--------|-------------|
| `checkForUpdates()` | Verificar manualmente (muestra diálogo nativo) |
| `getAppVersion()` | Obtener versión instalada |
| `openDownloadUrl(url)` | Abrir URL de descarga en navegador |
| `onUpdateAvailable(cb)` | Listener de evento `update-available` |
| `offUpdateAvailable()` | Eliminar listeners de actualización |
| `getSystemLanguage()` | Obtener el idioma del SO (ej. `'es'`, `'en'`) |
| `changeDbPath(newPath, migrate)` | Cambiar ruta de BD en caliente. `migrate=true` copia el archivo actual a la nueva ubicación antes de reiniciar. |
| `getDbStatus()` | Devuelve `{ usingFallback: bool, currentPath: string }` para que el renderer muestre el banner de aviso. |

## Internacionalización (i18n)

### IPC Handler: `get-system-language` (`ipc-handlers/settings.js`)

Devuelve el idioma principal del sistema operativo para la detección automática de idioma en el primer arranque de la app.

```javascript
ipcMain.handle('get-system-language', () => {
  const locale = app.getLocale(); // ej. 'es-ES', 'en-US'
  const lang = locale.split('-')[0]; // 'es', 'en'
  return ['es', 'en'].includes(lang) ? lang : 'es'; // fallback a 'es'
});
```

**Uso desde el frontend:**
```js
const lang = await window.electronAPI.getSystemLanguage(); // 'es' | 'en'
```

Este handler se utiliza en `App.jsx` → `loadAppSettings()` cuando es la primera vez que se abre la app (`isFirstRun === true`) para aplicar el idioma del SO automáticamente y guardarlo en `settings.uiLanguage`.

### Migración de settings.json: `load-settings` (`ipc-handlers/settings.js`)

`aiProvider`/`embeddingProvider` ya no distinguen `'geminifree'` de `'gemini'` (una sola configuración de Gemini, sin tier free/pro separado). El handler `load-settings` es el **único punto de normalización**: al leer `settings.json`, `migrateGeminiFreeTier(settings)` reescribe `'geminifree'` → `'gemini'` y rescata `geminiApiKey`/`geminiModel` desde los campos legacy `geminiFreeApiKey`/`geminiFreeModel` si el campo nuevo está vacío. Si hubo cambios, persiste el archivo migrado antes de devolver `{ success, settings }`. Como todo el resto de la app (renderer vía `getSettings()`, y el propio proceso principal en `embeddingService.js`) lee `settings.json` después de este primer `load-settings`, no hace falta duplicar la migración en ningún otro sitio.

## Almacenamiento Configurable

### Ruta de la Base de Datos (`databasePath`)
Permite guardar `recordings.db` en un directorio personalizado (útil para discos externos, NAS, etc.).

**Campo en `settings.json`:** `databasePath` (ej. `/Volumes/Disco/recordings.db`)

**Flujo al arrancar:**
1. `main.js` lee `settings.json` antes de `dbService.init()`.
2. Si `databasePath` existe y su directorio padre es accesible → usa esa ruta.
3. Si el directorio no existe (disco no montado) → `dialog.showMessageBox` de aviso, `global.usingFallbackDb = true`, usa `{userData}/recordings.db`.
4. El renderer llama a `getDbStatus()` y si `usingFallback === true`, muestra un banner amarillo persistente en `App.jsx`.

**Cambio en caliente desde Settings:**
1. El usuario selecciona un directorio → se muestra un modal con dos opciones: "Mover y cambiar ruta" / "Solo cambiar ruta".
2. Se llama al IPC `change-db-path` con `{ newPath, migrate }`.
3. El handler de `ipc-handlers/settings.js`:
   - Si `migrate=true`: copia el archivo con `fs.copyFileSync`.
   - Llama a `dbService.close()` + `dbService.init(newPath)`.
   - Persiste `databasePath` en `settings.json`.
   - Resetea `global.usingFallbackDb = false`.

**Importante:** `settings.json` NO se modifica si el disco no está disponible al arrancar. Cuando vuelve el disco y se reinicia la app, vuelve automáticamente a la ruta configurada.

## Integraciones OAuth (Google Chat / Teams)

### Tablas SQLite
- **`platform_connections`** — almacena cuentas OAuth conectadas. Los tokens se cifran con `safeStorage` de Electron.
- **`project_integrations`** — canales vinculados a un chat específico (`chat_id`), con `date_from` / `date_to` opcionales para filtrar el rango de mensajes, y `last_sync_at` para la sincronización incremental.

### Flujo OAuth (Deep-link)
1. `main.js` registra el protocolo `airecorder://` con `app.setAsDefaultProtocolClient`.
2. El renderer llama a `startOAuthFlow({ platform, settings })` → abre el navegador en la URL de autorización.
3. El proveedor redirige a `airecorder://google-chat-callback?code=...&state=...`.
4. macOS dispara `app.on('open-url')`, Windows/Linux `app.on('second-instance')`. Ambos llaman a `handleOAuthCallback(url)`.
5. Los tokens se intercambian, se cifran y se guardan en `platform_connections`.

### Handlers IPC (`ipc-handlers/integrations-oauth.js`)
| Canal IPC | Descripción |
|-----------|-------------|
| `start-oauth-flow` | Inicia flujo OAuth, abre navegador |
| `get-platform-connections` | Lista cuentas conectadas (sin tokens) |
| `disconnect-platform` | Elimina conexión y sus integraciones |
| `get-available-channels` | Lista espacios/canales del proveedor |
| `get-project-integrations` | Canales vinculados a un proyecto |
| `get-chat-integrations` | Canales vinculados a un chat específico |
| `link-channel-to-project` | Vincula canal a proyecto |
| `link-channel-to-chat` | Vincula canal a un chat (con `chatId`, `dateFrom`, `dateTo`) |
| `unlink-channel-from-project` | Desvincula canal de proyecto |
| `unlink-channel-from-chat` | Desvincula canal de chat |
| `sync-project-integrations` | Descarga mensajes nuevos de todos los canales del proyecto |
| `sync-chat-integrations` | Descarga mensajes nuevos de los canales de un chat |

### Sincronización incremental
- Cada sync lee `last_sync_at` de la integración. Si es la primera vez, descarga todo (respetando `date_from` si se configuró).
- Los mensajes se convierten a formato canónico de transcripción (`[H:MM:SS - H:MM:SS] emoji SPEAKER:\n   texto`) usando `chatSyncUtils.js`.
- Se guardan como grabación (`recordings` table) con `transcription_model = 'gchat-sync' | 'teams-sync'`, y se vinculan al proyecto.

### Importación de Conversaciones (`ipc-handlers/integrations.js`)

Permite importar archivos de conversación en texto plano (`.txt`, `.md`, `.vtt`, `.srt`) directamente como grabaciones transcriptas. El flujo es de dos pasos: primero se selecciona y lee el archivo, luego el frontend lo parsea y envía los segmentos para guardar.

#### Handlers IPC
| Canal IPC | Descripción |
|-----------|-------------|
| `select-conversation-file` | Abre diálogo de selección filtrado a `.txt`, `.md`, `.vtt`, `.srt`. Devuelve `{ success: true, raw, fileName, ext, filePath, fileSize }` o `{ success: true, canceled: true }` o `{ success: false, error }` |
| `save-conversation-import` | Recibe `{ fileName, raw, ext, segments }`. Crea carpeta `conv_import_{baseName}_{timestamp}/`, escribe `analysis/raw_import.{ext}`, `analysis/transcripcion_combinada.json`, `analysis/transcripcion_combinada.txt` y `metadata.json`. Llama a `dbService.saveRecording` con `status='transcribed'` y `transcription_model='conversation-import'`. Devuelve `{ success: true, recording: { id, relative_path } }` o `{ success: false, error }` |

#### Métodos expuestos en `preload.js`
| Método | Descripción |
|--------|-------------|
| `selectConversationFile()` | Abre el diálogo de selección de archivo de conversación |
| `saveConversationImport(data)` | Guarda la conversación parseada como nueva grabación transcripción |

## 5. Preparación del Código (Build de producción)

El código es open source (repositorio público en GitHub), por lo que no se aplica ofuscación. El build de producción solo prepara el código:

1. **Inyección de variables** (`scripts/prepare-electron.js`): Copia `electron/` → `electron-dist/` y reemplaza `process.env.VITE_*` por los valores literales del `.env`. Necesario porque la app empaquetada no incluye `.env` y esas variables serían `undefined` en runtime (Sentry DSN, etc.).
2. **Minificación frontend**: Vite minifica el código React en producción.

**Nota**: La preparación solo se ejecuta en la cadena de build (`npm run electron:build`). En desarrollo (`npm run dev`), se usa el código original y `dotenv` carga el `.env` directamente.

## 6. Adjuntos de Grabaciones (`ipc-handlers/attachments.js`)

Gestiona archivos adjuntos (imágenes y documentos) asociados a cada grabación. Los archivos se almacenan en `<grabacion>/attachments/` en disco. No requiere tabla en SQLite.

### Tipos soportados
| Extensión | Tipo | Procesamiento |
|-----------|------|---------------|
| `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` | `image` | Base64 para envío multimodal al LLM |
| `.pdf` | `pdf` | Extracción de texto con `pdf-parse` |
| `.txt`, `.md` | `text` | Lectura directa como texto |

### Handlers IPC
| Canal IPC | Descripción |
|-----------|-------------|
| `get-attachments(recordingId)` | Lista los adjuntos de una grabación (`{filename, type, size, mimeType, createdAt}[]`) |
| `pick-and-add-attachment(recordingId)` | Abre el file picker del SO y copia el archivo a `attachments/` |
| `delete-attachment(recordingId, filename)` | Elimina un adjunto del disco |
| `read-attachment-content(recordingId, filename)` | Lee el contenido: `{type: 'image'|'text', data, mimeType}` |
| `get-attachment-thumbnail(recordingId, filename)` | Retorna `data:image/...;base64,...` para preview de imágenes |
| `save-pasted-text(recordingId, text, filename)` | Guarda texto como archivo `.txt` en `attachments/`. Devuelve `{attachment: {...}}` |

### Métodos expuestos en `preload.js`
| Método | Descripción |
|--------|-------------|
| `getAttachments(recordingId)` | Ver lista de adjuntos |
| `pickAndAddAttachment(recordingId)` | Subir archivo via file picker |
| `deleteAttachment(recordingId, filename)` | Eliminar adjunto |
| `readAttachmentContent(recordingId, filename)` | Leer contenido (base64 o texto) |
| `getAttachmentThumbnail(recordingId, filename)` | Data URL para thumbnail de imagen |
| `savePastedText(recordingId, text, filename)` | Guardar texto pegado como archivo `.txt` |

### Estrategia de naming y colisiones
El handler `save-pasted-text` implementa las siguientes reglas:
1. **Sanitización:** Elimina caracteres inválidos (`<>:"/\|?*`) del nombre proporcionado.
2. **Default:** Si el nombre está vacío, usa `Conversacion pegada`.
3. **Extensión:** Fuerza automáticamente la extensión `.txt`.
4. **Colisiones:** Si el archivo ya existe, añade sufijo numérico: `nombre_1.txt`, `nombre_2.txt`, etc.

### Integración con IA
- **Imágenes:** Se convierten a base64 y se pasan como `options.images` en `callProvider`/`callProviderStreaming`. Gemini y Ollama (modelos de visión como LLaVA) los procesan como partes multimodales.
- **Documentos (PDF/texto):** El texto extraído se inyecta en los prompts como sección `--- DOCUMENTOS ADJUNTOS ---`.
- El contexto se recalcula en tiempo real cuando el usuario activa/desactiva adjuntos en el chat (`ContextBar` se actualiza).

## 7. Identificación de Hablantes (`speakers` + `speaker_embeddings`)

Tablas SQLite para la diarización y reconocimiento de hablantes entre sesiones.

### Tablas

#### `recording_speaker_resolutions`
Tabla de idempotencia: registra qué `ephemeralId` de una grabación fue ya resuelto a qué `speakerId`, para que al reabrir la grabación no se vuelvan a crear duplicados ni se recalculen matches.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER (PK) | Autoincremental |
| `recording_id` | INTEGER | Referencia a `recordings(id)` |
| `ephemeral_id` | TEXT | Ej. "SPEAKER_00" |
| `speaker_id` | TEXT | UUID del perfil resuelto |
| `UNIQUE` | — | `(recording_id, ephemeral_id)` — un hablante por grabación |

#### `speakers`
Representa a una persona identificada (perfiles de hablante).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | TEXT (PK) | UUID generado externamente |
| `display_name` | TEXT | Nombre visible del hablante |
| `created_at` | DATETIME | Fecha de creación (auto) |

#### `speaker_embeddings`
Almacena los vectores de embedding de voz asociados a cada hablante y grabación.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER (PK) | Autoincremental |
| `speaker_id` | TEXT (FK) | Referencia a `speakers(id)`, `ON DELETE CASCADE` |
| `embedding` | BLOB | Vector de embedding en binario (JSON serializado) |
| `recording_id` | INTEGER (FK) | Referencia a `recordings(id)`, `ON DELETE SET NULL` |
| `created_at` | DATETIME | Fecha de creación (auto) |

### Notas de diseño
- El `id` de `speakers` es un UUID (TEXT) en lugar de AUTOINCREMENT para permitir generación distribuida sin colisiones.
- La FK de `speaker_embeddings.recording_id` usa `ON DELETE SET NULL` para preservar los embeddings aunque se elimine la grabación de origen.
- Las tablas se crean al arrancar la app desde `dbService.init()` usando `CREATE TABLE IF NOT EXISTS` (no requieren migración si la tabla ya existe).

### Capa de Re-identificación (`services/speakerManager.js` + `database/speakerRepository.js`)

La lógica de re-identificación está separada en dos módulos con responsabilidades distintas:

#### `electron/database/speakerRepository.js`
Capa de **acceso a datos**: implementa la búsqueda por similitud coseno.

- `findMatchingSpeaker(embedding, threshold=0.85)` — compara el embedding de entrada contra todos los almacenados en `speaker_embeddings`. Retorna `{ speakerId, similarity }` si hay match por encima del umbral, o `null` si no.
- `findCandidateSpeakers(embedding, minThreshold=0.70, maxThreshold=0.85)` — igual que el anterior pero retorna todos los hablantes cuya similitud está **entre** los dos umbrales (zona de sugerencias). Retorna array de `{ speakerId, displayName, similarity }` ordenado por similitud descendente.
- Implementa las operaciones vectoriales en JS puro (`dotProduct`, `magnitude`, `cosineSimilarity`, `deserializeEmbedding`) sin dependencias externas.

#### `electron/services/speakerManager.js`
Capa de **lógica de negocio**: orquesta el flujo de re-identificación.

- `processEmbeddings(speakerEmbeddings, recordingId, threshold)` — recibe el mapa `{ "SPEAKER_00": [float, ...] }` producido por Python. Es **idempotente**: en la primera apertura resuelve cada hablante y persiste el resultado en `recording_speaker_resolutions`; en aperturas posteriores lee directamente de esa tabla sin recalcular.  
  Retorna `{ resolutionMap, pendingSuggestions }`:
  - `resolutionMap`: `{ "SPEAKER_00": { speakerId, displayName, isNew } }`
  - `pendingSuggestions`: array de candidatos con similitud 0.70–0.85 que el usuario debe confirmar manualmente.
- `confirmSpeakerSuggestion({ recordingId, ephemeralId, confirmedSpeakerId, currentSpeakerId })` — cuando el usuario acepta una sugerencia: reasigna los embeddings del perfil temporal (`currentSpeakerId`) al confirmado (`confirmedSpeakerId`) y elimina el perfil temporal. Actualiza `recording_speaker_resolutions`. Retorna `{ success, displayName }`.
- `assignAlias(speakerId, alias, embedding, recordingId)` — actualiza el alias visible de un hablante y opcionalmente guarda un embedding actualizado. Utilizado cuando el usuario edita el nombre desde el frontend.

### Flujo completo: Python → Node → Frontend

```
diarization_analyzer.py
  └─ Genera: analysis/diarization.json
       { "version": "2.0", "segments": [...], "speaker_embeddings": { "SPEAKER_00": [...] } }

audio_sync_analyzer.py
  └─ Usa diarization.json (solo los segments para asignar speaker al texto)
  └─ Genera: analysis/transcripcion_combinada.json
       { "metadata": {...}, "segments": [{ "speaker": "SPEAKER_00", "text": "...", ... }] }

IPC "get-transcription" (ipc-handlers/recordings.js)
  └─ Lee transcripcion_combinada.json
  └─ Lee diarization.json (si existe) → extrae speaker_embeddings
  └─ speakerManager.processEmbeddings(speakerEmbeddings, recordingId)  [IDEMPOTENTE]
       ├─ 1ª apertura: speakerRepository.findMatchingSpeaker / findCandidateSpeakers
       │     ├─ similitud ≥ 0.85  → match automático (retorna UUID + alias existente)
       │     ├─ 0.70 ≤ sim < 0.85 → sugerencia pendiente (acumulada en pendingSuggestions)
       │     └─ sim < 0.70        → nuevo perfil (dbService.createSpeaker + saveSpeakerEmbedding)
       │   persiste resultado en recording_speaker_resolutions
       ├─ 2ª+ apertura: lee recording_speaker_resolutions → sin recálculo
       └─ Retorna: { resolutionMap, pendingSuggestions }
  └─ pendingSuggestions se enriquecen con firstSegmentStart (segundos en audio)
  └─ Respuesta: { success: true, transcription: { ...segments, speakerResolution: { ...resolutionMap, _pendingSuggestions: [...] } } }

Frontend (React + Redux)
  └─ TranscriptionViewer recibe transcription con speakerResolution
  └─ useEffect([transcription.speakerResolution]):
       └─ dispatch(setAliases(speakerResolution))   [ignora _pendingSuggestions]
            └─ speakersSlice.map["SPEAKER_00"] = { speakerId, displayName }
  └─ SpeakerLabel consulta selectDisplayName("SPEAKER_00") → muestra "Juan"
  └─ SpeakerSuggestions lee _pendingSuggestions y muestra banner de confirmación
       ├─ Botón ▶ reproduce fragmento de 5s desde firstSegmentStart
       ├─ "Sí, es él/ella" → IPC confirm-speaker-suggestion → speakerManager.confirmSpeakerSuggestion
       │     └─ dispatch(updateAlias({ ephemeralId, speakerId, displayName })) en Redux
       └─ "No es él/ella" → descarta la sugerencia (solo en UI, sin IPC)

  (Al montar TranscriptionViewer)
  └─ IPC "get-all-speakers" → setAllSpeakers(data) en Redux
       └─ SpeakerLabel y MergeSpeakersModal usan la lista para autocompletado

  (Cuando el usuario edita el nombre en SpeakerLabel)
  └─ IPC "assign-alias" → speakerManager.assignAlias(speakerId, "Juan García", embedding, recordingId, ephemeralId)
       ├─ si el alias ya existe como perfil persistente → remapea el speaker actual a ese UUID
       │     ├─ reasigna embeddings
       │     ├─ reasigna recording_speaker_resolutions
       │     └─ elimina el perfil temporal/anterior
       ├─ si el alias no existe → renombra el perfil actual (o crea uno nuevo si no había speakerId)
       └─ actualiza la resolución de la grabación actual: (recording_id, ephemeral_id) → speaker_id
  └─ solo si el backend confirma `{ success, speakerId, displayName }`:
       └─ updateAlias({ ephemeralId, speakerId, displayName }) en Redux

  (Cuando el usuario fusiona hablantes via MergeSpeakersModal)
  └─ Para cada ephemeralId seleccionado:
       └─ IPC "assign-alias" → persiste alias unificado en BD
  └─ mergeSpeakers({ sourceEphemeralIds, targetSpeakerId, displayName }) en Redux
       └─ Todos los segmentos de los IDs fusionados se renderizan con el nuevo alias
```

> **Phase 5:** La resolución de hablantes ocurre automáticamente al cargar la transcripción,
> sin requerir una llamada IPC adicional desde el frontend. El canal `resolve-speaker` sigue
> disponible para usos ad-hoc (ej. futuros casos de resolución en caliente).

### Handler `get-transcription` — Contrato de Respuesta (Phase 5+)

```json
{
  "success": true,
  "transcription": {
    "metadata": { "total_duration": 123.4, ... },
    "segments": [
      { "speaker": "SPEAKER_00", "text": "Hola", "start": 0.0, "end": 1.2, ... }
    ],
    "speakerResolution": {
      "SPEAKER_00": { "speakerId": "uuid-...", "displayName": "Juan", "isNew": false },
      "SPEAKER_01": { "speakerId": "uuid-...", "displayName": "Speaker_02", "isNew": true },
      "_pendingSuggestions": [
        {
          "ephemeralId": "SPEAKER_02",
          "candidateSpeakerId": "uuid-...",
          "candidateDisplayName": "María",
          "similarity": 0.78,
          "currentDisplayName": "Speaker_03",
          "currentSpeakerId": "uuid-...",
          "firstSegmentStart": 42.3
        }
      ]
    }
  }
}
```

Si no hay `diarization.json` o no tiene `speaker_embeddings`, el campo `speakerResolution` es `{}` (objeto vacío) y la UI muestra el `ephemeralId` original como fallback.

### Política de retrocompatibilidad (grabaciones legacy v1.0)

- **Formato legacy soportado:** si `analysis/diarization.json` antiguo es una lista de segmentos o no contiene `speaker_embeddings`, `get-transcription` usa `resolveFromSegments()`. Si existen filas en `recording_speaker_resolutions` para esa grabación, esas filas tienen prioridad como fuente de verdad.
- **Fallback visual obligatorio:** `SpeakerLabel` muestra el valor crudo del segmento (`SPEAKER_00`, `SPEAKER_01`, `SISTEMA`, etc.) cuando no existe una resolución válida o faltan UUIDs persistentes.
- **Modo solo lectura para legacy:** si `speakerResolution` falta, está vacío o no trae `speakerId` con formato UUID, el frontend limpia el mapa Redux de aliases y desactiva toda la UI de edición/fusión. En ese estado no se muestra el icono de edición ni el botón `Fusionar hablantes`.
- **Grabaciones nuevas (v2.0):** solo las transcripciones cuyo `speakerResolution` contiene UUIDs válidos permanecen en modo interactivo (edición inline + merge).

### Handlers IPC (`ipc-handlers/speakers.js`)

| Canal IPC | Payload | Respuesta |
|-----------|---------|-----------|
| `resolve-speaker` | `{ speakerEmbeddings, recordingId?, threshold? }` | `{ success, data: { "SPEAKER_00": { speakerId, displayName, isNew } } }` |
| `assign-alias` | `{ speakerId?, alias, embedding?, recordingId?, ephemeralId? }` | `{ success, speakerId?, displayName?, error? }` |
| `get-all-speakers` | *(sin payload)* | `{ success, data: [{ id, display_name, created_at, updated_at }] }` |
| `merge-similar-speaker` | `{ targetSpeakerId, sourceSpeakerId }` | `{ success: true, mergedName }` o `{ success: false, error }` |
| `preview-merge-speakers` | `{ sourceSpeakerId, targetSpeakerId }` | `{ success: true, data: { finalSourceId, finalTargetId, swapped, sourceEmbeddings, targetEmbeddings, warnings[] } }` o `{ success: false, error }` |
| `get-speaker-first-segment-time` | `{ speakerId, recordingId }` | `{ success: true, data: { startTime, ephemeralId } }` o `{ success: false, error }` |
| `delete-speaker-recording-resolution` | `{ speakerId, recordingId }` | `{ success: true, deletedCount, deletedEmbeddings, deletedResolutions }` o `{ success: false, error }` |

> `assign-alias` acepta un `speakerId` opcional. Si `alias` coincide con un hablante ya existente, el backend remapea el speaker actual a ese perfil persistente y actualiza también `recording_speaker_resolutions`. La UI no debe asumir éxito optimista: solo refleja la respuesta confirmada por BD.
> `get-all-speakers` se llama al montar `TranscriptionViewer` para poblar el autocompletado y pre-cargar aliases.
> `preview-merge-speakers` permite validar un merge manual antes de ejecutarlo: si el usuario elige una dirección que perdería embeddings, el backend devuelve `swapped: true` y ajusta `finalSourceId/finalTargetId` para preservar los embeddings. La UI debe mostrar también `warnings[]` para que el usuario verifique qué embeddings se van a reasignar. Si origen y destino son el mismo speaker, el handler devuelve error y no genera preview.
> `delete-speaker-recording-resolution` elimina en una **transacción atómica** la relación hablante-grabación: borra embeddings de `speaker_embeddings` para `(speakerId, recordingId)` y resoluciones de `recording_speaker_resolutions` para la misma clave. Si algo falla, se revierte todo.
> En `resolveFromSegments` (fallback sin `speaker_embeddings`, como `conversation-import`), también se persiste `recording_speaker_resolutions` para cada `ephemeralId`. Esto garantiza que el detalle de hablante muestre tanto grabaciones con audio como grabaciones solo texto.
> `save-conversation-import` ejecuta también la resolución de speakers sobre los segmentos normalizados y persiste `recording_speaker_resolutions` en el momento de importar, evitando que las grabaciones solo texto queden huérfanas en la vista de detalle de hablantes.

#### `get-transcription` (Phase 5 — resolución automática)

Desde Phase 5, `get-transcription` (`ipc-handlers/recordings.js`) incluye la resolución de hablantes en su respuesta. No requiere una llamada IPC adicional desde el frontend.

| Canal IPC | Payload | Respuesta |
|-----------|---------|-----------|
| `get-transcription` | `recordingId` | `{ success, transcription: { segments, metadata, speakerResolution: { ...map, _pendingSuggestions } } }` |

El campo `speakerResolution` es `{}` si no existe `diarization.json` o no tiene `speaker_embeddings`. `_pendingSuggestions` es un array vacío `[]` si no hay sugerencias pendientes.

#### `get-transcription-txt` — resolución de nombres de hablantes (issue #64)

El handler `get-transcription-txt` (`ipc-handlers/recordings.js`) aplica resolución de nombres antes de retornar el texto plano al renderer. Los tokens de diarización (`SPEAKER_XX`) se sustituyen por sus `display_name` persistidos en BD sin modificar el archivo en disco.

| Canal IPC | Payload | Respuesta |
|-----------|---------|-----------|
| `get-transcription-txt` | `recordingId` | `{ success: true, text: string }` — `text` contiene nombres legibles en lugar de `SPEAKER_XX` cuando existen resoluciones en BD |

**Comportamiento:**
- Llama a `dbService.getRecording(folderName)` para obtener el `id` numérico de la grabación.
- Invoca `resolveSpeakersInText(numericId, txtData, dbService)` (`electron/services/speakerResolver.js`).
- Si no existen resoluciones (`null`) o el mapa está vacío, retorna el texto crudo sin cambios.
- El archivo `transcripcion_combinada.txt` en disco nunca es modificado.
- Las resoluciones se leen frescas de BD en cada llamada (sin caché en memoria).

#### `confirm-speaker-suggestion` (Phase 6 — confirmación manual)

| Canal IPC | Payload | Respuesta |
|-----------|---------|-----------|
| `confirm-speaker-suggestion` | `{ recordingId, ephemeralId, confirmedSpeakerId, currentSpeakerId }` | `{ success, displayName?, error? }` |

### Métodos expuestos en `preload.js`

| Método | Descripción |
|--------|-------------|
| `resolveSpeakers(params)` | Resuelve el mapa de hablantes efímeros a UUIDs persistentes |
| `assignSpeakerAlias(params)` | Persiste un alias personalizado y opcionalmente el embedding |
| `getAllSpeakers()` | Devuelve todos los hablantes de BD (para autocompletado en UI) |
| `previewMergeSpeakers(params)` | Previsualiza un merge y avisa si la dirección elegida reasigna embeddings |
| `confirmSpeakerSuggestion(params)` | Confirma una sugerencia pendiente: reasigna embeddings y actualiza BD |
| `deleteSpeakerRecordingResolution(params)` | Elimina relación hablante-grabación de forma atómica (resolución + embeddings por grabación) |

### Función `dbService.getAllSpeakers()`

Añadida en `electron/database/dbService.js`. Ejecuta:
```sql
SELECT id, display_name, created_at, updated_at FROM speakers ORDER BY display_name ASC
```
Se usa exclusivamente como fuente de datos para el autocompletado de alias en `SpeakerLabel` y `MergeSpeakersModal`.

### Función `dbService.getSpeakerEmbeddingCount(speakerId)`

Añadida en `electron/database/dbService.js` como proxy al dominio de speakers para soportar validaciones previas de merge.

- Devuelve `number` con el total de embeddings asociados al hablante.
- Se usa en `ipc-handlers/speakers.js` dentro de `preview-merge-speakers` para detectar si la dirección elegida provocaría pérdida de embeddings y activar el auto-swap (`swapped: true`) cuando corresponde.

## 8. Plantillas de Notas (`templates` + `recording_notes`)

Sistema de generación de notas estructuradas basadas en plantillas predefinidas o personalizadas.

### Nuevas Tablas SQLite

#### `note_templates`
Almacena las plantillas de notas (tanto predefinidas como personalizadas).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `slug` | TEXT (PK) | Identificador único (ej. `standup`, `one-on-one`, `custom-abc123`) |
| `name` | TEXT | Nombre visible (ej. "Standup", "Daily Journal") |
| `icon` | TEXT | Emoji o nombre de icono |
| `description` | TEXT | Descripción breve |
| `expert_id` | TEXT | Experto por defecto para generar notas (ej. `general`, `developer`) |
| `sections_json` | TEXT | Array de secciones en JSON (ver tipos abajo) |
| `is_builtin` | INTEGER | `1` = predefinida, `0` = personalizada |
| `enabled` | INTEGER | `1` = activa, `0` = deshabilitada |
| `created_at` | DATETIME | Fecha de creación |
| `updated_at` | DATETIME | Fecha de última modificación |

#### `recording_notes`
Almacena las notas generadas para cada grabación.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER (PK) | Autoincremental |
| `recording_id` | INTEGER (FK) | Referencia a `recordings(id)`, `ON DELETE CASCADE` |
| `template_slug` | TEXT | Slug de la plantilla usada |
| `content_md` | TEXT | Contenido en Markdown generado |
| `created_at` | DATETIME | Fecha de creación |

### Tipos de Sección
Cada plantilla tiene un array de secciones con estos tipos:
- `text` — Texto libre
- `list` — Lista con bullet points
- `checklist` — Lista de checkboxes
- `table` — Tabla estructurada
- `qa` — Pregunta y respuesta
- `summary` — Resumen ejecutivo
- `action_items` — Elementos de acción/tareas
- `custom` — Sección libre con instrucciones custom

### Handlers IPC (`ipc-handlers/templates.js`)

| Canal IPC | Payload | Descripción |
|-----------|---------|-------------|
| `templates:list` | — | Lista todas las plantillas habilitadas (builtin + custom) |
| `templates:getBySlug` | `slug` | Obtiene una plantilla por su slug |
| `templates:create` | `{ slug, name, icon, description, expert_id, sections_json }` | Crea plantilla personalizada |
| `templates:update` | `slug, { data }` | Actualiza plantilla personalizada |
| `templates:delete` | `slug` | Elimina plantilla personalizada |
| `templates:toggleEnabled` | `slug, enabled` | Habilita/deshabilita plantilla |
| `templates:getNotesForRecording` | `recordingId` | Obtiene todas las notas de una grabación |
| `templates:saveNote` | `{ recordingId, templateSlug, contentMd }` | Guarda nueva nota |
| `templates:updateNote` | `id, contentMd` | Actualiza contenido de nota |
| `templates:deleteNote` | `id` | Elimina una nota |

### Métodos expuestos en `preload.js`

| Método | Descripción |
|--------|-------------|
| `templates.list()` | Lista plantillas habilitadas |
| `templates.getBySlug(slug)` | Obtiene plantilla por slug |
| `templates.create(data)` | Crea plantilla personalizada |
| `templates.update(slug, data)` | Actualiza plantilla |
| `templates.delete(slug)` | Elimina plantilla |
| `templates.toggleEnabled(slug, enabled)` | Habilita/deshabilita |
| `templates.getNotesForRecording(recordingId)` | Notas de una grabación |
| `templates.saveNote(data)` | Guarda nota |
| `templates.updateNote(id, contentMd)` | Actualiza nota |
| `templates.deleteNote(id)` | Elimina nota |

## 9. `projectsDatabase.README.md`
Existe un archivo adicional en esta carpeta (`projectsDatabase.README.md`) que detalla un motor de base de datos específico en JSON que sirve de legado o apoyo para ciertos datos de proyecto. Revísalo si vas a tocar `projectsDatabase.js`.
