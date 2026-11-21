---
title: Transcripción
description: Convierte tu audio en texto editable usando IA.
---

# Transcripción

AIRecorder utiliza Whisper para transcribir audio a texto. Puedes usar proveedores locales (Ollama, LM Studio) o en la nube (Gemini, DeepSeek, Kimi).

## Cómo Transcribir

1. **Selecciona una grabación** de tu biblioteca
2. Haz clic en el botón **"Transcribir"** en la barra de herramientas
3. Elige el **proveedor de IA** a usar
4. Espera a que complete el proceso

## Proveedores Soportados

### Locales (Sin internet)

- **Ollama**: Recomendado. Descarga modelos como `whisper-base`, `whisper-large`
- **LM Studio**: Interfaz visual para gestionar modelos

### En la Nube

- **Google Gemini**: Rápido y preciso
- **DeepSeek**: Buena relación calidad/precio
- **Kimi**: Excelente para español

::: info
Para usar proveedores locales, consulta nuestra guía de [IA Local](/guide/local-ai).
:::

## Diarización

Durante la transcripción, AIRecorder puede identificar diferentes hablantes. Esto se conoce como **diarización**.

Los hablantes se muestran como:
- **Speaker 1**, **Speaker 2**, etc.
- Puedes renombrarlos en la sección [Hablantes](/guide/speakers)

## Editar Transcripción

La transcripción es editable. Puedes:

- Corregir errores de ortografía
- Unir o dividir segmentos
- Añadir puntuación

## Ver también

- [Chat IA](/guide/chat) - Haz preguntas sobre tu audio
- [Hablantes](/guide/speakers) - Gestiona identificados