---
title: Diarización de Hablantes
description: Sistema de identificación automática de hablantes.
---

# Diarización de Hablantes

La **diarización** es el proceso de identificar **quién habló** en cada momento de una grabación. AIRecorder distingue entre diferentes hablantes y les asigna un nombre o identificador.

## Cómo Funciona Técnicamente

### 1. pyannote.audio

AIRecorder utiliza **pyannote.audio**, una librería de Python basada en redes neuronales, para detectar los segmentos de habla y agruparlos por hablante.

El modelo pre-entrenado analiza las características acústicas de la voz.

### 2. Embeddings de Hablante

Cada segmento de voz se convierte en un **embedding de hablante** (un vector que representa las características únicas de esa voz).

Estos embeddings permiten comparar si dos segmentos pertenecen a la misma persona.

### 3. Similitud Coseno y Umbral

Para determinar si dos segmentos pertenecen al mismo hablante, se calcula la **similitud coseno** entre sus embeddings.

Si la similitud supera el **umbral de 0.85**, se consideran el mismo hablante.

Este umbral busca un equilibrio entre:
- No confundir hablantes diferentes
- No separar demasiado a un mismo hablante

## Cómo Activar la Diarización

1. Ve a **Ajustes > General > Diarización de Interlocutores**
2. Activa el interruptor "Identificar hablantes automáticamente"
3. La primera vez que lo actives, AIRecorder descargará el modelo de pyannote (requiere conexión a internet)

::: warning
Una vez descargado, el procesamiento funciona offline.
:::

## Ajuste del Umbral

Ajusta el **umbral de similitud** con el slider:

| Valor | Comportamiento |
|-------|----------------|
| 0.75 - 0.80 | Más permisivo (menos división) |
| 0.85 | Recomendado (equilibrio) |
| 0.90 - 0.95 | Más estricto (más división) |

## Requisitos

- Descarga inicial del modelo (~500MB)
- Procesamiento más lento que la transcripción básica
- Más consumo de recursos del sistema