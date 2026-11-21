import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

// Bug #170: App.jsx usaba `setDbFallbackBanner` sin desestructurarlo de
// useDatabaseStatus() -> ReferenceError al pulsar "Cerrar aviso".

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const setDbFallbackBanner = vi.fn();

vi.mock('react-redux', () => ({
  useSelector: (selector) => selector({ recording: { isRecording: false } }),
  useDispatch: () => vi.fn(),
}));

vi.mock('../store/recordingSlice', () => ({ startRecording: vi.fn() }));

vi.mock('../hooks/useAutoAnalyze', () => ({ default: vi.fn() }));
vi.mock('../hooks/useAppearance', () => ({ default: vi.fn() }));
vi.mock('../hooks/useDatabaseStatus', () => ({
  default: () => ({ dbFallbackBanner: true, setDbFallbackBanner }),
}));
vi.mock('../hooks/useQueueManager', () => ({
  default: () => ({ queueCount: 0, queueState: {}, loadQueueData: vi.fn() }),
}));
vi.mock('../hooks/useDownloadManager', () => ({ default: () => ({ visible: false }) }));
vi.mock('../hooks/useNotificationHandler', () => ({ default: vi.fn() }));
vi.mock('../hooks/useMicrophoneActivation', () => ({ default: vi.fn() }));
vi.mock('../hooks/useNavigation', () => ({
  default: () => ({
    currentView: 'home',
    setCurrentView: vi.fn(),
    handleOpenSettings: vi.fn(),
    navigateTo: vi.fn(),
    handleBack: vi.fn(),
  }),
}));
vi.mock('../hooks/useSession', () => ({
  default: () => ({
    appSettings: {},
    showWhatsNew: false,
    setShowWhatsNew: vi.fn(),
    loadAppSettings: vi.fn(),
  }),
}));

vi.mock('../services/audioService', () => ({
  MixedAudioRecorder: vi.fn(),
  getSystemMicrophones: vi.fn(),
}));
vi.mock('../services/settingsService', () => ({ getSettings: vi.fn() }));

vi.mock('../components/WhatsNewModal/WhatsNewModal', () => ({ default: () => null }));
vi.mock('../pages/Home/Home', () => ({ default: () => null }));
vi.mock('../pages/RecordingDetail/RecordingDetailWithTranscription', () => ({ default: () => null }));
vi.mock('../pages/Settings/Settings', () => ({ default: () => null }));
vi.mock('../pages/Projects/Projects', () => ({ default: () => null }));
vi.mock('../pages/ProjectDetail/ProjectDetail', () => ({ default: () => null }));
vi.mock('../pages/TranscriptionQueue/TranscriptionQueue', () => ({ default: () => null }));
vi.mock('../pages/AiQueue/AiQueue', () => ({ default: () => null }));
vi.mock('../pages/Speakers/SpeakersPage', () => ({ default: () => null }));
vi.mock('../pages/Speakers/SpeakerDetail', () => ({ default: () => null }));
vi.mock('../components/RecordingOverlay/RecordingOverlay', () => ({ default: () => null }));
vi.mock('../components/DownloadIndicator/DownloadIndicator', () => ({ default: () => null }));
vi.mock('../components/BottomLeftStack/BottomLeftStack', () => ({ default: () => null }));
vi.mock('../components/Sidebar/Sidebar', () => ({ default: () => null }));
vi.mock('../pages/Onboarding/Onboarding', () => ({ default: () => null }));

import App from '../App';

describe('App — aviso de BD en modo fallback (#170)', () => {
  let container;
  let root;
  let windowErrors;
  const onWindowError = (event) => {
    windowErrors.push(event.error || event.message);
    event.preventDefault();
  };

  beforeEach(() => {
    setDbFallbackBanner.mockReset();
    windowErrors = [];
    window.addEventListener('error', onWindowError);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    window.removeEventListener('error', onWindowError);
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('pulsar "Cerrar aviso" oculta el banner con setDbFallbackBanner(false) y no lanza ReferenceError', async () => {
    await act(async () => {
      root.render(<App />);
    });

    const closeButton = container.querySelector('button[aria-label="Cerrar aviso"]');
    expect(closeButton).not.toBeNull();

    await act(async () => {
      closeButton.click();
    });

    expect(windowErrors.map(String).join('\n')).not.toMatch(/setDbFallbackBanner is not defined/);
    expect(setDbFallbackBanner).toHaveBeenCalledWith(false);
  });
});
