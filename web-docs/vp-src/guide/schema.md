---
title: Esquema / Mind-Map
description: Genera mapas mentales visuales de tus grabaciones con puntos clave anclados al audio.
---

# Esquema / Mind-Map

Cada grabación puede tener un **esquema** (mind-map) generado por IA. Es un resumen estructurado con ramas temáticas y puntos clave anclados al segundo exacto del audio.

Puedes hacer clic en cualquier nodo con timestamp para saltar a ese momento en el audio.

---

## Vista Outline

La vista **Outline** muestra el esquema como una lista jerárquica colapsable. Cada rama tiene:

- **Título de rama**: el tema principal
- **Puntos anidados**: detalles, decisiones, fechas, responsables
- **Timestamp**: marcado como `(MM:SS)` — haz clic en el botón ▶ para saltar al audio

Las ramas se pueden colapsar/expandir individualmente.

---

## Vista Mind-Map

La vista **Mind-Map** renderiza el esquema como un mapa mental interactivo usando [markmap](https://markmap.js.org/):

- **Zoom/Pan**: desplázate con el ratón o los gestos táctiles
- **Nodos con timestamp**: el cursor cambia a pointer — haz clic para saltar al audio
- **Colores**: cada nivel de profundidad tiene un color distinto para facilitar la lectura

---

## Generar el Esquema

1. Abre una grabación que ya tenga transcripción
2. Ve a la pestaña **"Esquema"** (tercera, después de Overview)
3. Pulsa **"Generar esquema"**
4. La IA analiza la transcripción segmento por segmento y genera ramas con timestamps precisos

Puedes **regenerar** el esquema cuando quieras si no quedó como esperabas.

### Requisitos

- La grabación debe tener **transcripción con segmentos** (no solo texto plano)
- Se necesita un **proveedor de IA configurado** (local o cloud)
- Si hay un **resumen detallado** existente, se usa como contexto adicional para mejorar la calidad

---

## Auto-generación Automática

En **Ajustes > General > Transcripción** puedes activar la opción **"Generar Esquema Automáticamente"**.

Cuando está activa, al completar el análisis IA inicial (resumen, tareas, puntos clave), se genera automáticamente el esquema si aún no existe.

---

## Exportar

### Markdown (.md)

Genera un documento outline anidado con timestamps en cada punto clave. Ideal para compartir o integrar en otras herramientas.

### PNG (.png)

Exporta el mind-map visual como imagen PNG. La captura se hace de forma nativa vía Electron (no requiere bibliotecas externas).

::: warning
Para exportar PNG, debes estar en la **vista Mind-Map** (no Outline).
:::

---

## Esquema en el Chat IA

Si el chat RAG está activo (modo grabación), el esquema se inyecta en el contexto del modelo como información adicional. También ocurre en chats de proyecto cuando hay grabaciones con esquema.

Esto permite que la IA responda preguntas sobre la **estructura general** de la reunión incluso si el fragmento relevante no está en los primeros resultados de búsqueda semántica.

---

## Estructura Interna

El esquema se guarda como JSON en `<recordings>/<folderName>/analysis/recording_schema.json`:

```json
{
  "branches": [
    {
      "title": "Tema específico",
      "start": null,
      "children": [
        { "label": "Punto o decisión", "start": 192.4, "children": [] }
      ]
    }
  ]
}
```

Cada nodo soporta anidamiento recursivo sin límite artificial. Los formatos antiguos (`items[]`) se siguen leyendo por retrocompatibilidad.

---

## Ver también

- [Chat IA](/guide/chat) — El esquema se usa como contexto en el chat
- [Transcripción](/guide/transcription) — La transcripción con segmentos es necesaria
- [Ajustes](/guide/settings) — Configurar auto-generación de esquema
