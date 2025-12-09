import React from 'react';
import { useSelector } from 'react-redux';
import RecordingList from '../../components/RecordingList/RecordingList';
import RecordButton from '../../components/RecordButton/RecordButton';
import { useRef } from 'react';

export default function Home({ onSettings, onProjects, onRecordingStart, onRecordingSelect, onNavigateToProject }) {
  const { isRecording } = useSelector((state) => state.recording);
  const recordingListRef = useRef();

  return (
    <div
      className="flex min-h-screen flex-col bg-[#221112] w-full"
      style={{ fontFamily: '"Plus Jakarta Sans", "Noto Sans", sans-serif' }}
    >
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-b-[#472426] px-10 py-4">
        <div className="flex items-center gap-4 text-white">
          <div className="size-5">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M4 42.4379C4 42.4379 14.0962 36.0744 24 41.1692C35.0664 46.8624 44 42.2078 44 42.2078L44 7.01134C44 7.01134 35.068 11.6577 24.0031 5.96913C14.0971 0.876274 4 7.27094 4 7.27094L4 42.4379Z"
                fill="currentColor"
              ></path>
            </svg>
          </div>
          <h2 className="text-white text-xl font-bold leading-tight tracking-[-0.015em]">VoiceNote</h2>
        </div>
        <div className="flex flex-1 justify-end gap-4">
          <button
            onClick={onProjects}
            className="flex cursor-pointer items-center justify-center overflow-hidden rounded-xl h-10 bg-[#472426] text-white gap-2 text-sm font-semibold leading-normal tracking-[0.015em] px-4 transition-all hover:bg-[#663336]"
          >
            <div className="text-white" data-icon="FolderOpen" data-size="20px" data-weight="regular">
              <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" fill="currentColor" viewBox="0 0 256 256">
                <path d="M245,110.64A16,16,0,0,0,232,104H216V88a16,16,0,0,0-16-16H130.67L102.94,51.2a16.14,16.14,0,0,0-9.6-3.2H40A16,16,0,0,0,24,64V208h0a8,8,0,0,0,8,8H211.1a8,8,0,0,0,7.59-5.47l28.49-85.47A16.05,16.05,0,0,0,245,110.64ZM93.34,64l27.73,20.8a16.12,16.12,0,0,0,9.6,3.2H200v16H69.77a16,16,0,0,0-15.18,10.94L40,158.7V64Zm112,136H43.1l26.67-80H232Z"></path>
              </svg>
            </div>
            <span>Proyectos</span>
          </button>
          <button
            onClick={onSettings}
            className="flex cursor-pointer items-center justify-center overflow-hidden rounded-xl h-10 bg-[#e92932] text-white gap-2 text-sm font-semibold leading-normal tracking-[0.015em] px-4 transition-all hover:bg-[#d41f27]"
          >
            <div className="text-white" data-icon="Gear" data-size="20px" data-weight="regular">
              <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" fill="currentColor" viewBox="0 0 256 256">
                <path d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm88-29.84q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.6,107.6,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3.06-3.05L221.38,40.5a8,8,0,0,0-3.93-6,107.8,107.8,0,0,0-26.25-10.87,8,8,0,0,0-7.06,1.49L165.5,40.87q-2.16-.06-4.32,0L142.54,26.95a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,109.23,36.35a8,8,0,0,0-3.93,6L102.66,66.09q-1.56,1.49-3.05,3.06L75.85,66.38a8,8,0,0,0-6,3.93,107.8,107.8,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L74.13,122.5q-.06,2.16,0,4.32L59.21,145.46a8,8,0,0,0-1.48,7.06,107.6,107.6,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.48,1.56,3.06,3.05L98.62,215.5a8,8,0,0,0,3.93,6,107.8,107.8,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L154.5,215.13q2.16.06,4.32,0l18.64,13.92a8,8,0,0,0,7.06,1.48,107.6,107.6,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3.05-3.06L247.15,189.62a8,8,0,0,0,6-3.93,107.8,107.8,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06ZM128,208a80,80,0,1,1,80-80A80.09,80.09,0,0,1,128,208Z"></path>
              </svg>
            </div>
          </button>
        </div>
      </header>
      <main className="flex flex-col flex-1 p-8 items-center">
        <div className="w-full max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-white text-5xl font-bold mb-4 tracking-tight">Graba tus Reuniones</h1>
            <p className="text-[#cbbebe] text-lg max-w-2xl mx-auto">
              Captura cada detalle de tus conversaciones y obtén transcripciones instantáneas.
              <br />
              Concéntrate en la conversación, nosotros nos encargamos de las notas.
            </p>
          </div>

          <div className="mb-16 flex justify-center">
            <RecordButton onRecordingStart={onRecordingStart} />
          </div>

          <div className="w-full">
            <RecordingList
              onRecordingSelect={onRecordingSelect}
              onNavigateToProject={onNavigateToProject}
            />
          </div>
        </div>
      </main>
    </div>
  );
} 