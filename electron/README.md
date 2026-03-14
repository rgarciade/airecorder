# 🖥️ Documentación de Electron Backend (AIRecorder)

Este directorio contiene el "Proceso Principal" (Main Process) de la aplicación, encargado de manejar ventanas, sistema de archivos, procesos hijos (Python), bases de datos y la comunicación con el Frontend de React.

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
*   **Estados atascados:** Restablece tareas con estado `processing` en la cola a `pending` o `failed` si la app se cerró de forma inesperada.
*   **Ruta configurable:** La BD se inicializa con la ruta que `main.js` le pasa (por defecto `{userData}/recordings.db`, o la personalizada de `settings.databasePath`). El singleton `DbService` expone:
    *   `init(dbPath)` — abre/crea la BD en la ruta indicada y registra `this.dbPath`.
    *   `close()` — cierra la conexión actual (necesario antes de cambiar la ruta en caliente).
    *   `getCurrentPath()` — devuelve la ruta activa de la BD.

### Almacenamiento Dual (Dual Storage)
El sistema guarda metadatos en la base de datos (ID, duración, estados), pero el contenido pesado (archivos WAV, archivos JSON de los resúmenes de IA, transcripciones txt) reside en el sistema de archivos (Filesystem).
*   *Importante:* El ID de la grabación (`recordingId`) en la base de datos es numérico. En el disco, las carpetas de las grabaciones usan strings (`relative_path`). La función `getFolderPathFromId()` se utiliza para traducir el ID numérico a la ruta correcta en disco.

## 4. Sistema de Actualizaciones (`services/updateChecker.js` + `ipc-handlers/updates.js`)

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

## 5. Protección de Código (Build de producción)

El build de producción aplica 3 capas de protección:

1. **Ofuscación JS** (`scripts/obfuscate-electron.js`): Copia `electron/` → `electron-obfuscated/` y ofusca todos los `.js` con `javascript-obfuscator` (control flow flattening, string array encoding, dead code injection).
2. **Protección ASAR** (`scripts/protect-asar.js`): Hook `afterPack` de electron-builder que aplica `asarmor` (bloat patch) al `.asar` para dificultar la extracción.
3. **Minificación frontend**: Vite minifica el código React en producción.

**Nota**: La ofuscación solo se ejecuta en la cadena de build (`npm run electron:build`). En desarrollo (`npm run dev`), se usa el código original sin modificar.

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

### Métodos expuestos en `preload.js`
| Método | Descripción |
|--------|-------------|
| `getAttachments(recordingId)` | Ver lista de adjuntos |
| `pickAndAddAttachment(recordingId)` | Subir archivo via file picker |
| `deleteAttachment(recordingId, filename)` | Eliminar adjunto |
| `readAttachmentContent(recordingId, filename)` | Leer contenido (base64 o texto) |
| `getAttachmentThumbnail(recordingId, filename)` | Data URL para thumbnail de imagen |

### Integración con IA
- **Imágenes:** Se convierten a base64 y se pasan como `options.images` en `callProvider`/`callProviderStreaming`. Gemini y Ollama (modelos de visión como LLaVA) los procesan como partes multimodales.
- **Documentos (PDF/texto):** El texto extraído se inyecta en los prompts como sección `--- DOCUMENTOS ADJUNTOS ---`.
- El contexto se recalcula en tiempo real cuando el usuario activa/desactiva adjuntos en el chat (`ContextBar` se actualiza).

## 7. `projectsDatabase.README.md`
Existe un archivo adicional en esta carpeta (`projectsDatabase.README.md`) que detalla un motor de base de datos específico en JSON que sirve de legado o apoyo para ciertos datos de proyecto. Revísalo si vas a tocar `projectsDatabase.js`.