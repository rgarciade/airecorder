---
title: Conexiones OpenAI Personalizadas
description: Conecta cualquier servicio compatible con la API de OpenAI a AIRecorder — OpenRouter, Groq, vLLM propio, y más.
---

# Conexiones OpenAI Personalizadas

Si usás un proveedor que expone una API compatible con OpenAI pero no es ninguno de los proveedores oficiales (OpenAI, Gemini, Kimi, DeepSeek), podés conectarlo manualmente. Funciona con cualquier servicio que implemente los endpoints `/v1/chat/completions` y `/v1/models` — por ejemplo:

- **OpenRouter**
- **Groq**
- **vLLM** auto-alojado
- Gateways como **opencode.ai/zen**
- Cualquier otro proxy o servidor compatible con OpenAI

---

## Añadir una Conexión

1. Ve a **Ajustes > Agentes IA**
2. Abrí la sección **"Conexiones OpenAI Personalizadas"** (arranca colapsada — hacé clic en el título o en la flecha para desplegarla)
3. Pulsá **"Añadir conexión"**
4. Completá:
   - **Nombre**: un nombre identificativo (ej. "OpenRouter", "Mi GPT local")
   - **URL Base**: la URL de la API, con o sin el sufijo `/v1` (ej. `https://openrouter.ai/api/v1`)
   - **API Key**: opcional — dejala vacía si el endpoint no requiere autenticación
5. Guardá la conexión

## Activar y Elegir Modelo

Cada conexión se activa por separado para **General** y para **Embeddings** (sub-pestañas arriba de Agentes IA):

1. Activá el toggle de la conexión en la card
2. AIRecorder prueba la conexión automáticamente (`GET {URL}/v1/models`) y trae la lista real de modelos disponibles
3. Elegí el modelo — el selector muestra "Modelo General" en la pestaña General, o "Modelo de Embedding" en la pestaña Embeddings
4. Podés usar la **misma conexión** con un modelo distinto para cada rol (ej. un modelo general grande y un modelo de embedding más liviano)

::: tip 💡 Botón "Probar"
Si necesitás refrescar la lista de modelos manualmente (por ejemplo, tras agregar un modelo nuevo en tu proveedor), usá el botón **"Probar"** en la card de la conexión.
:::

::: warning ⚠️ Re-indexar tras cambiar el modelo de embedding
Si cambiás el modelo de embedding de una conexión que ya usaste para indexar transcripciones, vas a ver un aviso para **re-indexar** — es necesario porque los vectores generados por un modelo distinto no son comparables entre sí.
:::

---

## También Disponible en el Onboarding

Si estás configurando AIRecorder por primera vez, la pantalla de configuración de IA incluye una card **"Conexión Personalizada"** dentro de la pestaña Cloud, con el mismo flujo: nombre, URL, API Key y prueba de conexión con selección de modelo.

---

## Ver también

- [IA en la Nube](/guide/cloud-ai) — OpenAI, Gemini, Kimi y DeepSeek
- [IA Local](/guide/local-ai) — Ollama y LM Studio
- [Ajustes](/guide/settings) — Todas las opciones de configuración
