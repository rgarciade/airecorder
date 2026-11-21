---
title: Añadir Contenido
description: Todas las formas de añadir grabaciones y transcripciones a AIRecorder.
---

# Añadir Contenido

AIRecorder ofrece **4 métodos** para añadir contenido a tu biblioteca. Elige el que mejor se adapte a tu situación.

## 1. Grabar Audio 🎙️

El método principal. Captura tu micrófono y el audio del sistema **simultáneamente** en una sola pista.

### Cómo grabar

1. En la pantalla principal, selecciona tu **micrófono** en el selector de fuente
2. Pulsa el botón **"Grabar"** (círculo rojo)
3. Verás un indicador visual y un monitor de nivel de audio en tiempo real
4. Puedes **pausar y reanudar** la grabación cuando quieras
5. Pulsa **"Detener"** para finalizar — el audio se guarda automáticamente

### ¿Qué se graba exactamente?

- **Tu micrófono**: tu voz
- **Audio del sistema**: lo que suena por tus altavoces (reuniones de Zoom, Teams, Meet, clases online...)
- Ambas fuentes se mezclan en un solo archivo WAV de alta calidad (16-bit, 44.1kHz)

::: warning Permisos en macOS
Necesitas conceder permiso de **micrófono** en Preferencias del Sistema > Privacidad y Seguridad > Micrófono.
:::

### Después de grabar

Al detener la grabación, AIRecorder puede:
- **Transcribir automáticamente** el audio (si tienes la opción activada en Ajustes)
- **Analizar con IA** automáticamente (resumen, tareas, puntos clave)

---

## 2. Importar Archivo de Audio 📁

Si ya tienes una grabación de otro dispositivo o formato, impórtala directamente.

### Formatos soportados
WAV, MP3, M4A, FLAC, OGG, y otros formatos de audio comunes.

### Cómo importar

1. En la pantalla principal, pulsa el botón **"Audio"** (ícono de subida)
2. Selecciona el archivo de audio desde tu ordenador
3. Ponle un nombre a la grabación en el diálogo que aparece
4. AIRecorder iniciará la **transcripción automática** con Whisper

::: tip ¿Cuándo usar esto?
Ideal si grabas con otro dispositivo (grabadora de voz, móvil) o recibes un audio de un compañero.
:::

---

## 3. Importar Transcripción de Teams 🏢

Importa directamente el archivo de transcripción que genera Microsoft Teams en sus reuniones.

### Cómo funciona

1. En la pantalla principal, pulsa el botón **"Teams"** (ícono de Teams)
2. Selecciona el archivo de transcripción de Teams (.docx o .vtt)
3. AIRecorder extrae automáticamente el texto, los hablantes y las marcas de tiempo
4. **No se requiere IA** para este método — la transcripción ya está hecha
5. Puedes usar el chat RAG y los análisis de IA sobre el contenido importado

### Ventajas
- Sin coste de proceso Whisper (la transcripción ya existe)
- Conserva los hablantes identificados por Teams
- Rápido — se importa en segundos

---

## 4. Importar Conversación de Texto 📝

Pega o importa cualquier transcripción en texto plano — la IA la normaliza al formato de AIRecorder.

### Cómo funciona

1. En la pantalla principal, pulsa el botón **"Conversación"** (ícono de documento)
2. Escribe o pega el texto de la conversación
3. También puedes **importar un archivo** de texto (.txt, .md, .json)
4. Pulsa **"Procesar"**
5. La IA analiza el texto y lo convierte al formato canónico de segmentos con marcas de tiempo estimadas

::: warning Requisito
Este método **requiere tener un proveedor de IA configurado** (local o cloud). La IA usa un prompt de normalización para estructurar el texto correctamente.
:::

### Casos de uso
- Tienes una transcripción hecha con otra herramienta
- Un compañero te pasa las notas de una reunión en texto
- Quieres analizar con IA el contenido de una conversación escrita

---

## Comparativa de Métodos

| Método | ¿Genera audio? | ¿Requiere IA? | Velocidad | Mejor para... |
|--------|:---:|:---:|-----------|---------------|
| Grabar | ✅ Sí | Para transcribir | Tiempo real | Reuniones en directo |
| Importar audio | ✅ Sí | Para transcribir | Según duración | Grabaciones externas |
| Teams | ❌ No | ❌ No | Instantáneo | Transcripciones de Teams |
| Texto | ❌ No | ✅ Sí | Segundos | Textos de otras fuentes |

## Ver también

- [Transcripción](/guide/transcription) — Cómo funciona Whisper en AIRecorder
- [IA Local](/guide/local-ai) — Configurar Ollama o LM Studio
- [Ajustes](/guide/settings) — Configurar auto-transcripción y auto-análisis
