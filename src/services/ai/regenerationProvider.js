export const REGENERATION_PROVIDER_OPTIONS = [
  { value: 'gemini', label: 'Gemini (Google)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'codex', label: 'Codex (ChatGPT subscription)' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'kimi', label: 'Kimi (Moonshot)' },
  { value: 'ollama', label: 'Ollama (Local)' },
  { value: 'lmstudio', label: 'LM Studio (Local)' },
];

export function canUseRegenerationProvider(provider, { codexStatus } = {}) {
  if (provider !== 'codex') return true;
  return codexStatus?.available !== false && codexStatus?.connected === true;
}

export async function getCodexRegenerationStatus(electronAPI = globalThis.window?.electronAPI) {
  if (!electronAPI?.getCodexStatus) return { available: false, connected: false };
  try {
    return await electronAPI.getCodexStatus();
  } catch {
    return { available: false, connected: false };
  }
}

export function buildRegenerationProviderOverrides({
  provider,
  settings,
}) {
  const ollamaModel = settings?.ollamaModel;
  const lmStudioModel = settings?.lmStudioModel;
  const customModel = settings?.customGeneralModel;
  const codexModel = settings?.codexModel;
  const codexReasoningEffort = settings?.codexReasoningEffort;

  return {
    providerOverride: provider,
    ...(provider === 'ollama' && ollamaModel ? { model: ollamaModel } : {}),
    ...(provider === 'lmstudio' && lmStudioModel ? { model: lmStudioModel } : {}),
    ...(provider?.startsWith('custom:') && customModel ? { model: customModel } : {}),
    ...(provider === 'codex' && codexModel ? { model: codexModel } : {}),
    ...(provider === 'codex' && codexReasoningEffort ? { codexReasoningEffort } : {}),
  };
}
