import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { startRecording } from '../../store/recordingSlice';
import { MixedAudioRecorder, getSystemMicrophones } from '../../services/audioService';
import { getSettings } from '../../services/settingsService';
import recordingsService from '../../services/recordingsService';
import styles from './Home.module.css';

import NewSessionCard from './components/NewSessionCard';
import StatsRow from './components/StatsRow';
import RecordingCard from '../../components/RecordingCard/RecordingCard';

export default function Home({ onSettings, onProjects, onRecordingStart, onRecordingSelect, onNavigateToProject }) {
  const dispatch = useDispatch();
  const { isRecording } = useSelector((state) => state.recording);
  
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Stats
  const [totalTimeStr, setTotalTimeStr] = useState("0h 0m");
  const [totalFiles, setTotalFiles] = useState(0);
  const [savedTimeStr, setSavedTimeStr] = useState("0h 0m"); // Placeholder or estimated

  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    try {
      setLoading(true);
      const list = await recordingsService.getRecordings();
      // Sort by date desc
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
      setRecordings(list);
      
      // Calculate stats
      let totalSeconds = 0;
      list.forEach(r => {
        if (r.duration) totalSeconds += r.duration;
      });
      
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      setTotalTimeStr(`${hours}h ${minutes}m`);
      setTotalFiles(list.length);
      
      // Rough estimate: transcription is 3x faster than listening? Or writing notes takes 2x the recording time?
      // Let's say saved time is equal to recording time (assuming you'd have to listen to it again to take notes)
      setSavedTimeStr(`${hours}h ${minutes}m`); 
      
    } catch (err) {
      console.error("Error loading recordings:", err);
      setError("Failed to load recordings");
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (isRecording) return;

    try {
      // 1. Get Settings/Microphone
      const devices = await getSystemMicrophones();
      const settings = await getSettings();
      
      let selectedMic = '';
      if (settings && settings.microphone) {
        selectedMic = settings.microphone;
      } else if (devices.length > 0) {
        selectedMic = devices[0].value;
      }

      if (!selectedMic) {
        alert('No microphone selected or available. Please check settings.');
        return;
      }

      // 2. Start Recording
      const recorder = new MixedAudioRecorder();
      await recorder.startMixedRecording(selectedMic, null);
      
      dispatch(startRecording());
      
      if (onRecordingStart) {
        onRecordingStart(recorder);
      }
      
    } catch (err) {
      console.error('Error starting recording:', err);
      alert('Failed to start recording: ' + err.message);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.greeting}>Good Morning, User</h1>
          <p className={styles.subtitle}>Ready to capture your next big idea?</p>
        </div>
        <div className={styles.headerActions}>
          <input type="text" placeholder="Search recordings..." className={styles.searchInput} />
          <button className={styles.bellBtn} onClick={onSettings} title="Settings">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </header>

      <NewSessionCard onStart={handleStart} />
      
      <StatsRow 
        totalTime={totalTimeStr} 
        totalFiles={totalFiles} 
        savedTime={savedTimeStr} 
      />
      
      <div className={styles.sectionHeader}>
        <h2>Recent Recordings</h2>
        <button onClick={onProjects}>View Projects</button>
      </div>
      
      {loading && <p>Loading recordings...</p>}
      
      <div className={styles.grid}>
        {recordings.map(rec => (
          <RecordingCard 
            key={rec.id} 
            recording={rec} 
            onClick={onRecordingSelect} 
          />
        ))}
        {!loading && recordings.length === 0 && (
          <p className={styles.noRecordingsMessage}>No recordings yet. Start a new session!</p>
        )}
      </div>
    </div>
  );
}
