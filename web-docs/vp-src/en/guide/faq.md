---
title: Frequently Asked Questions
description: Answers to common questions about AIRecorder.
---

# Frequently Asked Questions

<details>
<summary>Transcription is not working</summary>

**Check the following:**

1. You have an AI provider configured and running. Go to **Settings > AI Agents** and click **"Verify model"**.
2. The audio file was generated correctly. Check that it is not empty in the recordings folder.
3. If you are using local Whisper, make sure **Ollama** or **LM Studio** is running.

If the problem persists, check the logs in the developer console: **Help > Toggle Developer Tools**.
</details>

<details>
<summary>The AI does not respond in the chat</summary>

**Check the following:**

1. The AI provider is active and the connection is correct (go to **Settings > AI Agents**).
2. The transcription has content indexed in LanceDB. If you just created it, wait a few seconds for it to be indexed.
3. The embedding model is correct.

If you are using a local model, make sure it has enough RAM available.
</details>

<details>
<summary>Can I use the app without internet?</summary>

**Yes, completely.**

If you use **Ollama** or **LM Studio** with locally downloaded models, AIRecorder works without an internet connection:

- ✅ Audio recording
- ✅ Transcription with local Whisper
- ✅ AI analysis (summary, tasks, key points)
- ✅ RAG chat on transcriptions

You only need internet for the initial model download or if you use cloud providers (Gemini, DeepSeek, Kimi).
</details>

<details>
<summary>How do I change the interface language?</summary>

Go to **Settings > General** and look for the language section. AIRecorder supports **Spanish** and **English**. The change applies immediately.

**Note:** The transcription language (the language Whisper detects) is configured separately in **Settings > AI Agents**.
</details>

<details>
<summary>Where is my data stored?</summary>

**All your data is stored locally on your computer.**

The SQLite database, audio files and LanceDB indexes live in the application data directory:

```
~/Library/Application Support/AIRecorder
```

**No data is sent to external servers** unless you use a cloud AI provider (Gemini, DeepSeek, Kimi).
</details>

<details>
<summary>Diarization confuses speakers or splits them incorrectly</summary>

**Adjust the similarity threshold:**

- If it **confuses different people** (too permissive): raise the threshold towards 0.90–0.95 in **Settings > General**.
- If it **over-splits the same person** (too strict): lower the threshold towards 0.75–0.80.
- Use the **Merge speakers** function in the sidebar to manually fix incorrect splits.

Once you assign a name to a speaker, AIRecorder saves their voice embedding and improves identification in future recordings.
</details>

<details>
<summary>Can I improve or customise the AI analysis?</summary>

**Yes, in several ways:**

- **Custom prompts:** Go to **Settings > AI Agents > Custom prompts** and modify the instructions for each type of analysis.
- **User instructions:** When improving a task from the chat, you can include specific instructions about the format or focus you want in the response.
- **Change model:** Try more capable models (Gemini Pro, DeepSeek, Llama 3 via Ollama) for higher quality analysis.
</details>