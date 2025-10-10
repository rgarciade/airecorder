import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { startRecording } from '../../store/recordingSlice';
import { MixedAudioRecorder, getSystemMicrophones } from '../../services/audioService';
import { getSettings } from '../../services/settingsService';
import styles from './RecordButton.module.css';

export default function RecordButton({ onRecordingStart }) {
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
      setError('Error al cargar la configuración');
    }
  };

  const handleStartRecording = async () => {
    if (isRecording) {
      return; // Ya está grabando, no hacer nada
    }

    if (!selectedMicrophone) {
      setError('Por favor selecciona un micrófono en configuración');
      return;
    }

    try {
      setError(null);
      
      // Crear nuevo grabador mezclado
      const recorder = new MixedAudioRecorder();

      // Iniciar grabación mezclada (sin duración fija, se detiene manualmente)
      await recorder.startMixedRecording(selectedMicrophone, null);
      
      // Actualizar estado de Redux
      dispatch(startRecording());
      
      // Notificar al componente padre que se inició la grabación
      if (onRecordingStart) {
        onRecordingStart(recorder);
      }
      
      console.log('Grabación mezclada iniciada');

    } catch (err) {
      console.error('Error al iniciar grabación:', err);
      setError('Error al iniciar la grabación: ' + err.message);
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
          <span>{isRecording ? 'Grabando...' : 'Iniciar Grabación'}</span>
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