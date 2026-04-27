import { configureStore } from '@reduxjs/toolkit';
import recordingReducer from './recordingSlice';
import speakersReducer from './slices/speakersSlice';

export const store = configureStore({
  reducer: {
    recording: recordingReducer,
    speakers: speakersReducer,
  },
}); 