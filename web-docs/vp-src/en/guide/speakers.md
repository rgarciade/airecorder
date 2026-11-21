---
title: Manage Speakers
description: Learn how to manage and identify speakers in your transcriptions.
---

# Manage Speakers

Speaker diarization lets you know **who said what** in your recordings. AIRecorder uses voice recognition technology to automatically identify different voices.

## How It Works

When you enable diarization, AIRecorder:

1. Analyzes the acoustic characteristics of each voice segment
2. Converts each voice into an **embedding** (unique numeric vector)
3. Groups segments with similar voices
4. Assigns automatic identifiers (Speaker 1, Speaker 2, etc.)

## Assign Names to Speakers

You can assign custom names to each detected speaker:

1. Open a transcription with diarization
2. Click on the speaker identifier (e.g., "Speaker 1")
3. Type the name you want to assign
4. Press Enter to save

AIRecorder will link that name with the **voice embedding** and automatically recognize that person in future recordings.

## Merge Speakers

Sometimes diarization can split the same person into multiple profiles (for example, if the voice tone changes). To merge them:

1. Go to the **Speakers** section in the sidebar
2. Select the profiles you want to merge
3. Click **Merge**
4. The system will combine the profiles into one

::: warning
When merging profiles, you'll keep all transcription history but under a single name.
:::

## Adjust Sensitivity

The **similarity threshold** determines how voices are grouped:

| Value | Behavior |
|-------|----------|
| 0.75 - 0.80 | More permissive (may merge different voices) |
| 0.85 | Balance (recommended) |
| 0.90 - 0.95 | More strict (may split the same voice) |

To adjust, go to **Settings > General > Speaker Diarization**.

## Best Practices

- **Assign names early**: The sooner you name a speaker, the better recognition will work in the future
- **Check after each new recording**: Verify that names were applied correctly
- **Use merge carefully**: Only merge profiles that clearly belong to the same person