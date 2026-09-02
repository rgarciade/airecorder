import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import CodexLoginControls from '../components/CodexLoginControls/CodexLoginControls.jsx';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const t = key => key;

describe('CodexLoginControls', () => {
  let root; let container;
  afterEach(() => { root?.unmount(); container?.remove(); delete window.electronAPI; });
  it('renders structured progress, cancels by requestId, resolves success and cleans listener', async () => {
    let listener; let resolve; const unsubscribe = vi.fn(); const start = vi.fn(id => new Promise(r => { resolve = r; }));
    window.electronAPI = { startCodexLogin: start, cancelCodexLogin: vi.fn(), onCodexLoginProgress: fn => { listener = fn; return unsubscribe; } };
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root.render(<CodexLoginControls t={t} onStatus={vi.fn()} />));
    const connectButton = container.querySelector('button');
    expect(connectButton.type).toBe('button');
    expect(connectButton.className).toMatch(/primaryButton/);
    expect(connectButton.disabled).toBe(false);
    await act(async () => { connectButton.click(); connectButton.click(); });
    expect(start).toHaveBeenCalledTimes(1);
    expect(connectButton.disabled).toBe(true);
    expect(connectButton.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelectorAll('button')[1].className).toMatch(/secondaryButton/);
    const requestId = start.mock.calls[0][0];
    await act(async () => listener({ requestId, phase: 'device-auth', url: 'https://auth.openai.com/device' }));
    await act(async () => listener({ requestId, phase: 'device-auth', code: 'I7GK-YAWPT' }));
    expect(container.querySelector('[role=status]').textContent).toContain('settings.providers.codexDeviceAuthInstructions');
    expect(container.querySelector('[data-testid=codex-login-code]').tagName).toBe('CODE');
    expect(container.querySelector('[data-testid=codex-login-code]').textContent).toBe('I7GK-YAWPT');
    expect(container.querySelector('[data-testid=codex-login-url]').href).toBe('https://auth.openai.com/device');
    expect(container.textContent).not.toMatch(/Welcome|\[90m/);
    await act(async () => resolve({ success: true })); expect(start).toHaveBeenCalled(); expect(container.textContent).toContain('settings.providers.codexConnected'); expect(unsubscribe).toHaveBeenCalled();
  });
  it('disables device auth and never starts login when already connected', async () => {
    const start = vi.fn();
    window.electronAPI = { startCodexLogin: start };
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root.render(<CodexLoginControls t={t} onStatus={vi.fn()} connected />));

    const connectButton = container.querySelector('button');
    expect(connectButton.disabled).toBe(true);
    expect(connectButton.textContent).toBe('settings.providers.codexConnected');
    await act(async () => connectButton.click());
    expect(start).not.toHaveBeenCalled();
  });
  it('keeps progress and completion updates active after the StrictMode effect replay', async () => {
    let listener; let resolve;
    const onStatus = vi.fn();
    window.electronAPI = {
      startCodexLogin: vi.fn(() => new Promise(r => { resolve = r; })),
      cancelCodexLogin: vi.fn(),
      onCodexLoginProgress: fn => { listener = fn; return vi.fn(); },
    };
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root.render(<React.StrictMode><CodexLoginControls t={t} onStatus={onStatus} /></React.StrictMode>));

    const connectButton = container.querySelector('button');
    await act(async () => connectButton.click());
    const requestId = window.electronAPI.startCodexLogin.mock.calls[0][0];
    await act(async () => listener({ requestId, phase: 'device-auth', code: 'I7GK-YAWPT' }));
    expect(container.querySelector('[data-testid=codex-login-code]').textContent).toBe('I7GK-YAWPT');

    await act(async () => resolve({ success: true, connected: true }));
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({ success: true, connected: true }));
    expect(connectButton.disabled).toBe(false);
    expect(connectButton.getAttribute('aria-busy')).toBe('false');
    expect(container.textContent).toContain('settings.providers.codexConnected');
  });
  it('cancels active request and cleans subscription on unmount', async () => {
    let resolve; let listener; const unsubscribe = vi.fn(); const cancel = vi.fn(); const onStatus = vi.fn(); window.electronAPI = { startCodexLogin: vi.fn(() => new Promise(r => { resolve = r; })), cancelCodexLogin: cancel, onCodexLoginProgress: fn => { listener = fn; return unsubscribe; } };
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => root.render(<CodexLoginControls t={t} onStatus={onStatus} />)); await act(async () => container.querySelector('button').click());
    const requestId = window.electronAPI.startCodexLogin.mock.calls[0][0];
    await act(async () => container.querySelectorAll('button')[1].click()); expect(cancel).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount()); expect(unsubscribe).toHaveBeenCalled(); expect(cancel).toHaveBeenCalledTimes(2);
    await act(async () => { listener?.({ requestId, code: 'LATE-12345' }); resolve?.({ success: true }); });
    expect(onStatus).not.toHaveBeenCalled();
  });
});
