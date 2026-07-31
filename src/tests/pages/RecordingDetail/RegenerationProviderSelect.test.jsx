import React from 'react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import RegenerationProviderSelect from '../../../pages/RecordingDetail/components/RegenerationProviderSelect';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('RegenerationProviderSelect', () => {
  let root;
  let container;

  afterEach(() => {
    root?.unmount();
    container?.remove();
  });

  async function renderSelect(codexStatus) {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(
      <RegenerationProviderSelect
        value="gemini"
        onChange={vi.fn()}
        codexStatus={codexStatus}
      />
    ));
    return container.querySelector('option[value="codex"]');
  }

  it('shows Codex as an enabled generative provider when connected', async () => {
    const codexOption = await renderSelect({ available: true, connected: true });

    expect(codexOption).not.toBeNull();
    expect(codexOption.textContent).toContain('Codex');
    expect(codexOption.disabled).toBe(false);
    expect(container.querySelectorAll('select')).toHaveLength(1);
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('[data-testid="codex-model-select"]')).toBeNull();
    expect(container.querySelector('[data-testid="codex-effort-select"]')).toBeNull();
  });

  it('keeps Codex visible but unavailable when the subscription is disconnected', async () => {
    const codexOption = await renderSelect({ available: true, connected: false });

    expect(codexOption).not.toBeNull();
    expect(codexOption.disabled).toBe(true);
  });
});
