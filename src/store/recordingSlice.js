import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isRecording: false,
  isPaused: false,
  duration: 0,
  audioLevel: 0, // 0 a 100 para la animación de las barras
  showSaveDialog: false,
  recordingName: '',
};

export const recordingSlice = createSlice({
  name: 'recording',
  initialState,
  reducers: {
    startRecording: (state) => {
      state.isRecording = true;
      state.isPaused = false;
      state.duration = 0;
      state.showSaveDialog = false;
      state.recordingName = '';
    },
    pauseRecording: (state) => {
      state.isPaused = true;
    },
    resumeRecording: (state) => {
      state.isPaused = false;
    },
    showSaveDialog: (state) => {
      state.showSaveDialog = true;
    },
    hideSaveDialog: (state) => {
      state.showSaveDialog = false;
    },
    saveAndExit: (state, action) => {
      state.recordingName = action.payload;
      state.isRecording = false;
      state.isPaused = false;
      state.duration = 0;
      state.audioLevel = 0;
      state.showSaveDialog = false;
    },
    updateDuration: (state, action) => {
      state.duration = action.payload;
    },
    updateAudioLevel: (state, action) => {
      state.audioLevel = action.payload;
    },
  },
});

export const {
  startRecording,
  pauseRecording,
  resumeRecording,
  showSaveDialog,
  hideSaveDialog,
  saveAndExit,
  updateDuration,
  updateAudioLevel,
} = recordingSlice.actions;

export default recordingSlice.reducer; 