# Guía de Distribución: Electron + Python Embebido

Esta guía describe los pasos para empaquetar y distribuir la aplicación Electron junto con Python embebido y todos los scripts y dependencias necesarios, de modo que el usuario final no tenga que instalar nada adicional.

---

## 1. Estructura de Carpetas Recomendada

```
airecorder/
├── electron/
│   ├── main.js
│   ├── preload.js
│   ├── audioRecorder.js
│   └── python/                    # ← Python embebido y scripts
│       ├── python.exe             # Python portable (Windows)
│       ├── scripts/
│       │   ├── audio_analyzer.py
│       │   └── requirements.txt
│       └── lib/                   # Librerías Python instaladas
├── src/
├── package.json
└── build/                         # Scripts de build opcionales
    ├── build-python.js
    └── package-python.js
```

---

## 2. Adaptar el Script Python para CLI

- El script principal (`audio_analyzer.py`) debe aceptar argumentos por línea de comandos:
  - `--mic-file` (ruta al archivo de micrófono)
  - `--system-file` (ruta al archivo de sistema)
  - `--output-dir` (directorio de salida)
  - (opcional) `--huggingface-token`
- Debe guardar los resultados en la carpeta indicada y/o imprimir un resumen JSON por stdout.

---

## 3. Empaquetar Python Portable y Dependencias

- Descargar Python embebido (Windows): https://www.python.org/downloads/windows/
- Copiar el ejecutable y la carpeta `Lib` a `electron/python/`.
- Instalar las dependencias en la carpeta `lib` usando el Python portable:
  ```bash
  electron/python/python.exe -m pip install -r electron/python/scripts/requirements.txt -t electron/python/lib
  ```
- Copiar los scripts Python a `electron/python/scripts/`.

---

## 4. Integración con Electron (main.js)

- Añadir un handler IPC para lanzar el script Python embebido:
  ```js
  ipcMain.handle('analyze-audio-files', async (event, micFile, systemFile) => {
    // ...ver ejemplo en main.js...
  });
  ```
- Usar `child_process.spawn` para ejecutar el script y capturar la salida.

---

## 5. Exponer Función en preload.js

- Exponer la función en `electronAPI`:
  ```js
  analyzeAudioFiles: (micFile, systemFile) => ipcRenderer.invoke('analyze-audio-files', micFile, systemFile),
  ```

---

## 6. Configuración de electron-builder/package.json

- Asegurarse de incluir la carpeta `electron/python/` en el build final:
  ```json
  "build": {
    "extraResources": [
      {
        "from": "electron/python",
        "to": "python",
        "filter": ["**/*"]
      }
    ]
  }
  ```

---

## 7. (Opcional) Script de Build para Automatizar

- Crear un script Node (`build/build-python.js`) para descargar Python portable, instalar dependencias y copiar scripts automáticamente.

---

## 8. Experiencia del Usuario Final

- El usuario descarga e instala la app normalmente.
- No necesita instalar Python ni dependencias manualmente.
- Todo el procesamiento de audio y análisis funciona offline y de forma transparente.

---

## 9. Notas y Consejos

- Si usas modelos que requieren tokens (ej: HuggingFace), asegúrate de pedirlos/configurarlos en la app.
- Prueba la app en una máquina limpia antes de distribuir.
- Si necesitas soporte multiplataforma, busca Python portable para Mac/Linux o adapta el proceso.

---

**Esta guía debe mantenerse junto al repositorio para referencia de futuros desarrolladores y para la preparación de builds de producto final.** 