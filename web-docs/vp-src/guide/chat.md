---
title: Chat IA
description: Haz preguntas sobre tus grabaciones usando IA conversacional.
---

# Chat IA

AIRecorder incluye un asistente de chat que puede responder preguntas sobre tus transcripciones usando tecnología RAG (Retrieval-Augmented Generation).

## Cómo Usar el Chat

1. **Abre una transcripción** de tu biblioteca
2. Haz clic en la pestaña **"Chat"** en el panel derecho
3. Escribe tu pregunta en el campo de texto
4. Presiona **Enter** o haz clic en el botón de enviar

## Ejemplos de Preguntas

- "¿De qué trata esta reunión?"
- "¿Cuáles fueron los temas principales discutidos?"
- "¿Se mencionaron acciones o tareas pendientes?"
- "¿Quién dijo qué sobre el proyecto X?"

## Cómo Funciona

Cuando haces una pregunta, AIRecorder:

1. **Busca** los fragmentos más relevantes de tu transcripción usando embeddings
2. **Añade el esquema** de la grabación (si existe) como contexto adicional sobre la estructura general
3. **Envía** los fragmentos, el esquema y tu pregunta al modelo de IA
4. **Responde** basándose en el contenido de tu audio

::: warning
El chat necesita un proveedor de IA configurado. Consulta [IA Local](/guide/local-ai) para configurar Ollama o LM Studio.
:::

## Configuración

En **Ajustes > Agentes IA** puedes configurar:

- **Modelo de chat**: Qué modelo usar para generar respuestas
- **Modelo de embedding**: Para buscar fragmentos relevantes
- **Ventana de contexto**: Cuánto texto enviar al modelo

## Ver también

- [Esquema](/guide/schema) - Mind-map interactivo de la grabación
- [Transcripción](/guide/transcription) - Generar transcripciones
- [RAG (Referencia técnica)](/reference/rag) - Cómo funciona el sistema