import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import CodexModelControls from '../components/CodexModelControls/CodexModelControls.jsx';
import { reconcileCodexSelection } from '../services/ai/codexModelSelection.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const t = (key, values) => values?.error ? `${key}:${values.error}` : key;
const models = [{ id: 'catalog-a', model: 'gpt-a', displayName: 'GPT A', description: 'Fast model', supportedReasoningEfforts: ['low', 'high'], defaultReasoningEffort: 'high', isDefault: true }];
const futureCatalogModels = [{ id: 'gpt-5.6-sol', model: 'gpt-5.6-sol', displayName: 'GPT-5.6 Sol', description: '', supportedReasoningEfforts: ['low', 'high'], defaultReasoningEffort: null, isDefault: true }];

describe('CodexModelControls', () => {
  let root; let container;
  afterEach(() => { root?.unmount(); container?.remove(); });

  it('uses the catalog default when saved model or effort is invalid', () => {
    expect(reconcileCodexSelection(models, 'removed-model', 'xhigh')).toEqual({ model: 'gpt-a', reasoningEffort: 'high' });
  });

  it('renders catalog metadata and only advertised reasoning efforts', async () => {
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root.render(<CodexModelControls t={t} models={models} loading={false} error="" model="gpt-a" reasoningEffort="high" onModelChange={vi.fn()} onReasoningEffortChange={vi.fn()} onRefresh={vi.fn()} />));
    expect(container.querySelector('[data-testid=codex-model-select]').textContent).toContain('GPT A');
    expect(container.textContent).toContain('Fast model');
    const efforts = [...container.querySelector('[data-testid=codex-effort-select]').options].map(option => option.value);
    expect(efforts).toEqual(['low', 'high']);
  });

  it('keeps the catalog selector and exposes only runtime-supported future-model efforts', async () => {
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root.render(<CodexModelControls t={t} models={futureCatalogModels} loading={false} error="" model="gpt-5.6-sol" reasoningEffort="" onModelChange={vi.fn()} onReasoningEffortChange={vi.fn()} onRefresh={vi.fn()} />));

    expect(reconcileCodexSelection(futureCatalogModels, 'gpt-5.6-sol', 'max')).toEqual({ model: 'gpt-5.6-sol', reasoningEffort: '' });
    expect(container.querySelector('[data-testid=codex-model-select]').value).toBe('gpt-5.6-sol');
    expect(container.querySelector('[data-testid=codex-model-fallback]')).toBeNull();
    const efforts = [...container.querySelector('[data-testid=codex-effort-select]').options].map(option => option.value);
    expect(efforts).toEqual(['low', 'high']);
  });

  it('allows changing effort and preserves valid saved selections', async () => {
    const onReasoningEffortChange = vi.fn();
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root.render(<CodexModelControls t={t} models={models} loading={false} error="" model="gpt-a" reasoningEffort="low" onModelChange={vi.fn()} onReasoningEffortChange={onReasoningEffortChange} onRefresh={vi.fn()} />));

    const effortSelect = container.querySelector('[data-testid=codex-effort-select]');
    expect(effortSelect.value).toBe('low');
    await act(async () => {
      effortSelect.value = 'high';
      effortSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onReasoningEffortChange).toHaveBeenCalledWith('high');
    expect(reconcileCodexSelection(models, 'gpt-a', 'low')).toEqual({ model: 'gpt-a', reasoningEffort: 'low' });
  });

  it('shows manual model input only when catalog loading fails', async () => {
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root.render(<CodexModelControls t={t} models={[]} loading={false} error="offline" model="saved-model" reasoningEffort="" onModelChange={vi.fn()} onReasoningEffortChange={vi.fn()} onRefresh={vi.fn()} />));
    expect(container.querySelector('[data-testid=codex-model-fallback]').value).toBe('saved-model');
    expect(container.querySelector('[data-testid=codex-model-select]')).toBeNull();
    expect(container.textContent).toContain('settings.providers.codexModelsError:offline');
  });
});
