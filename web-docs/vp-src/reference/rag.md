---
title: Sistema RAG
description: Retrieval-Augmented Generation en AIRecorder.
---

# Sistema RAG

**RAG (Retrieval-Augmented Generation)** es la técnica que permite a la IA encontrar información relevante en tus transcripciones sin tener que leer todo el texto cada vez.

## Cómo Funciona

### 1. Embeddings (Vectores Numéricos)

Cada fragmento de transcripción se convierte en un vector de números usando un **modelo de embedding**. Estos vectores representan el significado semántico del texto.

Dos textos con significado similar tendrán vectores cercanos en el espacio matemático.

### 2. LanceDB (Base de Datos Vectorial)

Los vectores se almacenan en **LanceDB**, una base de datos vectorial embebida que permite búsquedas rápidas por similitud.

Características:
- No requiere servidor externo
- Funciona localmente como un archivo más
- Búsquedas extremadamente rápidas

### 3. Chunking (Segmentación)

Las transcripciones se dividen en fragmentos (**chunks**) de tamaño manejable antes de generar los embeddings.

Esto asegura que cada búsqueda devuelva fragmentos precisos y contextualizados, no párrafos gigantes.

### 4. Cómo Afecta al Chat

Cuando haces una pregunta en el chat, AIRecorder:

1. Convierte tu pregunta en un vector
2. Busca los 5 fragmentos más similares en LanceDB
3. Envía esos fragmentos como contexto a la IA junto con tu pregunta
4. Devuelve la respuesta generada

Todo esto ocurre en menos de un segundo.

## Modelo de Embedding

AIRecorder usa **nomic-embed-text** como modelo por defecto.

::: warning
El modelo de embedding debe coincidir entre la indexación y la búsqueda. Si cambias de modelo, necesitas re-indexar tus transcripciones.
:::

## Configuración

Puedes ajustar el modelo de embedding en **Ajustes > Agentes IA**.

| Modelo | Precisión | Velocidad |
|--------|-----------|-----------|
| nomic-embed-text | Alta | Rápido |
| mxbai-embed-large | Muy alta | Medio |