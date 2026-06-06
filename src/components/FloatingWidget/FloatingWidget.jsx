import { useState, useEffect } from 'react';
import { MdStop, MdMic, MdMicOff, MdKeyboardArrowDown, MdDeleteOutline } from 'react-icons/md';
import styles from './FloatingWidget.module.css';

const FloatingWidget = () => {
  const params = new URLSearchParams(window.location.search);
  const initialElapsed = parseInt(params.get('elapsed') || '0', 10);
  const initialMuted = params.get('muted') === '1';

  const [time, setTime] = useState(initialElapsed);
  const [isMuted, setIsMuted] = useState(initialMuted);

  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    document.getElementById('root').style.background = 'transparent';
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTime(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync mute state from main window (source of truth)
  useEffect(() => {
    if (!window.electronAPI?.onMuteStateChanged) return;
    return window.electronAPI.onMuteStateChanged((muted) => setIsMuted(muted));
  }, []);

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  const handleToggleMute = (e) => {
    e.stopPropagation();
    setIsMuted(prev => !prev); // optimistic — synced back via onMuteStateChanged
    window.electronAPI?.floatingToggleMute();
  };

  const handleStop = (e) => {
    e.stopPropagation();
    window.electronAPI?.floatingStopRecording();
  };

  const handleDiscard = (e) => {
    e.stopPropagation();
    window.electronAPI?.floatingDiscardRecording();
  };

  const handleCollapse = (e) => {
    e.stopPropagation();
    window.electronAPI?.hideFloatingWindow();
  };

  return (
    <div className={styles.widget}>
      <div className={styles.dragZone} />
      <div className={styles.dot} />
      <span className={styles.time}>{formatTime(time)}</span>
      <button
        className={`${styles.btn} ${isMuted ? styles.btnMuted : ''}`}
        onClick={handleToggleMute}
        title={isMuted ? 'Activar micrófono' : 'Silenciar'}
      >
        {isMuted ? <MdMicOff size={14} /> : <MdMic size={14} />}
      </button>
      <button className={`${styles.btn} ${styles.btnDiscard}`} onClick={handleDiscard} title="Descartar grabación">
        <MdDeleteOutline size={14} />
      </button>
      <button className={`${styles.btn} ${styles.btnStop}`} onClick={handleStop} title="Detener y guardar">
        <MdStop size={15} />
      </button>
      <button className={`${styles.btn} ${styles.btnCollapse}`} onClick={handleCollapse} title="Ocultar widget">
        <MdKeyboardArrowDown size={16} />
      </button>
    </div>
  );
};

export default FloatingWidget;
