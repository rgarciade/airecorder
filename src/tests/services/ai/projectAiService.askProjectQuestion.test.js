import { describe, it, expect, vi, beforeEach } from 'vitest';

const buildSystemPrompt = vi.fn();
const callChatProviderStreaming = vi.fn();

vi.mock('../../../services/ai/providerRouter', () => ({
  callProvider: vi.fn(),
  callChatProviderStreaming: (...args) => callChatProviderStreaming(...args),
}));
vi.mock('../../../services/ai/aiQueueService', () => ({
  AI_TASK_TYPES: { CHAT: 'chat' },
}));
vi.mock('../../../services/settingsService', () => ({
  getSettings: vi.fn(async () => ({})),
}));
vi.mock('../../../services/ai/promptBuilder', () => ({
  FEATURE_TYPES: { CHAT: 'chat' },
  buildSystemPrompt: (...args) => buildSystemPrompt(...args),
}));

import projectAiService from '../../../services/projectAiService.js';

const electronAPI = {
  searchProject: vi.fn(),
  searchRecording: vi.fn(),
  getAiSummary: vi.fn(),
  getRecordingSchema: vi.fn(),
};

/** Resultado de searchProject para una grabación con `count` chunks de ~100 tokens */
function resultWithChunks(recordingId, count, { textTokens = 80, baseScore = 0.5 } = {}) {
  return {
    recordingId,
    success: true,
    chunks: Array.from({ length: count }, (_, i) => ({
      chunkId: i,
      text: 'a'.repeat(textTokens * 4),
      textDisplay: 'a'.repeat(textTokens * 4),
      startTime: i * 20,
      endTime: i * 20 + 10,
      speakers: 'Ana',
      score: baseScore + i * 0.001,
    })),
  };
}

const schemaFor = (title) => ({
  success: true,
  schema: { branches: [{ title: `Rama de ${title}`, children: [{ label: `Nodo ${title}` }] }] },
});

function lastSystemPrompt() {
  return callChatProviderStreaming.mock.calls.at(-1)[0][0].content;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});

  buildSystemPrompt.mockImplementation(async (_type, base) => base);
  callChatProviderStreaming.mockResolvedValue({ text: 'respuesta' });
  electronAPI.searchRecording.mockResolvedValue({ success: true, chunks: [] });
  electronAPI.getAiSummary.mockResolvedValue({ success: false });
  electronAPI.getRecordingSchema.mockImplementation(async (id) => schemaFor(`T-${id}`));
  electronAPI.searchProject.mockImplementation(async (ids) => ({
    success: true,
    results: ids.map((id) => resultWithChunks(id, 2)),
  }));
  globalThis.window = { electronAPI };
  projectAiService.analysisCache.set('p1', { resumen_breve: 'breve' });
});

describe('askProjectQuestion() — búsqueda unificada', () => {
  it('D1: una sola llamada a searchProject con topK 5 en auto y 12 en detallado; nunca searchRecording', async () => {
    const ids = ['r1', 'r2', 'r3'];

    await projectAiService.askProjectQuestion('p1', '¿qué se decidió?', ids, {}, [], 'auto');
    expect(electronAPI.searchProject).toHaveBeenCalledTimes(1);
    expect(electronAPI.searchProject).toHaveBeenCalledWith(ids, '¿qué se decidió?', 5);

    electronAPI.searchProject.mockClear();
    await projectAiService.askProjectQuestion('p1', '¿qué se decidió?', ids, {}, [], 'detallado');
    expect(electronAPI.searchProject).toHaveBeenCalledTimes(1);
    expect(electronAPI.searchProject).toHaveBeenCalledWith(ids, '¿qué se decidió?', 12);

    expect(electronAPI.searchRecording).not.toHaveBeenCalled();
  });
});

describe('askProjectQuestion() — modo por grabación', () => {
  it('D2: success:false o sin chunks → resumen; sin resumen → unavailable', async () => {
    electronAPI.searchProject.mockResolvedValue({
      success: true,
      results: [
        resultWithChunks('r1', 2),
        { recordingId: 'r2', success: false, chunks: [], error: 'x' },
        { recordingId: 'r3', success: true, chunks: [] },
      ],
    });
    electronAPI.getAiSummary.mockImplementation(async (id) =>
      id === 'r2' ? { success: true, summary: { resumen: 'resumen de r2' } } : { success: false }
    );

    const { contextInfo } = await projectAiService.askProjectQuestion('p1', 'q', ['r1', 'r2', 'r3'], {}, [], 'auto');

    expect(electronAPI.getAiSummary).toHaveBeenCalledWith('r2');
    expect(electronAPI.getAiSummary).toHaveBeenCalledWith('r3');
    expect(electronAPI.getAiSummary).not.toHaveBeenCalledWith('r1');
    expect(contextInfo.perRecordingMode).toEqual({ r1: 'rag', r2: 'summary', r3: 'unavailable' });
  });

  it('D3: con chunks pero ninguno seleccionado por presupuesto → excluded, sin resumen ni esquema', async () => {
    // r1 acapara el presupuesto con chunks muy grandes y puntuaciones altas; r2 queda fuera
    electronAPI.searchProject.mockResolvedValue({
      success: true,
      results: [
        resultWithChunks('r1', 10, { textTokens: 400, baseScore: 0.9 }),
        resultWithChunks('r2', 1, { textTokens: 400, baseScore: 0.1 }),
      ],
    });

    const { contextInfo } = await projectAiService.askProjectQuestion(
      'p1', 'q', ['r1', 'r2'], {}, [], 'auto', { contextTokenLimit: 8000 }
    );

    expect(contextInfo.perRecordingMode.r1).toBe('rag');
    expect(contextInfo.perRecordingMode.r2).toBe('excluded');
    expect(electronAPI.getAiSummary).not.toHaveBeenCalledWith('r2');
    expect(lastSystemPrompt()).not.toContain('T-r2');
  });

  it('D4: esquemas solo para grabaciones en modo rag', async () => {
    electronAPI.searchProject.mockResolvedValue({
      success: true,
      results: [
        resultWithChunks('r1', 2),
        { recordingId: 'r2', success: true, chunks: [] },
      ],
    });

    await projectAiService.askProjectQuestion('p1', 'q', ['r1', 'r2'], {}, [], 'auto');

    expect(electronAPI.getRecordingSchema).toHaveBeenCalledWith('r1');
    expect(electronAPI.getRecordingSchema).not.toHaveBeenCalledWith('r2');
    expect(lastSystemPrompt()).toContain('T-r1');
    expect(lastSystemPrompt()).not.toContain('T-r2');
  });
});

describe('askProjectQuestion() — presupuesto de contexto', () => {
  it('D5: options.contextTokenLimit acota los chunks y no se reenvía al proveedor', async () => {
    const ids = Array.from({ length: 30 }, (_, i) => `r${i}`);
    electronAPI.searchProject.mockResolvedValue({
      success: true,
      results: ids.map((id) => resultWithChunks(id, 5)),
    });

    const { contextInfo } = await projectAiService.askProjectQuestion(
      'p1', 'q', ids, {}, [], 'auto', { contextTokenLimit: 8000, model: 'm' }
    );

    expect(contextInfo.chunksUsed).toBeLessThan(150);
    expect(contextInfo.chunksUsed).toBeGreaterThanOrEqual(3);

    const providerOptions = callChatProviderStreaming.mock.calls.at(-1)[2];
    expect(providerOptions).not.toHaveProperty('contextTokenLimit');
    expect(providerOptions.model).toBe('m');
  });
});
