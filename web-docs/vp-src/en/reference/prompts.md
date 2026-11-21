---
title: AI Prompts
description: Prompts used by AIRecorder to analyze transcriptions.
---

# AI Prompts

**Prompts** are the instructions we give the AI so it knows what to do with the text from your transcriptions. The quality of the prompt directly determines the quality of the response.

## Types of Analysis

### Summary

Generates a concise summary of the meeting.

The AI identifies:
- Main topics discussed
- Decisions made
- General context

**Use:** Ideal for a quick overview without reading the full transcription.

### Key Points

Extracts the most important points from the conversation in list format.

**Use:** Quickly reviewing the most relevant aspects of a long meeting.

### Pending Tasks

Identifies committed actions, who took them on and any deadlines mentioned.

Generates a structured list of **action items**.

**Use:** Following up on tasks assigned in the meeting.

### Free Chat

Answers specific questions about the transcription content using the RAG context.

**Use:** Asking about any aspect of the meeting.

## Custom Prompts

You can customise prompts from **Settings > AI Agents > Custom prompts**.

There you will find fields to modify the instructions the AI receives for each type of analysis:
- Summary
- Key points
- Tasks
- Chat

::: tip
Changes apply immediately without restarting the app.
:::

## Best Practices

1. **Be specific**: The clearer you are in your instructions, the better results you'll get
2. **Establish format**: Indicate how you want the output (list, paragraphs, tables)
3. **Define tone**: Specify if you want a formal or casual tone