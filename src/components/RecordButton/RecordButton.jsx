import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import { startRecording } from '../../store/recordingSlice';
import { MixedAudioRecorder, getSystemMicrophones } from '../../services/audioService';
import { getSettings } from '../../services/settingsService';
import styles from './RecordButton.module.css';

export default function RecordButton({ onRecordingStart }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { isRecording } = useSelector((state) => state.recording);

  const [selectedMicrophone, setSelectedMicrophone] = useState('');
  const [error, setError] = useState(null);
  const [audioDevices, setAudioDevices] = useState([]);

  // Cargar configuración y dispositivos al inicializar
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // Cargar dispositivos de audio
      const devices = await getSystemMicrophones();
      setAudioDevices(devices);

      // Cargar configuración guardada
      const settings = await getSettings();
      if (settings && settings.microphone) {
        setSelectedMicrophone(settings.microphone);
      } else if (devices.length > 0) {
        setSelectedMicrophone(devices[0].value);
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
      setError(t('recordButton.errorLoadingConfig'));
    }
  };

  const handleStartRecording = async () => {
    if (isRecording) {
      return;
    }

    if (!selectedMicrophone) {
      setError(t('recordButton.errorNoMic'));
      return;
    }

    try {
      setError(null);

      const recorder = new MixedAudioRecorder();
      await recorder.startMixedRecording(selectedMicrophone, null);

      dispatch(startRecording());

      if (onRecordingStart) {
        onRecordingStart(recorder);
      }

      console.log('Grabación mezclada iniciada');

    } catch (err) {
      console.error('Error al iniciar grabación:', err);
      setError(t('recordButton.errorStarting', { error: err.message }));
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <button
          onClick={handleStartRecording}
          className={`${styles.recordButton} ${styles.start}`}
          disabled={!selectedMicrophone || isRecording}
        >
          <div className={styles.recordIcon}></div>
          <span>{isRecording ? t('recordButton.recording') : t('recordButton.startRecording')}</span>
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}
    </div>
  );
}
