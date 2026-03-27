import { configureStore } from '@reduxjs/toolkit';
import recordingReducer from './recordingSlice';
import downloadsReducer from './downloadsSlice';

export const store = configureStore({
  reducer: {
    recording: recordingReducer,
    downloads: downloadsReducer,
  },
}); 