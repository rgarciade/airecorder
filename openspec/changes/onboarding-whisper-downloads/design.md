# Design: Gestión explícita de descargas de modelos Whisper (issue #149)

## Technical Approach

Node orquesta, Python ejecuta (Enfoque 1 del proposal). `resourceManager` (Electron main) es la única fuente de verdad en runtime del inventario, la cola de descargas y el chequeo de espacio; expone todo por el canal aislado `resources:*`. Python solo hace dos cosas: descargar con progreso y cargar el modelo con `local_files_only=True`.

La clave del diseño es **no reubicar la caché de HuggingFace**. La app *fija* la ruta (la calcula y la pasa explícita a cada proceso hijo) pero su valor por defecto es exactamente el default de `huggingface_hub`. Así, la "adopción de la caché preexistente" (decisión 4) deja de ser un algoritmo de detección y pasa a ser un no-problema: lo que ya está descargado sigue estando donde estaba.

## Architecture Decisions

### D1 — El inventario NO se persiste

| Opción | Tradeoff | Decisión |
|---|---|---|
| Tabla SQLite nueva | Migración aditiva + riesgo de estado mentiroso si el usuario borra `~/.cache` a mano | Rechazada |
| JSON en `userData` | Mismo problema de staleness, sin migraciones | Rechazada |
| **In-memory derivado del FS** | Recalcular en cada arranque (~5 ms) | **Elegida** |

**Rationale**: `instalado / tamaño / ruta` son datos **derivados** del sistema de archivos, no hechos del dominio. Persistirlos crea una caché que puede mentir. Lo único persistente sigue siendo `settings.whisperModel` (ya en `settings.json`). El progreso en curso es efímero por definición: muere con la app y un modelo a medias es simplemente "no instalado" en el siguiente arranque. **Elimina el riesgo de rollback del proposal** (no hay migración de BD que revertir).

### D2 — Caché HF fijada, pero al valor por defecto de HF

`resourceManager.resolveCacheDir()` resuelve en este orden y el resultado se pasa explícito a **todos** los procesos hijo:

1. `process.env.HF_HUB_CACHE`
2. `path.join(process.env.HF_HOME, 'hub')`
3. `path.join(os.homedir(), '.cache', 'huggingface', 'hub')` ← default de HF en macOS/Linux/Windows

**Alternativa rechazada**: caché propia en `userData` + detección/copia de modelos preexistentes. **Rationale**: reubicar es lo que *crea* el riesgo de re-descargar hasta 3 GB y obliga a inventar un algoritmo de validación. Con esta resolución, la app gana control determinista (deja de depender del entorno implícito del proceso hijo) y los usuarios existentes conservan sus modelos con cero lógica de adopción.

### D3 — Escaneo en Node, verificación autoritativa en Python

Node lee el layout público de la caché HF (`models--{org}--{repo}/refs/main` → sha → `snapshots/{sha}/`). Tres capas, cada una barata:

| Capa | Quién | Cuándo |
|---|---|---|
| Escaneo rápido (UI, selectores) | Node `hfCacheScanner.js` | Arranque + tras cada mutación |
| Dato autoritativo post-descarga | Python emite `DONE {path,bytes}` | Al terminar cada descarga |
| Puerta autoritativa real | `WhisperModel(local_files_only=True)` | Al transcribir |

**Alternativa rechazada**: escanear siempre vía Python. **Rationale**: spawnear un binario PyInstaller (~1.5-3 s de imports) en cada arranque solo para responder "¿existe esta carpeta?" es desproporcionado, y el inventario alimenta 4 puntos de UI. La deriva respecto a `huggingface_hub` falla **fuerte y visible** en la capa 3 (error accionable), nunca en silencio.

**Algoritmo de escaneo** (por modelo del catálogo):
1. `refs/main` existe y es legible → `sha`.
2. `snapshots/{sha}/` contiene `model.bin`, `config.json`, `tokenizer.json`, `preprocessor_config.json`, `vocabulary.*`.
3. Cada archivo se resuelve con `fs.realpathSync` (en macOS/Linux son symlinks a `blobs/`; en Windows pueden ser copias) y debe existir.
4. Tamaño = suma de `statSync(realpath).size` **deduplicando por realpath**.
5. Cualquier `blobs/*.incomplete` presente → el modelo se marca `partial`, no `installed` (una descarga interrumpida nunca crea el symlink en `snapshots/`, así que el paso 2 ya lo excluye; la detección de `.incomplete` solo alimenta el barrido de limpieza).

### D4 — Chequeo de espacio en Node con `fs.statfsSync`

Electron 39 → Node 22, `fs.statfsSync` disponible: **cero dependencias nuevas** (`check-disk-space` rechazado por eso; `shutil.disk_usage` rechazado porque duplicaría la lógica en el proceso que no toma la decisión).

`freeBytes = bavail * bsize` sobre el primer ancestro existente de `cacheDir`. `requiredBytes = catalog[id].bytes + 500 MB` de margen. Se ejecuta en **dos** momentos, según pide el issue:

- **Antes de encolar** (`resources:check-space`): la UI muestra total / libre / restante estimado y el usuario confirma.
- **Antes de arrancar cada descarga individual** de la cola: se refresca; si ya no alcanza, esa entrada pasa a `error` con motivo `insufficient-space` y la cola **continúa** con la siguiente.

### D5 — El descargador es un módulo nuevo, pero NO un binario nuevo

`python/model_resources.py` (módulo aislado, sin acoplarse a la lógica de transcripción) + **dispatch temprano** en `audio_sync_analyzer.py`, insertado tras `multiprocessing.freeze_support()` y **antes** de los imports pesados (`matplotlib` en línea 12, `librosa`/`faster_whisper` en 32-37):

```python
if len(sys.argv) > 1 and sys.argv[1] == "resources":
    from model_resources import main as resources_main
    sys.exit(resources_main(sys.argv[2:]))
```

**Alternativa rechazada**: script/binario Python separado. **Rationale — evidencia dura**: `scripts/build-python.sh` compila **un solo** spec y `package.json` empaqueta **un solo** `python-bin`. `diarization_analyzer.py` ya cae en esa trampa: `transcriptionManager.js:241-248` busca un binario que nunca se genera y hace fallback a `/usr/bin/python3` + `resourcesPath/python/` que tampoco se empaqueta. Un binario nuevo duplicaría cientos de MB y exigiría tocar spec + build script + `extraResources`. El dispatch temprano da separación de código **sin** coste de empaquetado y sin pagar los imports pesados.

### D6 — Cancelación: SIGTERM + barrido de `.incomplete`

`cancel(id)` sobre la entrada **activa**: `child.kill('SIGTERM')` → si sigue vivo a los 3 s, `SIGKILL`. Al cerrar el proceso, `resourceManager` borra los `blobs/*.incomplete` de ese repo y re-escanea. Sobre una entrada **encolada**: se elimina de la cola sin tocar procesos. Cancelar nunca deja el modelo en estado `installed` (paso 2 del escaneo lo garantiza).

### D7 — Migración `large` → `large-v3`: renombrado puro, coste cero

Evidencia: `faster_whisper/utils.py:23` mapea `"large" → "Systran/faster-whisper-large-v3"`. **Es el mismo repo, la misma carpeta de caché**. La migración silenciosa es un cambio de string en `settings.json`, sin re-descarga. Vive en `electron/utils/settingsMigrations.js` como `migrateWhisperModelAlias(settings)`, siguiendo el patrón puro y ya testeado de `migrateGeminiFreeTier`.

### D8 — Corrección del riesgo heredado: el fallback silencioso NO es a `large`

El proposal y la exploración afirman que un `task.model` falsy cae a `WHISPER_MODEL = "large"` (3 GB). **Es incorrecto**: `parse_args()` declara `--model` con `default="small"` (`audio_sync_analyzer.py:1091`) y `main()` sobrescribe la global incondicionalmente (línea 1159). El default real es `small`; la global de línea 49 es código muerto. Sigue siendo un fallo de diseño (descarga no elegida por el usuario), y el arreglo no cambia:

- Borrar `WHISPER_MODEL = "large"` (línea 49).
- `--model` pasa a `required=True`, sin `default`.
- `load_whisper_model()` usa `WhisperModel(..., download_root=args.model_cache_dir, local_files_only=True)`; si el modelo no está, imprime `ERROR:MODEL_NOT_INSTALLED::{model}` y sale con código ≠ 0.
- Node nunca llega ahí: `transcriptionManager` bloquea antes del spawn (`resourceManager.isInstalled()`).

### D9 — Bocadillo y `RecordingOverlay` conviven en un stack compartido

`RecordingOverlay.module.css:3-6` es `position: fixed; bottom: 24px; left: 24px; z-index: 10000`. Se introduce `<BottomLeftStack>` en `App.jsx` (mismo nivel que el overlay actual) con `display:flex; flex-direction: column-reverse; gap:12px` en esa misma posición fija, y `RecordingOverlay` recibe una clase modificadora `inStack` que neutraliza su `position/bottom/left`. El bocadillo queda **encima** del overlay en el flujo invertido (es decir, "debajo" en prioridad), sin cálculos de altura frágiles. Sin grabación activa, el bocadillo ocupa el `bottom: 24px` solo.

### D10 — `DiskSpaceIndicator`: componente reutilizable, sin IPC nuevo

Requisito agregado tras el design: mostrar el espacio de disco **encima** de la lista de modelos en Ajustes → Modelos y descargas, como componente reutilizable (otros puntos de la app podrán montarlo más adelante), que **refresca el dato cada vez que se monta** — no debe mostrar un valor stale heredado de un montaje anterior.

No hace falta contrato IPC nuevo: `resources.refresh()` (ya definido arriba en el contrato IPC) fuerza rescan y devuelve `Snapshot.freeBytes` + `Snapshot.cacheDir`. Se extiende `Snapshot` con `totalBytes` (mismo `statfsSync`: `blocks * bsize`) para poder mostrar "libre / total", no solo el libre.

```ts
// src/components/DiskSpaceIndicator/DiskSpaceIndicator.jsx
// Presentacional + data-fetching propio (no depende de useDownloadManager):
// useEffect(() => { window.electronAPI.resources.refresh().then(setSnapshot) }, [])
// — se re-ejecuta en cada montaje porque el array de deps está vacío y el componente
//   se desmonta/monta de nuevo al navegar (no hay memoización de instancia entre vistas).
```

Primer punto de uso: `ModelsSection.jsx` (Ajustes → Modelos y descargas), montado antes de la lista de modelos del catálogo. Reutilizable después en onboarding (`ModelStep.jsx`) sin cambios de contrato.

## Data Flow

```
Renderer (Settings / Onboarding / Bocadillo)
   │  invoke resources:download(id)
   ▼
ipc-handlers/resources.js ──► resourceManager (cola serie, 1 activa)
   │                              │
   │                              ├─ statfsSync(cacheDir)  [pre-encolado + pre-descarga]
   │                              │
   │                              └─ spawn: audio_sync_analyzer resources download
   │                                        --model <id> --cache-dir <cacheDir>
   │                                            │ stdout: PROGRESS:{json}
   │                                            │         DONE:{json} | ERROR:{json}
   │                                            ▼
   │                                   hfCacheScanner.scan(cacheDir)
   ▼                                            │
BrowserWindow.getAllWindows() ◄── 'resources:progress' (snapshot completo)
   └─► useDownloadManager ─► DownloadIndicator + Settings + 4 selectores
```

## Interfaces / Contracts

### Contrato IPC `resources:*`

Todos los `invoke` devuelven `Promise`. Todos los handlers devuelven `{ ok: boolean, ... }` (nunca lanzan al renderer).

```js
// electron/preload.js — namespace anidado (patrón ya usado: wiki:160, templates:396)
resources: {
  list:       ()   => ipcRenderer.invoke('resources:list'),        // Promise<Snapshot>
  refresh:    ()   => ipcRenderer.invoke('resources:refresh'),     // Promise<Snapshot> (fuerza rescan)
  checkSpace: (id) => ipcRenderer.invoke('resources:check-space', id),
  download:   (id) => ipcRenderer.invoke('resources:download', id),// encola; NO espera al final
  cancel:     (id) => ipcRenderer.invoke('resources:cancel', id),
  retry:      (id) => ipcRenderer.invoke('resources:retry', id),  // solo válido si item.state === 'error'
  remove:     (id) => ipcRenderer.invoke('resources:delete', id),
  getQueue:   ()   => ipcRenderer.invoke('resources:get-queue'),   // pull inicial (patrón useQueueManager)
  onProgress: (listener) => {                                      // patrón ai:codex-login-progress
    const wrapped = (_e, payload) => listener(payload);
    ipcRenderer.on('resources:progress', wrapped);
    return () => ipcRenderer.removeListener('resources:progress', wrapped); // unsubscribe explícito
  }
}
```

**Shapes**

```ts
type ResourceState = 'not-installed' | 'queued' | 'downloading' | 'installed' | 'deleting' | 'error';
// 'deleting': transitorio entre el inicio de `resources:delete` y el cierre del
// proceso Python de borrado — evita que `isInstalled()` quede stale mientras el
// borrado real (async) está en curso (guardia de `transcriptionManager.addTask`).

type ResourceItem = {
  id: 'tiny'|'base'|'small'|'medium'|'large-v3',
  repoId: string,            // 'Systran/faster-whisper-small'
  estimatedBytes: number,    // del catálogo estático
  state: ResourceState,
  installedBytes: number|null,
  path: string|null,
  recommended: boolean,      // true solo en 'small'
  error: { code: 'insufficient-space'|'network'|'cancelled'|'unknown', detail?: string } | null
};

type DownloadEntry = {
  id: string, state: 'queued'|'downloading',
  receivedBytes: number, totalBytes: number|null,
  percent: number,           // 0..100, entero
  position: number, total: number   // "2 de 3" para el bocadillo contraído
};

type Snapshot = {            // payload ÚNICO de resources:progress y de list/refresh/get-queue
  ok: true,
  cacheDir: string,
  freeBytes: number|null,     // null si `statfsSync` falló (permisos, filesystem raro, HF_HOME roto) — degrada sin crashear
  totalBytes: number|null,    // statfsSync: blocks * bsize — para "libre / total" en DiskSpaceIndicator (D10)
  items: ResourceItem[],
  queue: DownloadEntry[],    // [0] = activa; [] = sin descargas
  active: DownloadEntry|null
};
```

**Decisión de shape**: cada evento `resources:progress` lleva el **snapshot completo**, no un delta. Es idempotente, tolera eventos perdidos y le da al bocadillo "nombre + %" (contraído) y la cola entera (expandido) sin acumular estado en el renderer. Es el mismo criterio que `queue-update` (`main.js:251-255`), pero en un canal propio.

**Broadcast**: `resourceManager.setUpdateCallback(snapshot => BrowserWindow.getAllWindows().forEach(w => w.webContents.send('resources:progress', snapshot)))`, registrado en `main.js` junto a los callbacks existentes (`main.js:250-261`). Throttle de emisión a 250 ms para no saturar el IPC en descargas de 3 GB.

**Guardia de borrado** (`resources:delete`) devuelve `{ ok:false, reason }` sin borrar si:

- `reason: 'default-model'` → `id === settings.whisperModel`.
- `reason: 'in-queue'` → `SELECT 1 FROM transcription_queue WHERE model = ? AND status IN ('pending','processing')`.

El borrado efectivo usa `huggingface_hub.scan_cache_dir().delete_revisions(sha).execute()` vía `resources delete` en Python (maneja `blobs`/`refs`/`snapshots` correctamente; `rm -rf` desde Node dejaría blobs huérfanos).

### Protocolo stdout de `model_resources.py`

Una línea = un JSON, con prefijo. Node parsea por prefijo (extiende el patrón `PROGRESS:` ya existente en `transcriptionManager.js:257`).

```
PROGRESS:{"id":"small","received":123456,"total":486000000}
DONE:{"id":"small","path":"/…/snapshots/<sha>","bytes":486000000}
ERROR:{"id":"small","code":"network","detail":"…"}
```

Subcomandos: `resources scan --cache-dir P` · `resources download --model ID --cache-dir P` · `resources delete --model ID --cache-dir P`.

El progreso se obtiene pasando un `tqdm_class` propio a `huggingface_hub.snapshot_download`. **No** se puede usar `faster_whisper.utils.download_model` para descargar porque fuerza `tqdm_class=disabled_tqdm` (`utils.py:102`); sí se reutiliza su `allow_patterns` y el mapa `_MODELS` (import defensivo con `try/except` y diccionario de respaldo local).

## File Changes

| Archivo | Acción | Descripción |
|---|---|---|
| `python/model_resources.py` | Create | `scan`/`download`/`delete`; solo importa `huggingface_hub`, `json`, `os` |
| `python/audio_sync_analyzer.py` | Modify | Dispatch temprano `resources`; borrar `WHISPER_MODEL="large"` (L49); `--model` required sin default; `--model_cache_dir`; `download_root` + `local_files_only=True` (L106-123) |
| `python/audio_sync_analyzer.spec` | Modify | Añadir a `hiddenimports`: `model_resources`, `requests`, `tqdm`, `filelock`, `fsspec`, `huggingface_hub.utils` |
| `electron/services/resourceManager.js` | Create | Inventario in-memory, cola serie, espacio, spawn, broadcast |
| `electron/services/resources/modelCatalog.js` | Create | Catálogo estático versionado (id, repoId, bytes, recommended) — **única** fuente para toda la UI |
| `electron/services/resources/hfCacheScanner.js` | Create | Lector del layout HF + cálculo de tamaño con dedupe por realpath |
| `electron/services/transcriptionManager.js` | Modify | Bloqueo pre-spawn si el modelo no está instalado; pasar `--model_cache_dir` (L306-311) |
| `electron/ipc-handlers/resources.js` | Create | `registerResourcesHandlers()` |
| `electron/main.js` | Modify | `registerResourcesHandlers()` (L106-127) + broadcast `resources:progress` (L250-261) |
| `electron/preload.js` | Modify | Namespace `resources` |
| `electron/utils/settingsMigrations.js` | Modify | `migrateWhisperModelAlias` (`large` → `large-v3`) |
| `src/hooks/useDownloadManager.js` | Create | Pull inicial + suscripción (patrón `useQueueManager.js`) |
| `src/components/DownloadIndicator/` | Create | Bocadillo contraído/expandido |
| `src/components/BottomLeftStack/` | Create | Contenedor `column-reverse` compartido |
| `src/components/RecordingOverlay/RecordingOverlay.module.css` | Modify | Clase `inStack` |
| `src/App.jsx` | Modify | Montar stack + hook (L236-245) |
| `src/pages/Onboarding/useModelDownloadStep.js` + `ModelStep.jsx` | Create | Estado fuera de `Onboarding.jsx` |
| `src/pages/Onboarding/Onboarding.jsx` | Modify | Solo `STEPS` + render del paso (sin estado nuevo) |
| `src/pages/Settings/SettingsContext.jsx` | Modify | Catálogo desde IPC, no lista estática (L27-33) |
| `src/pages/Settings/components/GeneralTab/ModelsSection.jsx` | Create | "Modelos y descargas"; monta `DiskSpaceIndicator` encima de la lista de modelos |
| `src/components/DiskSpaceIndicator/` | Create | Componente reutilizable (D10): libre/total, refresca vía `resources.refresh()` en cada montaje |
| `src/services/settingsService.js` | Modify | `whisperModel: 'small'` en defaults |
| `src/pages/Home/Home.jsx`, `RecordingOverlay.jsx`, `RecordingDetailWithTranscription.jsx` | Modify | 4 selectores → solo instalados + CTA de bloqueo |
| `electron/README.md`, `README.md`, `src/i18n/locales/{es,en}.json` | Modify | Matriz de doc obligatoria + claves nuevas |

## Testing Strategy

Infra existente: `vitest run` (`npm test`), con `test/unit/electron/**` y `src/tests/**`.

| Capa | Qué | Cómo |
|---|---|---|
| Unit | `hfCacheScanner` | Fixture de árbol HF en `tmpdir` (symlinks, `.incomplete`, blob duplicado) |
| Unit | `migrateWhisperModelAlias` | Añadir a `test/unit/electron/utils/settingsMigrations.test.js` |
| Unit | Guardia de borrado | `test/unit/electron/services/resourceManager.test.js` con `transcription_queue` en memoria (patrón `test/unit/electron/database/*`) |
| Unit | Espacio | Mock de `fs.statfsSync`: suficiente / justo / insuficiente |
| Integration | Handlers `resources:*` | `test/unit/electron/ipc-handlers/resources.test.js` con `ipcMain` mockeado (patrón `wiki.test.js`) |
| Integration | Superficie de `preload` | Extender `test/unit/electron/preload.test.js` |
| Manual | PyInstaller | **Bloqueante en PR 1**: `npm run electron:build:dir` + ejecutar `audio_sync_analyzer resources scan` desde el binario empaquetado |

## Migration / Rollout

- **Sin migración de BD** (D1). Única migración: el string de `settings.whisperModel` (D7), silenciosa y sin re-descarga.
- **Sin efecto en disco del usuario** (D2): la caché no se mueve.
- PR 1 es funcional y verificable end-to-end solo por IPC (descargar, cancelar, borrar, listar) sin ninguna UI nueva — requisito del stack de PRs.
- Rollback de PR 1 restaura la descarga implícita: revertir `local_files_only=True` basta.

## Open Questions

- [ ] Los tamaños del catálogo son estimaciones de la exploración. Verificar contra los `model.bin` reales en PR 1 y documentar el margen del 500 MB si resulta insuficiente para `large-v3`.
- [ ] `diarization_analyzer.py` no se empaqueta hoy (bug preexistente, `transcriptionManager.js:241-248`). Fuera de alcance de este change, pero conviene abrir issue aparte.
