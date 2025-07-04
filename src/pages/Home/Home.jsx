import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { startRecording } from '../../store/recordingSlice';

const mockRecordings = [
  { id: 1, name: 'Project Kickoff Meeting', date: 'July 12, 2024' },
  { id: 2, name: 'Design Review', date: 'July 10, 2024' },
  { id: 3, name: 'Team Sync', date: 'July 8, 2024' },
];

export default function Home({ onSettings, onSelectRecording, onTestRecorder }) {
  const dispatch = useDispatch();
  const { isRecording } = useSelector((state) => state.recording);

  const handleRecord = () => {
    if (!isRecording) {
      dispatch(startRecording());
    }
  };

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
            className="flex max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 bg-[#472426] text-white gap-2 text-sm font-bold leading-normal tracking-[0.015em] min-w-0 px-2.5"
          >
            <div className="text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" fill="currentColor" viewBox="0 0 256 256">
                <path d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm88-29.84q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.21,107.21,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.71,107.71,0,0,0-26.25-10.87,8,8,0,0,0-7.06,1.49L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.21,107.21,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06Zm-16.1-6.5a73.93,73.93,0,0,1,0,8.68,8,8,0,0,0,1.74,5.48l14.19,17.73a91.57,91.57,0,0,1-6.23,15L187,173.11a8,8,0,0,0-5.1,2.64,74.11,74.11,0,0,1-6.14,6.14,8,8,0,0,0-2.64,5.1l-2.51,22.58a91.32,91.32,0,0,1-15,6.23l-17.74-14.19a8,8,0,0,0-5-1.75h-.48a73.93,73.93,0,0,1-8.68,0,8,8,0,0,0-5.48,1.74L100.45,215.8a91.57,91.57,0,0,1-15-6.23L82.89,187a8,8,0,0,0-2.64-5.1,74.11,74.11,0,0,1-6.14-6.14,8,8,0,0,0-5.1-2.64L46.43,170.6a91.32,91.32,0,0,1-6.23-15l14.19-17.74a8,8,0,0,0,1.74-5.48,73.93,73.93,0,0,1,0-8.68,8,8,0,0,0-1.74-5.48L40.2,100.45a91.57,91.57,0,0,1,6.23-15L69,82.89a8,8,0,0,0,5.1-2.64,74.11,74.11,0,0,1,6.14-6.14A8,8,0,0,0,82.89,69L85.4,46.43a91.32,91.32,0,0,1,15-6.23l17.74,14.19a8,8,0,0,0,5.48,1.74,73.93,73.93,0,0,1,8.68,0,8,8,0,0,0,5.48-1.74L155.55,40.2a91.57,91.57,0,0,1,15,6.23L173.11,69a8,8,0,0,0,2.64,5.1,74.11,74.11,0,0,1,6.14,6.14,8,8,0,0,0,5.1,2.64l22.58,2.51a91.32,91.32,0,0,1,6.23,15l-14.19,17.74A8,8,0,0,0,199.87,123.66Z"></path>
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
        <button
          onClick={handleRecord}
          className="flex cursor-pointer items-center justify-center overflow-hidden rounded-full h-12 px-5 bg-[#e92932] text-white gap-2 text-base font-bold leading-normal tracking-[0.015em] hover:bg-[#d41f27] transition-colors mb-4"
        >
          <div className="text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256">
              <path d="M128,176a48.05,48.05,0,0,0,48-48V64a48,48,0,0,0-96,0v64A48.05,48.05,0,0,0,128,176ZM96,64a32,32,0,0,1,64,0v64a32,32,0,0,1-64,0Zm40,143.6V232a8,8,0,0,1-16,0V207.6A80.11,80.11,0,0,1,48,128a8,8,0,0,1,16,0,64,64,0,0,0,128,0,8,8,0,0,1,16,0A80.11,80.11,0,0,1,136,207.6Z"></path>
            </svg>
          </div>
          <span className="truncate">{isRecording ? 'Stop Recording' : 'Start Recording'}</span>
        </button>
        <button
          onClick={onTestRecorder}
          className="flex cursor-pointer items-center justify-center overflow-hidden rounded-full h-12 px-5 bg-[#472426] text-white gap-2 text-base font-bold leading-normal tracking-[0.015em] hover:bg-[#663336] transition-colors mb-12"
        >
          <div className="text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256">
              <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm40-68a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,148ZM96,116h64a8,8,0,0,0,0-16H96a8,8,0,0,0,0,16Z"></path>
            </svg>
          </div>
          <span className="truncate">Test Recorder</span>
        </button>
        <div className="w-full max-w-2xl">
          <h2 className="text-white text-2xl font-bold mb-4">Past recordings</h2>
          <div className="space-y-4">
            {mockRecordings.map((recording) => (
              <div
                key={recording.id}
                onClick={() => onSelectRecording(recording)}
                className="flex items-center justify-between bg-[#472426] rounded-xl p-4 cursor-pointer hover:bg-[#663336] transition-colors"
              >
                <div>
                  <h3 className="text-white font-medium">{recording.name}</h3>
                  <p className="text-[#c89295] text-sm">{recording.date}</p>
                </div>
                <button className="text-white hover:text-[#e92932] transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
                    <path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z"></path>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
} 