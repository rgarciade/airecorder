---
title: AI Chat
description: Ask questions about your recordings using conversational AI.
---

# AI Chat

AIRecorder includes a chat assistant that can answer questions about your transcriptions using RAG (Retrieval-Augmented Generation) technology.

## How to Use the Chat

1. **Open a transcription** from your library
2. Click the **"Chat"** tab in the right panel
3. Write your question in the text field
4. Press **Enter** or click the send button

## Example Questions

- "What is this meeting about?"
- "What were the main topics discussed?"
- "Were any actions or tasks mentioned?"
- "Who said what about project X?"

## How It Works

When you ask a question, AIRecorder:

1. **Searches** the most relevant fragments of your transcription using embeddings
2. **Adds the schema** of the recording (if it exists) as additional context about the overall structure
3. **Sends** the fragments, the schema, and your question to the AI model
4. **Responds** based on your audio content

::: warning
The chat needs an AI provider configured. Check [Local AI](/en/guide/local-ai) to set up Ollama or LM Studio.
:::

## Configuration

In **Settings > AI Agents** you can configure:

- **Chat model**: Which model to use for generating responses
- **Embedding model**: To search for relevant fragments
- **Context window**: How much text to send to the model

## See also

- [Schema](/en/guide/schema) - Interactive recording mind-map
- [Transcription](/en/guide/transcription) - Generate transcriptions
- [RAG (Technical Reference)](/en/reference/rag) - How the system works