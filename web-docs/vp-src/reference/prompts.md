---
title: Prompts de IA
description: Prompts utilizados por AIRecorder para analizar transcripciones.
---

# Prompts de IA

Los **prompts** son las instrucciones que le damos a la IA para que sepa qué hacer con el texto de tus transcripciones. La calidad del prompt determina directamente la calidad de la respuesta.

## Tipos de Análisis

### Resumen

Genera un resumen conciso de la reunión.

La IA identifica:
- Temas principales discutidos
- Decisiones tomadas
- Contexto general

**Uso:** Ideal para tener una visión rápida sin leer toda la transcripción.

### Puntos Clave

Extrae los puntos más importantes de la conversación en formato de lista.

**Uso:** Revisar rápidamente los aspectos más relevantes de una reunión larga.

### Tareas Pendientes

Identifica las acciones comprometidas, quién las asumió y cualquier plazo mencionado.

Genera una lista de **action items** estructurada.

**Uso:** Dar seguimiento a las tareas asignadas en la reunión.

### Chat Libre

Responde preguntas específicas sobre el contenido de la transcripción usando el contexto RAG.

**Uso:** Preguntar sobre cualquier aspecto de la reunión.

## Prompts Personalizados

Puedes personalizar los prompts desde **Ajustes > Agentes IA > Prompts personalizados**.

Ahí encontrarás campos para modificar las instrucciones que recibe la IA según el tipo de análisis:
- Resumen
- Puntos clave
- Tareas
- Chat

::: tip
Los cambios se aplican inmediatamente sin necesidad de reiniciar la app.
:::

## Mejores Prácticas

1. **Sé específico**: Cuanto más claro seas en las instrucciones, mejores resultados obtendrás
2. **Establece formato**: Indica cómo quieres la salida (lista, párrafos, tablas)
3. **Define el tono**: Specify if you want a formal or casual tone