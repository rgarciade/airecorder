> 🔗 **NOTA:** `CLAUDE.md` es un enlace simbólico a este archivo (`AGENTS.md`). Modificar este archivo actualizará ambos.

# Reglas Globales para Agentes de IA (AIRecorder)

Este archivo contiene el contexto crítico general y las reglas de comportamiento para trabajar en el repositorio **AIRecorder**. Para detalles técnicos específicos, **debes leer los archivos `README.md` ubicados en las carpetas correspondientes**.

## 1. Comportamiento y Reglas Estrictas

1. **Idioma:** RESPONDE SIEMPRE EN ESPAÑOL. La UI y logs usan español; los nombres de variables y funciones van en inglés (camelCase/PascalCase).
2. **Seguridad ante todo:** Comprueba siempre si un archivo existe antes de leer/escribir.
3. **Rutas Hardcodeadas:** Si una ruta parece estar "hardcodeada" (fija) a un directorio local de usuario (ej. `/Users/raul.garciad/...`), **mantenla como está** a menos que se indique explícitamente refactorizarla.
4. **Git y Commits:** **NUNCA crees commits de git de forma autónoma**. Limítate a modificar los archivos y deja el proceso de staging/commit al usuario.
5. **Evitar Archivos Monolíticos:** No permitas que los archivos crezcan desproporcionadamente. Si un archivo concentra demasiada lógica, aplica estrategias de división mediante importación de módulos más pequeños agrupados por contexto.

## 2. Comandos de Compilación Rápidos

| Acción | Comando |
|--------|---------|
| **Dev (frontend + electron)** | `npm run dev` |
| **Build Frontend** | `npm run build` |
| **Build macOS DMG** | `npm run electron:build` |
| **Rebuild Native Modules** | `npm run rebuild` |

## 3. Arquitectura Basada en Componentes (Lee antes de actuar)

El código está segmentado. **NO intentes adivinar cómo funciona el sistema.** Si vas a trabajar en un área específica, **LEE** su archivo correspondiente primero:

- 🧠 **Para lógica de IA (Prompts, Gemini, Ollama):** Lee `src/services/ai/README.md`
- 🖥️ **Para lógica de Frontend/Electron (Main, IPC, BD):** Lee `electron/README.md`
- 🐍 **Para lógica de Python (Audio, Whisper):** Lee `README.md` en la raíz.

---

## ⚠️ MATRIZ DE MANTENIMIENTO OBLIGATORIO DE DOCUMENTACIÓN ⚠️

Las IAs tienen la obligación estricta de mantener el contexto de la aplicación actualizado. **NUNCA des por terminada una tarea que altere la lógica de estos archivos sin antes leer el documento correspondiente y aplicar los cambios necesarios para que no quede obsoleto.**

| Si modificas código o lógica en... | Estás OBLIGADO a actualizar el archivo... |
| :--- | :--- |
| `electron/main.js`, `electron/preload.js` | `electron/README.md` (Sección IPC / Comunicación) |
| `electron/database/dbService.js` | `electron/README.md` (Sección Base de Datos) |
| `src/services/ai/providerRouter.js`, `src/services/ai/*` | `src/services/ai/README.md` (Sección Proveedores de IA) |
| `src/prompts/aiPrompts.js` | `src/services/ai/README.md` (Sección Prompts y Formatos) |
| `electron/transcriptionManager.js`, `python/audio_sync_analyzer.py` | `README.md` (raíz) (Sección Pipeline de Transcripción) |