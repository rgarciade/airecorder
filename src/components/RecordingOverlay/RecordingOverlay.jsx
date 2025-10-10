import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { saveAndExit } from '../../store/recordingSlice';
import styles from './RecordingOverlay.module.css';

const RecordingOverlay = ({ recorder, onFinish }) => {
  const dispatch = useDispatch();
  const [time, setTime] = useState(0);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [fileName, setFileName] = useState('');
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showProcessing, setShowProcessing] = useState(false);
  const [processingComplete, setProcessingComplete] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFinish = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    setFileName(`grabacion_${timestamp}`);
    setShowSaveDialog(true);
  };

  const handleSave = async () => {
    setShowSaveDialog(false);
    setShowProcessing(true);
    
    try {
      // Usar el nuevo método stopAndSave con nombre personalizado
      await recorder.stopAndSave(fileName);
      
      setProcessingComplete(true);
      setTimeout(() => {
        setShowProcessing(false);
        setProcessingComplete(false);
        // Actualizar Redux para cerrar el overlay
        dispatch(saveAndExit(fileName));
        onFinish();
      }, 2000);
    } catch (error) {
      console.error('Error al guardar:', error);
      setShowProcessing(false);
      // Aunque haya error, cerrar el overlay
      dispatch(saveAndExit(''));
      onFinish();
    }
  };

  const handleDiscard = () => {
    setShowDiscardDialog(true);
  };

  const confirmDiscard = () => {
    setShowDiscardDialog(false);
    setIsDiscarding(true);
    setShowProcessing(true);
    
    // Detener la grabación sin guardar
    if (recorder && recorder.stopMixedRecording) {
      recorder.stopMixedRecording();
    }
    
    setTimeout(() => {
      setShowProcessing(false);
      setIsDiscarding(false);
      // Actualizar Redux para cerrar el overlay
      dispatch(saveAndExit(''));
      onFinish();
    }, 1000);
  };

  const generateBars = () => {
    return Array.from({ length: 20 }, (_, i) => (
      <div 
        key={i} 
        className={styles.bar}
        style={{
          animationDelay: `${i * 0.15}s`,
          animationDuration: `${1.5 + (i % 3) * 0.3}s`
        }}
      />
    ));
  };

  return (
    <>
      <div className={styles.overlay}>
        <div className={styles.container}>
          <div className={styles.content}>
            <div className={styles.indicator}></div>
            
            <div className={styles.visualizer}>
              {generateBars()}
            </div>
            
            <div className={styles.time}>
              {formatTime(time)}
            </div>
            
            <div className={styles.controls}>
              <button 
                className={`${styles.button} ${styles.finishButton}`}
                onClick={handleFinish}
                title="Finalizar y guardar"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              </button>
              
              <button 
                className={`${styles.button} ${styles.discardButton}`}
                onClick={handleDiscard}
                title="Descartar grabación"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.3 5.71a.996.996 0 0 0-1.41 0L12 10.59 7.11 5.7A.996.996 0 1 0 5.7 7.11L10.59 12 5.7 16.89a.996.996 0 1 0 1.41 1.41L12 13.41l4.89 4.89a.996.996 0 1 0 1.41-1.41L13.41 12l4.89-4.89c.38-.38.38-1.02 0-1.4z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de guardado */}
      {showSaveDialog && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Guardar Grabación</h3>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="Nombre del archivo"
              className={styles.input}
            />
            <div className={styles.modalButtons}>
              <button 
                onClick={() => setShowSaveDialog(false)}
                className={styles.cancelButton}
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className={styles.saveButton}
                disabled={!fileName.trim()}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de descarte */}
      {showDiscardDialog && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>¿Detener sin guardar?</h3>
            <p>Se perderá la grabación actual.</p>
            <div className={styles.modalButtons}>
              <button 
                onClick={() => setShowDiscardDialog(false)}
                className={styles.cancelButton}
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDiscard}
                className={styles.discardModalButton}
              >
                Sí, detener
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de procesamiento */}
      {showProcessing && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            {processingComplete ? (
              <>
                <div className={styles.checkIcon}>✓</div>
                <p>Archivos guardados correctamente</p>
              </>
            ) : (
              <>
                <div className={styles.spinner}></div>
                <p>{isDiscarding ? 'Deteniendo grabación...' : 'Guardando archivos separados...'}</p>
                <p className={styles.subtitle}>Por favor, no cierres la aplicación</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default RecordingOverlay; 