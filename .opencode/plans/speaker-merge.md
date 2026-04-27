# Plan: Botón de fusión de hablantes en SpeakersPage

## Objetivo
Añadir un botón "Fusionar hablantes" en la cabecera de SpeakersPage que abre un modal para seleccionar un hablante origen (se elimina) y un destino (sobrevive), ejecutando un merge.

## Cambios

### 1. `src/i18n/locales/es.json` — Añadir sección `speakers`
Insertar ANTES de `"speakerDetail"` (línea 715):

```json
  "speakers": {
    "title": "Hablantes",
    "searchPlaceholder": "Buscar hablantes...",
    "disabled": "Diarización desactivada",
    "disabledDesc": "Activa la diarización en Ajustes para identificar y gestionar hablantes.",
    "emptyState": "Aún no hay hablantes identificados. Graba y transcribe reuniones para empezar.",
    "noResults": "Sin resultados",
    "unknown": "Desconocido",
    "recordings": "grabaciones",
    "embeddings": "embeddings",
    "goToSettings": "Ir a Ajustes",
    "mergeBtn": "Fusionar hablantes",
    "mergeModalTitle": "Fusionar hablantes",
    "mergeModalDesc": "Selecciona el hablante origen (se eliminará) y el destino (conservará los datos).",
    "mergeSourceLabel": "Hablante origen",
    "mergeSourcePlaceholder": "Selecciona el hablante a fusionar...",
    "mergeTargetLabel": "Hablante destino",
    "mergeTargetPlaceholder": "Selecciona el hablante que recibirá los datos...",
    "mergeConfirm": "¿Fusionar \"{{source}}\" en \"{{target}}\"?",
    "mergeConfirmDesc": "Se reasignarán todas las grabaciones y embeddings. El hablante \"{{source}}\" se eliminará permanentemente.",
    "mergeSuccess": "\"{{source}}\" fusionado en \"{{target}}\"",
    "mergeError": "Error al fusionar: {{error}}",
    "sameSpeakerError": "Origen y destino no pueden ser el mismo hablante",
    "selectBothError": "Selecciona ambos hablantes para continuar"
  },
```

### 2. `src/i18n/locales/en.json` — Añadir sección `speakers`
Insertar ANTES de `"speakerDetail"` (línea 698):

```json
  "speakers": {
    "title": "Speakers",
    "searchPlaceholder": "Search speakers...",
    "disabled": "Diarization disabled",
    "disabledDesc": "Enable diarization in Settings to identify and manage speakers.",
    "emptyState": "No speakers identified yet. Record and transcribe meetings to get started.",
    "noResults": "No results",
    "unknown": "Unknown",
    "recordings": "recordings",
    "embeddings": "embeddings",
    "goToSettings": "Go to Settings",
    "mergeBtn": "Merge speakers",
    "mergeModalTitle": "Merge speakers",
    "mergeModalDesc": "Select the source speaker (will be removed) and the target (will keep the data).",
    "mergeSourceLabel": "Source speaker",
    "mergeSourcePlaceholder": "Select speaker to merge...",
    "mergeTargetLabel": "Target speaker",
    "mergeTargetPlaceholder": "Select speaker to receive the data...",
    "mergeConfirm": "Merge \"{{source}}\" into \"{{target}}\"?",
    "mergeConfirmDesc": "All recordings and embeddings will be reassigned. The speaker \"{{source}}\" will be permanently deleted.",
    "mergeSuccess": "\"{{source}}\" merged into \"{{target}}\"",
    "mergeError": "Error merging: {{error}}",
    "sameSpeakerError": "Source and target cannot be the same speaker",
    "selectBothError": "Select both speakers to continue"
  },
```

### 3. `src/pages/Speakers/SpeakersPage.jsx` — Añadir botón merge + modal

- **Import**: Añadir `useRef` y `ConfirmModal`
- **Estado nuevo**:
  - `mergeModalOpen` (boolean)
  - `mergeSourceId` (string | null) — speaker origen seleccionado
  - `mergeTargetId` (string | null) — speaker destino seleccionado
  - `mergeSourceFilter` (string) — filtro de búsqueda del dropdown origen
  - `mergeTargetFilter` (string) — filtro de búsqueda del dropdown destino
  - `mergeStatus` (object | null) — { success, message }
- **Botón "Fusionar hablantes"**: En el header, a la derecha del buscador, estilo outline con icono merge
- **Modal inline** (no componente separado):
  - Overlay con el contenido del modal
  - Dos dropdowns filtrables (origen y destino) usando los speakers ya cargados (los que pasan el filtro de recordingCount/embeddingsCount)
  - Validación: ambos seleccionados y distintos, o mostrar mensaje de error
  - Botón "Fusionar" → `handleMerge()`:
    1. Llama a `speakersService.mergeSimilarSpeaker(mergeTargetId, mergeSourceId)`
    2. Si éxito: cierra modal, refresca lista, muestra banner verde
    3. Si error: muestra mensaje de error en el modal
- **Banner mergeStatus**: igual que en SpeakerDetail (auto-ocultación 4s)
- **Auto-ocultar** el banner tras 4 segundos (mismo patrón que SpeakerDetail)

### 4. `src/pages/Speakers/SpeakersPage.module.css` — Añadir estilos

Nuevas clases:
- `.headerActions` — wrapper flex para buscador + botón merge
- `.mergeBtn` — botón outline con icono, estilo similar a `.settingsButton`
- `.mergeBtn:hover` — hover state
- `.mergeModalOverlay` — overlay semi-transparente
- `.mergeModal` — caja del modal
- `.mergeModalTitle` — título
- `.mergeModalBody` — contenido
- `.mergeModalDesc` — texto descriptivo
- `.mergeField` — wrapper de cada campo (origen/destino)
- `.mergeFieldLabel` — label del dropdown
- `.mergeDropdown` — dropdown filtrable
- `.mergeDropdownInput` — input de búsqueda dentro del dropdown
- `.mergeDropdownList` — lista de opciones
- `.mergeDropdownOption` — opción individual
- `.mergeDropdownOption.selected` — opción seleccionada
- `.mergeDropdownEmpty` — mensaje "sin resultados"
- `.mergeModalError` — mensaje de error de validación
- `.mergeModalFooter` — botones cancelar/confirmar
- `.mergeModalCancel` — botón cancelar
- `.mergeModalConfirm` — botón confirmar
- `.mergeModalConfirm:disabled` — estado deshabilitado
- `.mergeStatusBanner` — banner de éxito/error
- `.mergeStatusSuccess` / `.mergeStatusError` — variantes

## No se modifica
- Backend (`merge-similar-speaker` IPC ya soporta merge genérico)
- Redux (`speakersSlice`)
- `SpeakerDetail.jsx`
- `speakersService.js` (ya tiene `mergeSimilarSpeaker`)
