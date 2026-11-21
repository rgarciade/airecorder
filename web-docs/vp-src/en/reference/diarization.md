---
title: Speaker Diarization
description: Automatic speaker identification system.
---

# Speaker Diarization

**Diarization** is the process of identifying **who spoke** at each moment in a recording. AIRecorder tries to distinguish between different speakers and assign them a name or identifier.

## How It Works Technically

### 1. pyannote.audio

AIRecorder uses **pyannote.audio**, a Python library based on neural networks, to detect speech segments and group them by speaker.

The pre-trained model analyses the acoustic characteristics of the voice.

### 2. Speaker Embeddings

Each speech segment is converted into a **speaker embedding** (a vector representing the unique characteristics of that voice).

These embeddings allow comparison of whether two segments belong to the same person.

### 3. Cosine Similarity and Threshold

To determine whether two segments belong to the same speaker, the **cosine similarity** between their embeddings is calculated.

If the similarity exceeds the **threshold of 0.85**, they are considered the same speaker.

This threshold seeks a balance between:
- Not confusing different speakers
- Not over-splitting the same speaker

## How to Enable Diarization

1. Go to **Settings > General > Speaker Diarization**
2. Enable the "Automatically identify speakers" toggle
3. The first time you enable it, AIRecorder will download the pyannote model (requires internet connection)

::: warning
Once downloaded, processing works offline.
:::

## Threshold Adjustment

Adjust the **similarity threshold** with the slider:

| Value | Behavior |
|-------|----------|
| 0.75 - 0.80 | More permissive (less splitting) |
| 0.85 | Recommended (balance) |
| 0.90 - 0.95 | More strict (more splitting) |

## Requirements

- Initial model download (~500MB)
- Slower processing than basic transcription
- Higher system resource consumption