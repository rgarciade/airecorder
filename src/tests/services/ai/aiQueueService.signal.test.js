import { describe, expect, it, vi } from 'vitest';

const { aiQueueService } = await import('../../../services/ai/aiQueueService');

describe('aiQueueService.enqueue — meta.signal', () => {
  it('rejects as cancelled without running the task if the signal is already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    const fn = vi.fn().mockResolvedValue({ text: 'x' });
    await expect(aiQueueService.enqueue(fn, { signal: ac.signal })).rejects.toMatchObject({ cancelled: true });
    expect(fn).not.toHaveBeenCalled();
    expect(aiQueueService.getState().queue).toHaveLength(0);
  });

  it('cancels the running task when the signal aborts later', async () => {
    const ac = new AbortController();
    const p = aiQueueService.enqueue(
      (signal) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(signal.reason))),
      { signal: ac.signal },
    );
    ac.abort();
    await expect(p).rejects.toMatchObject({ cancelled: true });
  });

  it('cancels a pending task (behind a running one) when its signal aborts', async () => {
    let release;
    const running = aiQueueService.enqueue(() => new Promise((r) => { release = r; }), {});
    const ac = new AbortController();
    const fn = vi.fn().mockResolvedValue({ text: 'x' });
    const pending = aiQueueService.enqueue(fn, { signal: ac.signal });
    ac.abort();
    await expect(pending).rejects.toMatchObject({ cancelled: true });
    release({ text: 'done' });
    await running;
    expect(fn).not.toHaveBeenCalled();
  });

  it('aborting after the task finished is a harmless no-op', async () => {
    const ac = new AbortController();
    await aiQueueService.enqueue(async () => ({ text: 'ok' }), { signal: ac.signal });
    const before = aiQueueService.getState().history.length;
    ac.abort();
    expect(aiQueueService.getState().history.length).toBe(before);
  });
});
