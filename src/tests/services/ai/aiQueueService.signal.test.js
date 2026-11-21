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
});
