import React from 'react';
import styles from './TranscriptionViewer.module.css';

/**
 * Componente para mostrar transcripciones en formato de conversación
 * Micrófono a la izquierda, Sistema a la derecha
 */
export default function TranscriptionViewer({ transcription, loading = false, error = null }) {
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Cargando transcripción...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h3>Error al cargar transcripción</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!transcription || !transcription.segments || transcription.segments.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.noTranscription}>
          <h3>📝 Sin transcripción disponible</h3>
          <p>Esta grabación no tiene una transcripción procesada.</p>
          <p>Utiliza el script de análisis de audio para generar la transcripción.</p>
        </div>
      </div>
    );
  }

  const { segments } = transcription;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>📝 Transcripción de la conversación</h2>
        <div className={styles.stats}>
          <span className={styles.stat}>
            🎤 {segments.filter(s => s.source === 'micrófono').length} intervenciones
          </span>
          <span className={styles.stat}>
            🔊 {segments.filter(s => s.source === 'sistema').length} intervenciones
          </span>
          <span className={styles.stat}>
            ⏱️ {transcription.metadata?.total_duration ? 
              `${Math.floor(transcription.metadata.total_duration / 60)}:${Math.floor(transcription.metadata.total_duration % 60).toString().padStart(2, '0')}` 
              : 'N/A'}
          </span>
        </div>
      </div>

      <div className={styles.conversation}>
        {segments.map((segment, index) => (
          <div 
            key={`${segment.start}-${segment.source}-${index}`}
            className={`${styles.message} ${segment.source === 'micrófono' ? styles.microphone : styles.system}`}
          >
            <div className={styles.messageHeader}>
              <span className={styles.speaker}>
                {segment.emoji} {segment.speaker}
              </span>
              <span className={styles.timestamp}>
                {formatTimestamp(segment.start)}
              </span>
            </div>
            <div className={styles.messageText}>
              {segment.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Formatea un timestamp en segundos a formato MM:SS
 */
function formatTimestamp(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
} 