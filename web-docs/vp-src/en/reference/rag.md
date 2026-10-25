---
title: RAG System
description: Retrieval-Augmented Generation in AIRecorder.
---

# RAG System

**RAG (Retrieval-Augmented Generation)** is the technique that allows the AI to find relevant information in your transcriptions without reading all the text every time.

## How It Works

### 1. Embeddings (Numerical Vectors)

Each transcription fragment is converted into a vector of numbers using an **embedding model**. These vectors represent the semantic meaning of the text.

Two texts with similar meaning will have vectors that are close together in mathematical space.

### 2. LanceDB (Vector Database)

The vectors are stored in **LanceDB**, an embedded vector database that enables fast similarity searches.

Features:
- No external server required
- Works locally like any other file
- Extremely fast searches

### 3. Chunking (Segmentation)

Transcriptions are split into manageable **chunks** before generating embeddings.

This ensures each search returns precise and contextualised fragments, not giant paragraphs.

### 4. How It Affects the Chat

When you ask a question in the chat, AIRecorder:

1. Converts your question into a vector
2. Finds the 5 most similar fragments in LanceDB
3. Sends those fragments as context to the AI along with your question
4. Returns the generated answer

All of this happens in under a second.

## Embedding Model

AIRecorder uses **nomic-embed-text** as the default model.

::: warning
The embedding model must match between indexing and search. If you change the model, you need to re-index your transcriptions.
:::

## Configuration

You can adjust the embedding model in **Settings > AI Agents**.

| Model | Accuracy | Speed |
|-------|----------|-------|
| nomic-embed-text | High | Fast |
| mxbai-embed-large | Very High | Medium |