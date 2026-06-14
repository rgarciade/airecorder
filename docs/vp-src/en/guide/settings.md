---
title: Settings
description: All AIRecorder configuration options explained in detail.
---

# Settings

AIRecorder has 3 settings tabs. Here's every option explained.

---

## AI Agents

The main tab where you configure the AI engine.

### Local Providers (Ollama / LM Studio)

| Field | Description |
|-------|-------------|
| **Host / Base URL** | Local server address. Ollama: `http://localhost:11434`. LM Studio: `http://localhost:1234/v1`. The app auto-detects it if the service is running. |
| **General Model** | Generates automatic summaries, tasks, key points, and analysis after each transcription. |
| **Chat Model** | For interactive conversations in the chat panel (RAG). If left empty, the General Model is used. |
| **Embedding Model** | Converts text into vectors for semantic search (RAG). If you change this model, you need to re-index your transcriptions. |
| **Context Window** | Maximum tokens the model can process at once. Use the **"Detect"** button to auto-configure it based on your model and hardware. |

### Cloud Providers

| Provider | Requires | Description |
|----------|----------|-------------|
| **Gemini Free** | Google API Key | Google's free model. The model is loaded dynamically from the API. |
| **Gemini Pro** | Google API Key | Advanced version of Gemini with better capabilities. |
| **DeepSeek** | API Key | Cloud model with good quality/price ratio. |
| **Kimi (Moonshot)** | API Key | Alternative cloud provider. |

::: tip Local or Cloud?
- **Local**: Full privacy, no cost, no internet (after downloading models)
- **Cloud**: More powerful models, ideal for very long meetings or limited hardware
:::

---

## General

### Storage

| Option | Description |
|--------|-------------|
| **Recordings directory** | Folder where WAV files and transcriptions are saved. You can change it with the folder picker. |
| **Database** | Location of the SQLite file with metadata. You can migrate it to another location while keeping your data. |

### Transcription

| Option | Description |
|--------|-------------|
| **Transcription language** | Language Whisper expects in the audio. Leave on "Auto" if you don't know the language beforehand. |
| **Whisper model** | `tiny` (fastest) → `large` (most accurate). Larger models need more RAM and processing time. |
| **CPU threads** | Cores used for transcription. More threads = faster, but uses more CPU. |
| **Auto-transcription** | If enabled, transcription starts automatically when you stop recording. |
| **Auto AI-analysis** | If enabled, summary, tasks, and key points are generated automatically after transcription. Requires configured AI. |
| **Auto-Generate Schema** | If enabled, after the initial AI analysis completes, the schema/mind-map is generated automatically (if it doesn't exist). Requires auto-analysis enabled. |

::: tip Full automatic flow
With **Auto-transcription** + **Auto AI-analysis** enabled: record → stop → AI transcribes and analyzes everything without you touching anything else.
::: 

### Speaker Diarization ⚡ Experimental

| Option | Description |
|--------|-------------|
| **Enable** | Automatically identifies who is speaking at each moment using pyannote.audio. |
| **HuggingFace Token** | Access token to download the diarization model. First activation requires internet. |
| **Similarity threshold** | 50–99%. Lower values = more permissive (merges similar voices). Higher values = stricter (splits more). Default: 85%. |

### Appearance

| Option | Description |
|--------|-------------|
| **Theme** | Light, Dark, or follow system. |
| **Interface language** | Spanish or English. Immediate change without restarting. |
| **Font size** | Adjusts text throughout the interface. |

### Projects

| Option | Description |
|--------|-------------|
| **Recent meetings** | How many recordings to show in each project panel (1–10). |

### Audio

| Option | Description |
|--------|-------------|
| **Microphone** | Select the system audio input device. |

### System

| Option | Description |
|--------|-------------|
| **System notifications** | Show native notifications when transcriptions or analysis complete. |
| **Developer Tools** | Opens Electron developer tools (console, network, elements). |

### Permissions

Shows the microphone permission status. If denied, you can open System Preferences from here to grant it.

### About

Shows the current installed AIRecorder version.

---

## Experts

The Experts tab allows configuring custom prompts and advanced AI settings. (This section will be expanded in the future.)

---

## See also

- [Schema](/en/guide/schema) — AI-generated interactive mind-map
- [Local AI](/en/guide/local-ai) — Setting up Ollama or LM Studio
- [Diarization](/en/reference/diarization) — Technical details on speaker recognition
- [RAG System](/en/reference/rag) — How semantic search works
