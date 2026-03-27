import { createSlice } from '@reduxjs/toolkit';

/**
 * Estado global de descargas/instalaciones activas.
 * Cada ítem: { id, name, phase, percent, detail, status, cancellable }
 *   status: 'downloading' | 'done' | 'error'
 */
const downloadsSlice = createSlice({
  name: 'downloads',
  initialState: {
    items: [],
  },
  reducers: {
    addDownload: (state, action) => {
      const exists = state.items.find(i => i.id === action.payload.id);
      if (!exists) {
        state.items.push({
          id: action.payload.id,
          name: action.payload.name,
          phase: action.payload.phase || '',
          percent: 0,
          detail: '',
          status: 'downloading',
          cancellable: action.payload.cancellable ?? false,
        });
      }
    },
    updateDownload: (state, action) => {
      const item = state.items.find(i => i.id === action.payload.id);
      if (item) {
        if (action.payload.phase !== undefined) item.phase = action.payload.phase;
        if (action.payload.percent !== undefined) item.percent = action.payload.percent;
        if (action.payload.detail !== undefined) item.detail = action.payload.detail;
        if (action.payload.status !== undefined) item.status = action.payload.status;
      }
    },
    removeDownload: (state, action) => {
      state.items = state.items.filter(i => i.id !== action.payload);
    },
  },
});

export const { addDownload, updateDownload, removeDownload } = downloadsSlice.actions;
export default downloadsSlice.reducer;
