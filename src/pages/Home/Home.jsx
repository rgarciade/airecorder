import React from 'react';
import { useSelector } from 'react-redux';
import RecordingList from '../../components/RecordingList/RecordingList';
import RecordButton from '../../components/RecordButton/RecordButton';

export default function Home({ onSettings, onRecordingStart, onRecordingSelect }) {
  const { isRecording } = useSelector((state) => state.recording);

  return (
    <div
      className="flex min-h-screen flex-col bg-[#221112] w-full"
      style={{ fontFamily: '"Plus Jakarta Sans", "Noto Sans", sans-serif' }}
    >
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-b-[#472426] px-10 py-3">
        <div className="flex items-center gap-4 text-white">
          <div className="size-4">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M4 42.4379C4 42.4379 14.0962 36.0744 24 41.1692C35.0664 46.8624 44 42.2078 44 42.2078L44 7.01134C44 7.01134 35.068 11.6577 24.0031 5.96913C14.0971 0.876274 4 7.27094 4 7.27094L4 42.4379Z"
                fill="currentColor"
              ></path>
            </svg>
          </div>
          <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">VoiceNote</h2>
        </div>
        <div className="flex flex-1 justify-end gap-8">
          <button
            onClick={onSettings}
            className="flex max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-xl h-10 bg-[#e92932] text-white gap-2 text-sm font-bold leading-normal tracking-[0.015em] min-w-0 px-2.5"
          >
            <div className="text-white" data-icon="Gear" data-size="20px" data-weight="regular">
              <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" fill="currentColor" viewBox="0 0 256 256">
                <path d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm88-29.84q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.6,107.6,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3.06-3.05L221.38,40.5a8,8,0,0,0-3.93-6,107.8,107.8,0,0,0-26.25-10.87,8,8,0,0,0-7.06,1.49L165.5,40.87q-2.16-.06-4.32,0L142.54,26.95a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,109.23,36.35a8,8,0,0,0-3.93,6L102.66,66.09q-1.56,1.49-3.05,3.06L75.85,66.38a8,8,0,0,0-6,3.93,107.8,107.8,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L74.13,122.5q-.06,2.16,0,4.32L59.21,145.46a8,8,0,0,0-1.48,7.06,107.6,107.6,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.48,1.56,3.06,3.05L98.62,215.5a8,8,0,0,0,3.93,6,107.8,107.8,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L154.5,215.13q2.16.06,4.32,0l18.64,13.92a8,8,0,0,0,7.06,1.48,107.6,107.6,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3.05-3.06L247.15,189.62a8,8,0,0,0,6-3.93,107.8,107.8,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06ZM128,208a80,80,0,1,1,80-80A80.09,80.09,0,0,1,128,208Z"></path>
              </svg>
            </div>
          </button>
          <div
            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10"
            style={{
              backgroundImage:
                'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAogyadNUeGL36ivwWfecIbkXtQgBfVQeOlMBPDuo96aaTlM9NBlwpxPPZO8BPgTUK4kU85TvtZesaONhHFtVUv55Put8hqzQgkVFr2GKxPe0Z5_QkH8TSa1aRiTPzYV3PzZ16GuRU0TN3_rt4NooSThdUdWpvMYvFrRgtxoXnIQbQCxqXmVggpEtpXRPCeL0hrP1O8v3JD0eeSEOefzzO8SPQxS_EQ9f_7ecMTpM9T6eL0B5KM9R0OqyJNcKlaK6C8V4qnp3E")',
            }}
          ></div>
        </div>
      </header>
      <main className="flex flex-col items-center justify-center flex-1 p-8">
        <h1 className="text-white text-4xl font-bold mb-8">Record your meetings</h1>
        
        {/* Componente RecordButton simplificado */}
        <div className="mb-12">
          <RecordButton onRecordingStart={onRecordingStart} />
        </div>

        <div className="w-full max-w-2xl flex justify-center">
          <RecordingList onRecordingSelect={onRecordingSelect} />
        </div>
      </main>
    </div>
  );
} 