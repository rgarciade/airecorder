import React, { useState, useEffect, useRef, useMemo } from 'react';
import styles from './TranscriptionViewer.module.css';

/**
 * Componente para mostrar transcripciones en formato de conversación
 * Micrófono a la izquierda, Sistema a la derecha
 */
export default function TranscriptionViewer({ 
  transcription, 
  loading = false, 
  error = null,
  searchTerm = '',
  currentMatchIndex = 0,
  onMatchesFound = () => {} 
}) {
  const activeHighlightRef = useRef(null);

  // Calcular coincidencias de búsqueda
  const matches = useMemo(() => {
    if (!transcription?.segments || !searchTerm || searchTerm.trim() === '') return [];
    
    const allMatches = [];
    // Escape regex characters
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTerm, 'gi');

    transcription.segments.forEach((segment, segIdx) => {
      let match;
      // Reset lastIndex because we are reusing the regex object? No, creating new one is safer or reset it.
      // RegExp with 'g' flag keeps state.
      // But creating new RegExp inside useMemo is fine.
      
      // However, loop needs to handle overlapping or ensure global reset.
      // Simpler: iterate through matches.
      while ((match = regex.exec(segment.text)) !== null) {
        allMatches.push({
          segmentIndex: segIdx,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          text: match[0]
        });
      }
    });
    return allMatches;
  }, [transcription, searchTerm]);

  // Notificar al padre sobre el número de coincidencias
  useEffect(() => {
    onMatchesFound(matches.length);
  }, [matches.length, onMatchesFound]);

  // Scroll a la coincidencia activa
  useEffect(() => {
    if (matches.length > 0 && activeHighlightRef.current) {
      activeHighlightRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentMatchIndex, matches]);

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

  // Helper para normalizar el origen del audio
  const isMicrophone = (source) => {
    if (!source) return false;
    return source.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === 'microfono';
  };

  const getSourceClass = (source) => {
    return isMicrophone(source) ? styles.microphone : styles.system;
  };

  // Función para renderizar texto con resaltado
  const renderHighlightedText = (text, segIdx) => {
    if (!searchTerm || searchTerm.trim() === '') return text;

    // Filtrar coincidencias para este segmento
    const segmentMatches = matches
      .map((m, i) => ({ ...m, globalIndex: i }))
      .filter(m => m.segmentIndex === segIdx);

    if (segmentMatches.length === 0) return text;

    const parts = [];
    let lastIndex = 0;

    segmentMatches.forEach((match) => {
      // Texto antes de la coincidencia
      if (match.startIndex > lastIndex) {
        parts.push(text.substring(lastIndex, match.startIndex));
      }
      
      const isActive = match.globalIndex === currentMatchIndex;
      
      // Coincidencia resaltada
      parts.push(
        <span 
          key={`match-${match.globalIndex}`}
          className={`${styles.highlight} ${isActive ? styles.activeHighlight : ''}`}
          ref={isActive ? activeHighlightRef : null}
        >
          {text.substring(match.startIndex, match.endIndex)}
        </span>
      );
      
      lastIndex = match.endIndex;
    });

    // Texto restante
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>📝 Transcripción de la conversación</h2>
        <div className={styles.stats}>
          <span className={styles.stat}>
            🎤 {segments.filter(s => isMicrophone(s.source)).length} intervenciones
          </span>
          <span className={styles.stat}>
            🔊 {segments.filter(s => !isMicrophone(s.source)).length} intervenciones
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
            className={`${styles.message} ${getSourceClass(segment.source)}`}
          >
            <div className={styles.messageHeader}>
              <span className={styles.speaker}>
                {segment.speaker}
              </span>
              <span className={styles.timestamp}>
                {formatTimestamp(segment.start)}
              </span>
            </div>
            <div className={styles.messageText}>
              {renderHighlightedText(segment.text, index)}
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
