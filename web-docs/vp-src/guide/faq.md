---
title: Preguntas Frecuentes
description: Respuestas a las dudas más comunes sobre AIRecorder.
---

# Preguntas Frecuentes

<details>
<summary>La transcripción no funciona</summary>

**Verifica lo siguiente:**

1. Tienes un proveedor de IA configurado y funcionando. Ve a **Ajustes > Agentes IA** y pulsa **"Verificar modelo"**.
2. El archivo de audio se generó correctamente. Comprueba que no está vacío en la carpeta de grabaciones.
3. Si usas Whisper local, asegúrate de que **Ollama** o **LM Studio** están corriendo.

Si el problema persiste, revisa los logs en la consola de desarrollo: **Help > Toggle Developer Tools**.
</details>

<details>
<summary>La IA no responde en el chat</summary>

**Comprueba lo siguiente:**

1. El proveedor de IA está activo y la conexión es correcta (ve a **Ajustes > Agentes IA**).
2. La transcripción tiene contenido indexado en LanceDB. Si acabas de crearla, espera unos segundos a que se indexe.
3. El modelo de embedding es el correcto.

Si usas un modelo local, asegúrate de que tiene suficiente memoria RAM disponible.
</details>

<details>
<summary>¿Puedo usar la app sin internet?</summary>

**Sí, completamente.**

Si usas **Ollama** o **LM Studio** con modelos descargados localmente, AIRecorder funciona sin conexión a internet:

- ✅ Grabación de audio
- ✅ Transcripción con Whisper local
- ✅ Análisis de IA (resumen, tareas, puntos clave)
- ✅ Chat RAG sobre transcripciones

Solo necesitas internet para la descarga inicial de modelos o si usas proveedores en la nube (Gemini, DeepSeek, Kimi).
</details>

<details>
<summary>¿Cómo cambiar el idioma de la interfaz?</summary>

Ve a **Ajustes > General** y busca la sección de idioma. AIRecorder soporta **español** e **inglés**. El cambio se aplica inmediatamente.

**Nota:** El idioma de la transcripción (el idioma que Whisper detecta) se configura por separado en **Ajustes > Agentes IA**.
</details>

<details>
<summary>¿Dónde están guardados mis datos?</summary>

**Todos tus datos se almacenan localmente en tu ordenador.**

La base de datos SQLite, los archivos de audio y los índices de LanceDB viven en el directorio de datos de la aplicación:

```
~/Library/Application Support/AIRecorder
```

**No se envía ningún dato a servidores externos** a menos que uses un proveedor de IA en la nube (Gemini, DeepSeek, Kimi).
</details>

<details>
<summary>La diarización confunde hablantes o los divide mal</summary>

**Ajusta el umbral de similitud:**

- Si **confunde personas distintas** (demasiado permisivo): sube el umbral hacia 0.90–0.95 en **Ajustes > General**.
- Si **divide demasiado a la misma persona** (demasiado estricto): baja el umbral hacia 0.75–0.80.
- Usa la función **Fusionar hablantes** en la barra lateral para corregir divisiones incorrectas manualmente.

Una vez asignes nombre a un hablante, AIRecorder guarda su embedding de voz y mejora la identificación en grabaciones futuras.
</details>

<details>
<summary>¿Puedo mejorar o personalizar el análisis de la IA?</summary>

**Sí, de varias formas:**

- **Prompts personalizados:** Ve a **Ajustes > Agentes IA > Prompts personalizados** y modifica las instrucciones para cada tipo de análisis.
- **Instrucciones de usuario:** Al mejorar una tarea desde el chat, puedes incluir instrucciones específicas sobre el formato o enfoque que quieres en la respuesta.
- **Cambio de modelo:** Prueba modelos más capaces (Gemini Pro, DeepSeek, Llama 3 via Ollama) para análisis de mayor calidad.
</details>