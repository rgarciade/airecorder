---
title: IA en la Nube
description: Configura OpenAI, Gemini, Kimi o DeepSeek como proveedor de IA en la nube en AIRecorder.
---

# IA en la Nube

AIRecorder puede usar proveedores de IA en la nube cuando prefieres modelos más potentes o no quieres instalar nada localmente. Necesitas una API Key del proveedor que elijas.

::: warning ⚠️ Fase Beta
Los proveedores cloud están en fase beta. Algunas funciones pueden no funcionar correctamente en todos los casos.
:::

## Proveedores Disponibles

| Proveedor | Requiere | Modelo General | Modelo de Embedding |
|-----------|----------|-----------------|----------------------|
| **OpenAI** | API Key de OpenAI | Se elige de la lista de modelos de tu cuenta | Fijo (`text-embedding-3-small`) |
| **Gemini** | API Key de Google AI Studio | Se elige de la lista de modelos de tu cuenta | Fijo (`text-embedding-004`) |
| **Kimi (Moonshot)** | API Key de Moonshot | Se elige de una lista corta predefinida | Fijo (`moonshot-embedding-v1`) |
| **DeepSeek** | API Key de DeepSeek | Se elige de una lista corta predefinida | No soportado |

::: tip 💡 Gemini ya no distingue Free / Pro
Antes existían "Gemini Free" y "Gemini Pro" como proveedores separados. Ahora es una única configuración de Gemini: una sola API Key, un solo modelo general elegido de la lista real de tu cuenta.
:::

::: warning ⚠️ DeepSeek no soporta Embeddings
Si estás en la pestaña **Embeddings** de Ajustes, la card de DeepSeek no aparece — no tiene un modelo de embedding disponible. Usalo solo para General.
:::

---

## Configuración en AIRecorder

1. Ve a **Ajustes > Agentes IA**
2. Elige la sub-pestaña **General** o **Embeddings** según qué rol quieras configurar — podés usar un proveedor distinto para cada uno (por ejemplo, Gemini para General y Ollama local para Embeddings)
3. Abrí la sección **"Proveedores en la Nube"** (arranca colapsada — hacé clic en el título o en la flecha para desplegarla)
4. Selecciona la card del proveedor que quieras usar
5. Pega tu API Key
6. Para OpenAI y Gemini: pulsá **"Refrescar"** para traer la lista real de modelos de tu cuenta y elegí uno
7. Para Kimi y DeepSeek: elegí un modelo de la lista predefinida

::: tip 💡 General y Embeddings son independientes
La API Key de cada proveedor es compartida entre ambos roles, pero el proveedor activo (y el modelo, cuando aplica) se elige por separado en cada sub-pestaña. Podés tener, por ejemplo, OpenAI para General y Gemini para Embeddings al mismo tiempo.
:::

---

## Obtener una API Key

| Proveedor | Dónde conseguirla |
|-----------|---------------------|
| **OpenAI** | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **Gemini** | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **Kimi** | [platform.moonshot.ai](https://platform.moonshot.ai) |
| **DeepSeek** | [platform.deepseek.com](https://platform.deepseek.com) |

---

## Ver también

- [IA Local](/guide/local-ai) — Ollama y LM Studio, sin costes ni internet
- [Conexiones OpenAI Personalizadas](/guide/custom-ai) — Cualquier endpoint compatible con la API de OpenAI
- [Ajustes](/guide/settings) — Todas las opciones de configuración
