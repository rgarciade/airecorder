import React, { useState } from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const tareasHandler = vi.fn();
const clearHandler = vi.fn();

// useChatCommands.js despacha por nombre contra este mapa — lo reemplazamos por dobles
// controlables en vez de ejecutar los comandos reales (que llaman a la IA/IPC).
vi.mock('../../services/chat/commands/index.js', () => ({
  CHAT_COMMAND_HANDLERS: {
    tareas: (...args) => tareasHandler(...args),
    clear: (...args) => clearHandler(...args),
  },
}));

describe('useChatCommands — runsInBackground dispatch', () => {
  let useChatCommands;
  let root;
  let container;
  let controller;
  let setBusyCalls;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ useChatCommands } = await import('../../hooks/useChatCommands.js'));
    controller = {};
    setBusyCalls = [];
  });

  afterEach(() => {
    root?.unmount();
    container?.remove();
  });

  function Harness({ isBusyOverride }) {
    const [isBusy, setIsBusyState] = useState(isBusyOverride ?? false);
    const [history, setHistory] = useState([]);

    const setBusy = (v) => {
      setBusyCalls.push(v);
      setIsBusyState(v);
    };

    const { runCommand } = useChatCommands({
      scope: 'recording',
      lang: 'es',
      model: undefined,
      getHistory: () => history,
      replaceHistory: async (entries) => setHistory(entries),
      isBusy,
      setBusy,
      t: (key) => key,
      recordingId: 1,
    });

    controller.runCommand = runCommand;
    return null;
  }

  function mount(props) {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    return act(async () => {
      root.render(<Harness {...props} />);
    });
  }

  it('does NOT call setBusy(true) for a runsInBackground command, and resolves immediately without waiting for the handler', async () => {
    let resolveHandler;
    const pending = new Promise((resolve) => { resolveHandler = resolve; });
    tareasHandler.mockReturnValue(pending);

    await mount();

    let result;
    await act(async () => {
      result = await controller.runCommand('tareas', 'foco');
    });

    expect(result).toEqual({ success: true, background: true });
    expect(tareasHandler).toHaveBeenCalledTimes(1);
    // El punto central del cambio: nunca se pasa por setBusy(true) para /tareas.
    expect(setBusyCalls).not.toContain(true);

    // Limpieza: resolvemos el handler pendiente para no dejar una promesa colgando
    // entre tests (el .catch interno de useChatCommands ya la cubre si rechaza).
    resolveHandler({ success: true });
    await act(async () => { await Promise.resolve(); });
  });

  it('DOES call setBusy(true) then setBusy(false) for a non-background command, and awaits its result', async () => {
    clearHandler.mockResolvedValue({ success: true });

    await mount();

    let result;
    await act(async () => {
      result = await controller.runCommand('clear');
    });

    expect(result).toEqual({ success: true });
    expect(setBusyCalls).toEqual([true, false]);
  });

  it('still honors the isBusy re-entrancy guard for background commands (does not even call the handler)', async () => {
    await mount({ isBusyOverride: true });

    let result;
    await act(async () => {
      result = await controller.runCommand('tareas', '');
    });

    expect(result).toEqual({ success: false, error: 'chatCommands.busy' });
    expect(tareasHandler).not.toHaveBeenCalled();
  });

  it('catches an unhandled rejection from a background handler instead of leaving it unhandled', async () => {
    let rejectHandler;
    const pending = new Promise((_resolve, reject) => { rejectHandler = reject; });
    tareasHandler.mockReturnValue(pending);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await mount();

    await act(async () => {
      await controller.runCommand('tareas', '');
    });

    rejectHandler(new Error('boom'));
    // Deja correr microtasks para que el .catch interno se ejecute.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
