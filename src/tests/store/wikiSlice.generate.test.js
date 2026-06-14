import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';

const serviceMocks = vi.hoisted(() => ({
  listPages: vi.fn(),
  createPage: vi.fn(),
  updatePage: vi.fn(),
  deletePage: vi.fn(),
  generateStarterPage: vi.fn(),
}));

vi.mock('../../services/wikiService.js', () => ({
  listPages: serviceMocks.listPages,
  createPage: serviceMocks.createPage,
  updatePage: serviceMocks.updatePage,
  deletePage: serviceMocks.deletePage,
  generateStarterPage: serviceMocks.generateStarterPage,
}));

import wikiReducer, {
  generateStarterPage,
  selectIsGenerating,
  selectError,
} from '../../store/slices/wikiSlice.js';

describe('wikiSlice generate starter page', () => {
  beforeEach(() => {
    Object.values(serviceMocks).forEach((mockFn) => mockFn.mockReset());
  });

  it('setea error cuando falla generateStarterPage', async () => {
    serviceMocks.generateStarterPage.mockRejectedValue(new Error('generation boom'));
    const store = configureStore({ reducer: { wiki: wikiReducer } });

    const promise = store.dispatch(generateStarterPage({ projectId: 1, options: { language: 'es' } }));
    expect(selectIsGenerating(store.getState())).toBe(true);
    await promise;

    expect(selectIsGenerating(store.getState())).toBe(false);
    expect(selectError(store.getState())).toContain('generation boom');
  });
});
