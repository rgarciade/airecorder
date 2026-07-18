import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const originalExistsSync = fs.existsSync;

describe('ragService', () => {
  let ragService;

  beforeEach(async () => {
    vi.restoreAllMocks();

    vi.spyOn(fs, 'existsSync').mockImplementation((targetPath) => {
      if (typeof targetPath !== 'string') return originalExistsSync(targetPath);
      if (targetPath.includes('/rec2/')) return false;
      if (targetPath.includes('/rec1/') || targetPath.includes('/rec3/')) return true;
      return originalExistsSync(targetPath);
    });
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    ragService = await import('../../../../electron/services/ragService.js');
  });

  describe('getEmbeddingModelId', () => {
    it('returns custom:{connId}:{model} for a custom provider', () => {
      const id = ragService.getEmbeddingModelId({
        provider: 'custom-openai',
        connectionId: 'conn-1',
        model: 'embed-model',
      });

      expect(id).toBe('custom:conn-1:embed-model');
    });

    it('keeps the original provider:model format for built-in providers', () => {
      const id = ragService.getEmbeddingModelId({ provider: 'ollama', model: 'nomic-embed-text' });
      expect(id).toBe('ollama:nomic-embed-text');
    });
  });

  describe('reindexAllRecordings', () => {
    it('calls indexRecording only for recordings that have a vectordb/ directory', async () => {
      const indexFn = vi.fn().mockResolvedValue({ indexed: true, totalChunks: 5 });
      const getRecordings = () => [
        { relative_path: 'rec1' },
        { relative_path: 'rec2' },
        { relative_path: 'rec3' },
      ];
      const provider = { provider: 'ollama', model: 'nomic-embed-text' };

      const result = await ragService.reindexAllRecordings({
        indexFn,
        getRecordings,
        provider,
        baseOutputDir: '/tmp/recordings',
      });

      expect(indexFn).toHaveBeenCalledTimes(2);
      expect(indexFn).toHaveBeenCalledWith(path.join('/tmp/recordings', 'rec1'));
      expect(indexFn).toHaveBeenCalledWith(path.join('/tmp/recordings', 'rec3'));
      expect(indexFn).not.toHaveBeenCalledWith(path.join('/tmp/recordings', 'rec2'));
      expect(result.reindexed).toBe(2);
      expect(result.total).toBe(2);
    });

    it('writes global rag_metadata.json with lastEmbeddingModelId', async () => {
      const indexFn = vi.fn().mockResolvedValue({ indexed: true, totalChunks: 1 });
      const getRecordings = () => [{ relative_path: 'rec1' }];
      const provider = { provider: 'custom-openai', connectionId: 'conn-1', model: 'embed-model' };

      await ragService.reindexAllRecordings({
        indexFn,
        getRecordings,
        provider,
        baseOutputDir: '/tmp/recordings',
      });

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/tmp/recordings', 'rag_metadata.json'),
        expect.stringMatching(/"lastEmbeddingModelId"\s*:\s*"custom:conn-1:embed-model"/)
      );
    });

    it('returns 0 reindexed when there are no recordings with vectordb', async () => {
      vi.spyOn(fs, 'existsSync').mockImplementation((targetPath) => {
        if (typeof targetPath !== 'string') return originalExistsSync(targetPath);
        return false;
      });
      const indexFn = vi.fn().mockResolvedValue({ indexed: true });
      const getRecordings = () => [{ relative_path: 'rec1' }];
      const provider = { provider: 'ollama', model: 'nomic-embed-text' };

      const result = await ragService.reindexAllRecordings({
        indexFn,
        getRecordings,
        provider,
        baseOutputDir: '/tmp/recordings',
      });

      expect(indexFn).not.toHaveBeenCalled();
      expect(result.reindexed).toBe(0);
    });

  });
});
