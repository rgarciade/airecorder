---
title: Transcription
description: Convert your audio to editable text using AI.
---

# Transcription

AIRecorder uses Whisper to transcribe audio to text. You can use local providers (Ollama, LM Studio) or cloud providers (Gemini, DeepSeek, Kimi).

## How to Transcribe

1. **Select a recording** from your library
2. Click the **"Transcribe"** button in the toolbar
3. Choose the **AI provider** to use
4. Wait for the process to complete

## Supported Providers

### Local (No internet)

- **Ollama**: Recommended. Download models like `whisper-base`, `whisper-large`
- **LM Studio**: Visual interface for managing models

### Cloud

- **Google Gemini**: Fast and accurate
- **DeepSeek**: Good value for quality
- **Kimi**: Excellent for Spanish

::: info
To use local providers, check our [Local AI](/en/guide/local-ai) guide.
:::

## Diarization

During transcription, AIRecorder can identify different speakers. This is known as **diarization**.

Speakers are shown as:
- **Speaker 1**, **Speaker 2**, etc.
- You can rename them in the [Speakers](/en/guide/speakers) section

## Edit Transcription

The transcription is editable. You can:

- Fix spelling errors
- Join or split segments
- Add punctuation

## See also

- [AI Chat](/en/guide/chat) - Ask questions about your audio
- [Speakers](/en/guide/speakers) - Manage identified speakers