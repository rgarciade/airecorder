import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import recordingReducer from '../../../store/recordingSlice.js';
import speakersReducer from '../../../store/slices/speakersSlice.js';
import wikiReducer from '../../../store/slices/wikiSlice.js';
import ProjectDetail from '../../../pages/ProjectDetail/ProjectDetail.jsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'es' },
  }),
}));

vi.mock('@uiw/react-md-editor', () => ({
  default: ({ value }) => React.createElement('div', null, value || ''),
}));

function makeStore(preloadedState = {}) {
  return configureStore({
    reducer: {
      recording: recordingReducer,
      speakers: speakersReducer,
      wiki: wikiReducer,
    },
    preloadedState,
  });
}

describe('ProjectDetail wiki integration', () => {
  it('renderiza pestaña wiki en la navegación del detalle', () => {
    const store = makeStore({
      wiki: {
        pagesByProject: {
          1: [
            { id: 1, project_id: 1, title: 'A', content_md: '' },
            { id: 2, project_id: 1, title: 'B', content_md: '' },
          ],
        },
        currentPage: null,
        isLoading: false,
        isGenerating: false,
        error: null,
      },
    });

    const html = renderToStaticMarkup(
      <Provider store={store}>
        <ProjectDetail project={{ id: 1, name: 'Proyecto Wiki' }} onBack={() => {}} onNavigateToRecording={() => {}} />
      </Provider>
    );

    expect(html).toContain('projects.wiki.tab');
  });
});
