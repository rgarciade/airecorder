# 🖥️ Documentación de Electron Backend (AIRecorder)

Este directorio contiene el "Proceso Principal" (Main Process) de la aplicación, encargado de manejar ventanas, sistema de archivos, procesos hijos (Python), bases de datos y la comunicación con el Frontend de React.

## 1. El Orquestador: `main.js` y `ipc-handlers/`

El archivo `main.js` es el corazón de la aplicación y actúa como orquestador. Para mantener el código limpio y evitar un archivo monolítico, la lógica de comunicación está dividida:

*   **Inicialización (`main.js`):** Arranca la base de datos (`dbService.init()`), sincroniza archivos vs base de datos (`migrationService.syncRecordings()`), arranca el `transcriptionManager` y crea la ventana.
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

### Almacenamiento Dual (Dual Storage)
El sistema guarda metadatos en la base de datos (ID, duración, estados), pero el contenido pesado (archivos WAV, archivos JSON de los resúmenes de IA, transcripciones txt) reside en el sistema de archivos (Filesystem).
*   *Importante:* El ID de la grabación (`recordingId`) en la base de datos es numérico. En el disco, las carpetas de las grabaciones usan strings (`relative_path`). La función `getFolderPathFromId()` se utiliza para traducir el ID numérico a la ruta correcta en disco.

## 4. `projectsDatabase.README.md`
Existe un archivo adicional en esta carpeta (`projectsDatabase.README.md`) que detalla un motor de base de datos específico en JSON que sirve de legado o apoyo para ciertos datos de proyecto. Revísalo si vas a tocar `projectsDatabase.js`.