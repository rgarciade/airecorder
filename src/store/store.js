import { configureStore } from '@reduxjs/toolkit';
import recordingReducer from './recordingSlice';
import speakersReducer from './slices/speakersSlice';
import wikiReducer from './slices/wikiSlice';

export const store = configureStore({
  reducer: {
    recording: recordingReducer,
    speakers: speakersReducer,
    wiki: wikiReducer,
  },
}); 
