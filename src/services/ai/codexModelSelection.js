export function reconcileCodexSelection(models, currentModel = '', currentEffort = '') {
  if (!Array.isArray(models) || models.length === 0) {
    return { model: currentModel, reasoningEffort: currentEffort };
  }

  const selected = models.find(item => item.model === currentModel || item.id === currentModel)
    || models.find(item => item.isDefault)
    || models[0];
  const efforts = selected.supportedReasoningEfforts || [];
  const reasoningEffort = efforts.includes(currentEffort)
    ? currentEffort
    : (efforts.includes(selected.defaultReasoningEffort) ? selected.defaultReasoningEffort : '');

  return { model: selected.model, reasoningEffort };
}

export function getCodexModel(models, modelId) {
  return Array.isArray(models) ? models.find(item => item.model === modelId || item.id === modelId) : undefined;
}
