import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import styles from './AudioPlayer.module.css';
import { Howl } from 'howler';
import { 
  MdPlayArrow, 
  MdPause, 
  MdReplay10, 
  MdForward10,
  MdKeyboardArrowDown,
  MdMic,
  MdMicOff,
  MdDesktopWindows,
  MdVolumeOff
} from 'react-icons/md';

const AudioPlayer = forwardRef(({ 
  micAudioUrl, 
  sysAudioUrl, 
  duration = 0,
  transcriptionDuration = 0,
  onTimeUpdate
}, ref) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  
  // Track Mute States
  const [micMuted, setMicMuted] = useState(false);
  const [sysMuted, setSysMuted] = useState(true); // System audio muted by default

  // Howler instances
  const micHowl = useRef(null);
  const sysHowl = useRef(null);
  const progressInterval = useRef(null);

  // Internal duration state
  const [loadedDuration, setLoadedDuration] = useState(0);
  // Use the maximum of prop duration (DB), loaded duration (Metadata), and transcription duration
  const effectiveDuration = Math.max(
    Number(duration) || 0, 
    Number(loadedDuration) || 0, 
    Number(transcriptionDuration) || 0
  );

  // Initialize Howls
  useEffect(() => {
    // Cleanup previous instances
    if (micHowl.current) micHowl.current.unload();
    if (sysHowl.current) sysHowl.current.unload();

    if (micAudioUrl) {
      micHowl.current = new Howl({
        src: [micAudioUrl],
        html5: true, // Force HTML5 Audio
        mute: micMuted,
        onload: () => {
          const dur = micHowl.current.duration();
          if (dur && isFinite(dur) && dur > 0) {
            setLoadedDuration(dur);
          }
        },
        onplay: () => {
          setIsPlaying(true);
          startProgressLoop();
          // Sync and play system audio
          if (sysHowl.current) {
            const currentSeek = micHowl.current.seek();
            // Ensure seek returns number
            const t = typeof currentSeek === 'number' ? currentSeek : 0;
            
            // Only sync if significant drift or stopped
            if (!sysHowl.current.playing() || Math.abs(sysHowl.current.seek() - t) > 0.2) {
               sysHowl.current.seek(t);
               sysHowl.current.play();
            }
          }
        },
        onpause: () => {
          setIsPlaying(false);
          stopProgressLoop();
          sysHowl.current?.pause();
        },
        onstop: () => {
          setIsPlaying(false);
          stopProgressLoop();
          sysHowl.current?.stop();
        },
        onend: () => {
          setIsPlaying(false);
          stopProgressLoop();
          sysHowl.current?.stop();
        },
        onseek: () => {
           // Sync seek
           const seekVal = micHowl.current.seek();
           const t = typeof seekVal === 'number' ? seekVal : 0;
           sysHowl.current?.seek(t);
           setCurrentTime(t); // Update UI immediately
        },
        onloaderror: (id, error) => {
          console.error('Error loading microphone audio:', error);
        }
      });
    }

    if (sysAudioUrl) {
      sysHowl.current = new Howl({
        src: [sysAudioUrl],
        html5: true,
        mute: sysMuted,
        onloaderror: (id, error) => {
          console.error('Error loading system audio:', error);
        }
      });
    }

    return () => {
      if (micHowl.current) micHowl.current.unload();
      if (sysHowl.current) sysHowl.current.unload();
      stopProgressLoop();
    };
  }, [micAudioUrl, sysAudioUrl]);

  // Handle Mute Changes
  useEffect(() => {
    if (micHowl.current) micHowl.current.mute(micMuted);
  }, [micMuted]);

  useEffect(() => {
    if (sysHowl.current) sysHowl.current.mute(sysMuted);
  }, [sysMuted]);

  // Progress Loop
  const startProgressLoop = () => {
    stopProgressLoop();
    progressInterval.current = requestAnimationFrame(updateProgress);
  };

  const stopProgressLoop = () => {
    if (progressInterval.current) {
      cancelAnimationFrame(progressInterval.current);
      progressInterval.current = null;
    }
  };

  const updateProgress = () => {
    if (micHowl.current && micHowl.current.playing()) {
      const seek = micHowl.current.seek();
      const time = typeof seek === 'number' ? seek : 0;
      setCurrentTime(time);
      if (onTimeUpdate) onTimeUpdate(time);
    }
    progressInterval.current = requestAnimationFrame(updateProgress);
  };

  // Play/Pause
  const togglePlay = () => {
    if (!micHowl.current) return;
    
    if (isPlaying) {
      micHowl.current.pause();
    } else {
      micHowl.current.play();
    }
  };

  const handleSeekChange = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    
    if (micHowl.current) {
      micHowl.current.seek(newTime);
      // Sys seek handled by onseek event of micHowl
    }
    
    if (onTimeUpdate) onTimeUpdate(newTime);
  };

  const handleSkip = (seconds) => {
    const newTime = Math.min(Math.max(currentTime + seconds, 0), effectiveDuration);
    setCurrentTime(newTime);
    if (micHowl.current) {
      micHowl.current.seek(newTime);
    }
    if (onTimeUpdate) onTimeUpdate(newTime);
  };

  const changeSpeed = (speed) => {
    setPlaybackSpeed(speed);
    if (micHowl.current) micHowl.current.rate(speed);
    if (sysHowl.current) sysHowl.current.rate(speed);
    setShowSpeedMenu(false);
  };

  // Expose methods
  useImperativeHandle(ref, () => ({
    seekTo: (time) => {
      const newTime = Math.min(Math.max(time, 0), effectiveDuration);
      setCurrentTime(newTime);
      if (micHowl.current) {
        micHowl.current.seek(newTime);
        if (!isPlaying) {
           // If paused, ensure system audio is also synced explicitly 
           // (onseek might fire, but just in case)
           sysHowl.current?.seek(newTime);
        }
      }
      if (onTimeUpdate) onTimeUpdate(newTime);
    },
    play: () => {
      if (!isPlaying && micHowl.current) micHowl.current.play();
    },
    pause: () => {
      if (isPlaying && micHowl.current) micHowl.current.pause();
    }
  }));

  const formatTime = (time) => {
    if (!isFinite(time) || isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercent = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  return (
    <div className={styles.container}>
      {/* Progress Bar */}
      <input
        type="range"
        min="0"
        max={effectiveDuration || 100}
        step="0.01"
        value={currentTime}
        onChange={handleSeekChange}
        className={styles.progressBar}
        style={{
          background: `linear-gradient(to right, #3994EF 0%, #3994EF ${progressPercent}%, #E5E7EB ${progressPercent}%, #E5E7EB 100%)`
        }}
      />

      {/* Controls */}
      <div className={styles.bottomControls}>
        <div className={styles.leftControls}>
          <div className={styles.muteControls}>
            {micAudioUrl && (
              <button 
                className={`${styles.muteBtn} ${micMuted ? styles.muted : ''}`}
                onClick={() => setMicMuted(!micMuted)}
                title={micMuted ? "Unmute Microphone" : "Mute Microphone"}
              >
                {micMuted ? <MdMicOff size={16} /> : <MdMic size={16} />}
              </button>
            )}
            {sysAudioUrl && (
              <button 
                className={`${styles.muteBtn} ${sysMuted ? styles.muted : ''}`}
                onClick={() => setSysMuted(!sysMuted)}
                title={sysMuted ? "Enable System Audio" : "Disable System Audio"}
              >
                {sysMuted ? <MdVolumeOff size={16} /> : <MdDesktopWindows size={16} />}
              </button>
            )}
          </div>
          <div className={styles.timeDisplay}>
            {formatTime(currentTime)} <span className={styles.totalTime}>/ {formatTime(effectiveDuration)}</span>
          </div>
        </div>

        <div className={styles.mainControls}>
          <button className={styles.controlBtn} onClick={() => handleSkip(-10)}>
            <MdReplay10 size={24} />
          </button>

          <button className={`${styles.controlBtn} ${styles.playBtn}`} onClick={togglePlay}>
            {isPlaying ? <MdPause size={28} /> : <MdPlayArrow size={28} />}
          </button>

          <button className={styles.controlBtn} onClick={() => handleSkip(10)}>
            <MdForward10 size={24} />
          </button>
        </div>

        <div className={styles.speedSelector}>
          <button 
            className={styles.speedBtn}
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
          >
            {playbackSpeed}x
            <MdKeyboardArrowDown size={16} />
          </button>
          
          {showSpeedMenu && (
            <div className={styles.speedMenu}>
              {[0.5, 1, 1.2, 1.5, 2].map(speed => (
                <button 
                  key={speed} 
                  className={`${styles.speedOption} ${playbackSpeed === speed ? styles.active : ''}`}
                  onClick={() => changeSpeed(speed)}
                >
                  {speed}x
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default AudioPlayer;
