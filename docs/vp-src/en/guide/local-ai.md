---
title: Local AI
description: Set up Ollama or LM Studio to use local AI with AIRecorder. Recommended models and dual architecture.
---

# Local AI

AIRecorder can run completely offline using local AI models. This guarantees **full privacy** — your data never leaves your computer.

## Why Local AI?

- **Privacy**: Your transcriptions and data are never sent to external servers
- **No costs**: No need to pay for cloud API keys
- **No internet**: Works offline once models are downloaded
- **Full control**: You choose which models to use and how they run

---

## Dual Architecture: General Model vs. Chat

AIRecorder uses **two different models** for different tasks. You can configure them separately in Settings:

| Model | Function | When is it used? |
|-------|----------|------------------|
| **General Model** | Summaries, analysis, tasks, key points, participants | After each transcription (auto-analysis) |
| **Chat Model** | Interactive conversations with RAG | When you ask questions in the chat about a transcription |
| **Embedding Model** | Semantic search (vectors) | Transcription indexing and RAG searches |

::: tip 💡 If you don't configure the Chat Model, AIRecorder will use the General Model for everything.
:::

---

## Ollama (Recommended)

Ollama is the simplest option. It runs as a background service and AIRecorder detects it automatically.

### Installation

1. Download Ollama from [ollama.com/download](https://ollama.com/download)
2. Run the installer
3. Open your terminal and download the models:

```bash
# Main model for analysis and chat (Gemma 3 4B)
ollama pull gemma3:4b

# Embedding model for semantic search
ollama pull mxbai-embed-large
```

### Configuration in AIRecorder

1. Go to **Settings > AI Agents**
2. Select **Ollama** as the provider
3. The default URL is `http://localhost:11434` (AIRecorder auto-detects it)
4. Select `gemma3:4b` as both **General Model** and **Chat Model**
5. Select `mxbai-embed-large` as the **Embedding Model**
6. Use the **"Detect"** button to auto-configure the context window
7. Click **"Verify model"** to confirm everything works

---

## LM Studio

LM Studio offers a graphical interface and fine-grained control over model parameters.

### Installation

1. Download LM Studio from [lmstudio.ai](https://lmstudio.ai)
2. Open the application
3. Search and download the models:
   - **Chat**: `gemma-3-4b-it-GGUF` or similar
   - **Embedding**: `mxbai-embed-large-v1.Q8_0.gguf`

### Starting the Server

1. Go to the **Local Server** tab (network icon)
2. Load your chat model
3. Enable the embedding model
4. Click **Start Server**

### Configuration in AIRecorder

1. Go to **Settings > AI Agents**
2. Select **LM Studio**
3. The URL is usually `http://localhost:1234/v1`
4. Configure the models the same way as with Ollama
5. Click **"Verify model"**

---

## Recommended Models

### ⭐ Chat / General Models

| Model | Size | Min RAM | Recommended for |
|-------|------|---------|-----------------|
| **gemma3:4b** ⭐ | ~3GB | 8 GB | **Primary** — fast, accurate, ideal for analysis |
| llama3.2:3b 🪶 | ~2GB | 8 GB | Lightweight alternative |
| qwen2.5:7b | ~4GB | 16 GB | Deeper analysis |
| deepseek-r1:8b | ~5GB | 16 GB | Advanced reasoning |

### ⭐ Embedding Models

| Model | Accuracy | Recommended for |
|-------|----------|-----------------|
| **mxbai-embed-large** ⭐ | High | **Primary** — better search precision |
| nomic-embed-text 🪶 | Medium | Lightweight alternative, universally compatible |

::: warning ⚠️ Embedding model consistency
The embedding model must be the same for indexing and searching. If you change the model, you need to **re-index** your transcriptions from Settings.
:::

---

## Context Window

The **context window** is the model's "short-term memory": the maximum number of tokens (words) it can process at once.

| Size | RAM Required | For... |
|------|-------------|---------|
| 4096 | 8 GB | Basic computers |
| 8192 | 16 GB | **Recommended** |
| 32768+ | 32 GB+ | Mac M-series, dedicated GPUs |

::: tip 💡 RAG system to the rescue
You don't need a huge context window for long meetings. AIRecorder uses the RAG system to find only the **5 most relevant fragments** from the transcription and send them to the AI. This way you can query hours-long meetings with very little RAM.
:::

Use the **"Detect"** button in Settings for AIRecorder to automatically configure the optimal value based on your hardware.

---

## See also

- [Adding Content](/en/guide/recording) — The 4 import methods
- [RAG System](/en/reference/rag) — How semantic search works
- [Settings](/en/guide/settings) — All configuration options
