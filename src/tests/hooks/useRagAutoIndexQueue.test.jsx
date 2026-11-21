import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { NO_EMBEDDING_PROVIDER_ERROR } from '../../../electron/utils/ragErrors.json';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { getStatus, indexRecording, deleteIndex } = vi.hoisted(() => ({
  getStatus: vi.fn(),
  indexRecording: vi.fn(),
  deleteIndex: vi.fn(),
}));

vi.mock('../../services/ragService', () => ({
  default: { getStatus, indexRecording, deleteIndex },
}));

const { useRagAutoIndexQueue } = await import('../../hooks/useRagAutoIndexQueue.js');

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

async function flush(times = 3) {
  for (let i = 0; i < times; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
}

// Stable references: the hook's effect depends on `chats`, so a new array per
// render would re-run it on every state update.
const RECORDINGS = [
  { id: 1, title: 'Rec A' },
  { id: 2, title: 'Rec B' },
  { id: 3, title: 'Rec C' },
];

let hook;
function HookProbe({ activeChatId, chats, recordingSummaries }) {
  hook = useRagAutoIndexQueue({ activeChatId, chats, recordingSummaries });
  return null;
}

describe('useRagAutoIndexQueue', () => {
  let root;
  let container;

  function render(props) {
    return act(async () => root.render(<HookProbe {...props} />));
  }

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    deleteIndex.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    hook = undefined;
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('does not index a recording twice when the effect re-runs while a queue is in flight', async () => {
    // One shared gate for every getStatus call: if a second queue started, it would
    // also get past getStatus and index the same recordings again.
    const gate = deferred();
    getStatus.mockImplementation(() => gate.promise);
    indexRecording.mockResolvedValue({ success: true, indexed: true, totalChunks: 4 });

    const chats = [{ id: 'c1', contexto: [1, 2] }];
    await render({ activeChatId: 'c1', chats, recordingSummaries: RECORDINGS });

    // The chats list changes (new reference, same chat) while getStatus is still pending
    await render({ activeChatId: 'c1', chats: [{ id: 'c1', contexto: [1, 2] }], recordingSummaries: RECORDINGS });

    await act(async () => { gate.resolve({ success: true, indexed: false }); });
    await flush();

    expect(indexRecording).toHaveBeenCalledTimes(2);
    expect(indexRecording.mock.calls.filter(([id]) => id === 1)).toHaveLength(1);
    expect(indexRecording.mock.calls.filter(([id]) => id === 2)).toHaveLength(1);
    expect(hook.ragStatuses).toEqual({ 1: true, 2: true });
    expect(hook.ragIndexingProgress).toBeNull();
  });

  it('stops the queue on NO_EMBEDDING_PROVIDER_ERROR and returns the remaining ids to unchecked', async () => {
    getStatus.mockResolvedValue({ success: true, indexed: false });
    indexRecording.mockResolvedValue({ success: false, error: NO_EMBEDDING_PROVIDER_ERROR });

    const chats = [{ id: 'c1', contexto: [1, 2, 3] }];
    await render({ activeChatId: 'c1', chats, recordingSummaries: RECORDINGS });
    await flush();

    expect(indexRecording).toHaveBeenCalledTimes(1);
    expect(indexRecording).toHaveBeenCalledWith(1);
    expect(hook.ragStatuses[1]).toBeNull();
    // Not stuck as `false` ("indexing"): back to "not checked" so a later chat selection retries them
    expect(hook.ragStatuses).not.toHaveProperty('2');
    expect(hook.ragStatuses).not.toHaveProperty('3');
    expect(hook.ragIndexingProgress).toBeNull();
  });

  it('exposes { current, total, title } while indexing and clears it at the end', async () => {
    getStatus.mockResolvedValue({ success: true, indexed: false });
    const first = deferred();
    const second = deferred();
    indexRecording
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const chats = [{ id: 'c1', contexto: [1, 2] }];
    await render({ activeChatId: 'c1', chats, recordingSummaries: RECORDINGS });
    await flush();

    expect(hook.ragIndexingProgress).toEqual({ current: 1, total: 2, title: 'Rec A' });
    expect(hook.ragStatuses).toEqual({ 1: false, 2: false });

    await act(async () => { first.resolve({ success: true, indexed: true, totalChunks: 3 }); });
    await flush();
    expect(hook.ragIndexingProgress).toEqual({ current: 2, total: 2, title: 'Rec B' });

    await act(async () => { second.resolve({ success: true, indexed: true, totalChunks: 5 }); });
    await flush();
    expect(hook.ragIndexingProgress).toBeNull();
    expect(hook.ragStatuses).toEqual({ 1: true, 2: true });
    expect(hook.ragTotalChunks).toEqual({ 1: 3, 2: 5 });
  });

  it('reindexAll: deletes and re-indexes sequentially with progress, and stops on the systemic error', async () => {
    const first = deferred();
    indexRecording
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({ success: false, error: NO_EMBEDDING_PROVIDER_ERROR })
      .mockResolvedValue({ success: true, indexed: true, totalChunks: 1 });

    // No active chat: the auto-index queue stays idle, only the re-index runs
    await render({ activeChatId: null, chats: [], recordingSummaries: RECORDINGS });

    let done;
    await act(async () => { done = hook.reindexAll([1, 2, 3]); });
    await flush();

    expect(hook.ragIndexingProgress).toEqual({ current: 1, total: 3, title: 'Rec A' });
    expect(deleteIndex).toHaveBeenCalledTimes(1);
    expect(indexRecording).toHaveBeenCalledTimes(1);

    await act(async () => { first.resolve({ success: true, indexed: true, totalChunks: 2 }); });
    await act(async () => { await done; });
    await flush();

    expect(deleteIndex.mock.calls.map(([id]) => id)).toEqual([1, 2]);
    expect(indexRecording.mock.calls.map(([id]) => id)).toEqual([1, 2]);
    expect(hook.ragStatuses[1]).toBe(true);
    expect(hook.ragStatuses[2]).toBeNull();
    expect(hook.ragStatuses).not.toHaveProperty('3');
    expect(hook.ragIndexingProgress).toBeNull();
    expect(getStatus).not.toHaveBeenCalled();
  });
});
