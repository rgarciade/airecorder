---
title: Cloud AI
description: Set up OpenAI, Gemini, Kimi, or DeepSeek as a cloud AI provider in AIRecorder.
---

# Cloud AI

AIRecorder can use cloud AI providers when you prefer more powerful models or don't want to install anything locally. You'll need an API Key from whichever provider you choose.

::: warning ⚠️ Beta Stage
Cloud providers are in beta. Some features may not work correctly in every case.
:::

## Available Providers

| Provider | Requires | Chat Model | Embedding Model |
|----------|----------|------------|------------------|
| **OpenAI** | OpenAI API Key | Chosen from your account's real model list | Fixed (`text-embedding-3-small`) |
| **Gemini** | Google AI Studio API Key | Chosen from your account's real model list | Fixed (`text-embedding-004`) |
| **Kimi (Moonshot)** | Moonshot API Key | Chosen from a short predefined list | Fixed (`moonshot-embedding-v1`) |
| **DeepSeek** | DeepSeek API Key | Chosen from a short predefined list | Not supported |

::: tip 💡 Gemini no longer splits Free / Pro
There used to be separate "Gemini Free" and "Gemini Pro" providers. Now it's a single Gemini configuration: one API Key, one chat model chosen from your account's real model list.
:::

::: warning ⚠️ DeepSeek doesn't support Embeddings
If you're on the **Embeddings** sub-tab in Settings, the DeepSeek card won't appear — it has no embedding model available. Use it for Chat only.
:::

---

## Configuration in AIRecorder

1. Go to **Settings > AI Agents**
2. Pick the **Chat** or **Embeddings** sub-tab depending on which role you want to configure — you can use a different provider for each (e.g. Gemini for Chat and local Ollama for Embeddings)
3. Open the **"Cloud Providers"** section (starts collapsed — click the title or the arrow to expand it)
4. Select the card for the provider you want to use
5. Paste your API Key
6. For OpenAI and Gemini: click **"Refresh"** to fetch the real model list from your account and pick one
7. For Kimi and DeepSeek: pick a model from the predefined list

::: tip 💡 Chat and Embeddings are independent
Each provider's API Key is shared between both roles, but the active provider (and model, where applicable) is chosen separately on each sub-tab. You could have, for example, OpenAI for Chat and Gemini for Embeddings at the same time.
:::

---

## Getting an API Key

| Provider | Where to get it |
|----------|-------------------|
| **OpenAI** | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **Gemini** | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **Kimi** | [platform.moonshot.ai](https://platform.moonshot.ai) |
| **DeepSeek** | [platform.deepseek.com](https://platform.deepseek.com) |

---

## See also

- [Local AI](/en/guide/local-ai) — Ollama and LM Studio, no cost or internet required
- [Custom OpenAI Connections](/en/guide/custom-ai) — Any OpenAI-compatible endpoint
- [Settings](/en/guide/settings) — All configuration options
