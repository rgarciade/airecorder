---
title: Adding Content
description: All the ways to add recordings and transcriptions to AIRecorder.
---

# Adding Content

AIRecorder offers **4 methods** to add content to your library. Choose the one that best fits your situation.

## 1. Record Audio 🎙️

The main method. Captures your microphone and system audio **simultaneously** in a single track.

### How to record

1. On the home screen, select your **microphone** from the source selector
2. Press the **"Record"** button (red circle)
3. You'll see a visual indicator and a real-time audio level monitor
4. You can **pause and resume** the recording at any time
5. Press **"Stop"** to finish — the audio is saved automatically

### What exactly is recorded?

- **Your microphone**: your voice
- **System audio**: what plays through your speakers (Zoom, Teams, Meet meetings, online classes...)
- Both sources are mixed into a single high-quality WAV file (16-bit, 44.1kHz)

::: warning macOS Permissions
You need to grant **microphone** permission in System Preferences > Privacy & Security > Microphone.
:::

### After recording

When you stop recording, AIRecorder can:
- **Automatically transcribe** the audio (if enabled in Settings)
- **Automatically analyze with AI** (summary, tasks, key points)

---

## 2. Import Audio File 📁

If you already have a recording from another device or format, import it directly.

### Supported formats
WAV, MP3, M4A, FLAC, OGG, and other common audio formats.

### How to import

1. On the home screen, press the **"Audio"** button (upload icon)
2. Select the audio file from your computer
3. Name the recording in the dialog that appears
4. AIRecorder will start **automatic transcription** with Whisper

::: tip When to use this?
Ideal if you record with another device (voice recorder, phone) or receive audio from a colleague.
:::

---

## 3. Import Teams Transcription 🏢

Import the transcription file that Microsoft Teams generates for its meetings directly.

### How it works

1. On the home screen, press the **"Teams"** button (Teams icon)
2. Select the Teams transcription file (.docx or .vtt)
3. AIRecorder automatically extracts the text, speakers, and timestamps
4. **No AI is required** for this method — the transcription is already done
5. You can use RAG chat and AI analysis on the imported content

### Advantages
- No Whisper processing cost (transcription already exists)
- Preserves speakers identified by Teams
- Fast — imports in seconds

---

## 4. Import Text Conversation 📝

Paste or import any plain-text transcription — AI normalizes it to AIRecorder's format.

### How it works

1. On the home screen, press the **"Conversation"** button (document icon)
2. Type or paste the conversation text
3. You can also **import a file** (.txt, .md, .json)
4. Press **"Process"**
5. AI analyzes the text and converts it to the canonical segment format with estimated timestamps

::: warning Requirement
This method **requires a configured AI provider** (local or cloud). AI uses a normalization prompt to structure the text correctly.
:::

### Use cases
- You have a transcription from another tool
- A colleague sends you meeting notes as text
- You want to analyze written conversation content with AI

---

## Method Comparison

| Method | Generates audio? | Requires AI? | Speed | Best for... |
|--------|:---:|:---:|-----------|---------------|
| Record | ✅ Yes | For transcription | Real-time | Live meetings |
| Import audio | ✅ Yes | For transcription | Depends on length | External recordings |
| Teams | ❌ No | ❌ No | Instant | Teams transcriptions |
| Text | ❌ No | ✅ Yes | Seconds | Text from other sources |

## See also

- [Transcription](/en/guide/transcription) — How Whisper works in AIRecorder
- [Local AI](/en/guide/local-ai) — Setting up Ollama or LM Studio
- [Settings](/en/guide/settings) — Configure auto-transcription and auto-analysis
