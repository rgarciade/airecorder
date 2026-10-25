import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

// Bug #170: SpeakersPage hacía `return` temprano cuando diarizationEnabled === false
// ANTES de llamar a useCallback/useEffect/useSpeakerList/useSpeakerMerge. Al pasar de
// false a true cambia el número de hooks y React lanza "Rendered more hooks than
// during the previous render".

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, fallback) => (typeof fallback === 'string' ? fallback : key) }),
}));

vi.mock('../../../services/speakersService', () => ({
  default: {
    getSpeakersWithRecordings: vi.fn(),
  },
}));

vi.mock('../../../components/Speakers/SpeakerDropdown', () => ({
  default: () => null,
}));

import speakersService from '../../../services/speakersService';
import SpeakersPage from '../../../pages/Speakers/SpeakersPage';

describe('SpeakersPage — cambio de diarizationEnabled false -> true (#170)', () => {
  let container;
  let root;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    speakersService.getSpeakersWithRecordings.mockReset();
    speakersService.getSpeakersWithRecordings.mockResolvedValue([
      { id: 1, displayName: 'Ana Pérez', embeddingsCount: 1, recordingsCount: 2, createdAt: '2026-01-01' },
    ]);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('al activar la diarización tras renderizar desactivada no lanza "Rendered more hooks" y carga la lista', async () => {
    await act(async () => {
      root.render(<SpeakersPage diarizationEnabled={false} />);
    });

    expect(container.textContent).toContain('speakers.disabled');
    expect(speakersService.getSpeakersWithRecordings).not.toHaveBeenCalled();

    await act(async () => {
      root.render(<SpeakersPage diarizationEnabled />);
    });

    const hooksError = console.error.mock.calls
      .flat()
      .map(String)
      .find((m) => m.includes('Rendered more hooks') || m.includes('change in the order of Hooks'));
    expect(hooksError).toBeUndefined();
    expect(speakersService.getSpeakersWithRecordings).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Ana Pérez');
  });
});
