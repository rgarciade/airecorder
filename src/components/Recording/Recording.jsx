import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  pauseRecording,
  resumeRecording,
  showSaveDialog,
  hideSaveDialog,
  saveAndExit,
  updateDuration,
  updateAudioLevel,
} from '../../store/recordingSlice';

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function Recording() {
  const dispatch = useDispatch();
  const { isPaused, duration, audioLevel, showSaveDialog: isShowingSaveDialog } = useSelector((state) => state.recording);
  const [tempName, setTempName] = useState('');

  // Actualizar duración cada segundo
  useEffect(() => {
    let interval;
    if (!isPaused) {
      interval = setInterval(() => {
        dispatch(updateDuration(duration + 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPaused, duration, dispatch]);

  // Simular detección de audio
  useEffect(() => {
    let interval;
    if (!isPaused) {
      interval = setInterval(() => {
        const randomLevel = Math.floor(Math.random() * 100);
        dispatch(updateAudioLevel(randomLevel));
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPaused, dispatch]);

  const handlePauseClick = () => {
    if (isPaused) {
      dispatch(resumeRecording());
    } else {
      dispatch(pauseRecording());
    }
  };

  const handleFinishClick = () => {
    dispatch(showSaveDialog());
  };

  const handleSaveAndExit = (e) => {
    e.preventDefault();
    if (tempName.trim()) {
      dispatch(saveAndExit(tempName.trim()));
    }
  };

  const handleContinue = () => {
    setTempName('');
    dispatch(hideSaveDialog());
  };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#331a1b] rounded-2xl p-6 shadow-lg min-w-[320px]">
      {isShowingSaveDialog && (
        <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
          <div className="bg-[#472426] p-6 rounded-xl w-full mx-4">
            <form onSubmit={handleSaveAndExit}>
              <p className="text-white mb-4">Dale un nombre a tu grabación</p>
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                placeholder="Ej: Reunión de equipo"
                className="w-full px-4 py-2 rounded-lg bg-[#331a1b] text-white border border-[#663336] focus:border-[#e92932] outline-none mb-4"
                autoFocus
              />
              <div className="flex gap-4 justify-end">
                <button
                  type="button"
                  onClick={handleContinue}
                  className="px-4 py-2 text-[#c89295] hover:text-white transition-colors"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={!tempName.trim()}
                  className="px-4 py-2 bg-[#e92932] text-white rounded-lg hover:bg-[#d41f27] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Guardar y salir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <div className="flex items-center gap-6">
        <div className="flex gap-2">
          <button
            onClick={handlePauseClick}
            className="size-12 rounded-full bg-[#e92932] text-white flex items-center justify-center hover:bg-[#d41f27] transition-colors"
          >
            {isPaused ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
                <path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
                <path d="M216,48V208a16,16,0,0,1-16,16H160a16,16,0,0,1-16-16V48a16,16,0,0,1,16-16h40A16,16,0,0,1,216,48ZM96,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V48A16,16,0,0,0,96,32Z"></path>
              </svg>
            )}
          </button>
          <button
            onClick={handleFinishClick}
            className="size-12 rounded-full bg-[#472426] text-white flex items-center justify-center hover:bg-[#663336] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
              <path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Z"></path>
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-1 h-8 items-end">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-[#472426] rounded-t transition-all duration-100"
                style={{
                  height: `${Math.max(15, (audioLevel / 100) * 100 * Math.random())}%`,
                }}
              ></div>
            ))}
          </div>
          <p className="text-[#c89295] text-sm">{formatTime(duration)}</p>
        </div>
      </div>
    </div>
  );
} 