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
  onMatchesFound = () => {},
  currentTime = -1, // Optional: if provided, highlights the active segment
  onSeek = () => {} // Optional: callback when a segment/timestamp is clicked
}) {
  const activeHighlightRef = useRef(null);
  const activeSegmentRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [userIsScrolling, setUserIsScrolling] = useState(false);

  // Calcular coincidencias de búsqueda
  const matches = useMemo(() => {
    if (!transcription?.segments || !searchTerm || searchTerm.trim() === '') return [];
    
    const allMatches = [];
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTerm, 'gi');

    transcription.segments.forEach((segment, segIdx) => {
      let match;
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

  // Determine active segment index based on currentTime
  const activeSegmentIndex = useMemo(() => {
    if (currentTime < 0 || !transcription?.segments) return -1;
    
    // Use a simple loop for better performance than findIndex if called often
    for (let i = 0; i < transcription.segments.length; i++) {
      const seg = transcription.segments[i];
      const start = Number(seg.start);
      // If we are before this segment, then the PREVIOUS one was the active one? 
      // No, we are looking for the segment containing currentTime.
      
      const nextSeg = transcription.segments[i + 1];
      const end = nextSeg ? Number(nextSeg.start) : (Number(seg.end) || start + 10); // Default duration 10s if last
      
      if (currentTime >= start && currentTime < end) {
        return i;
      }
    }
    return -1;
  }, [currentTime, transcription]);

  // Notificar al padre sobre el número de coincidencias
  useEffect(() => {
    onMatchesFound(matches.length);
  }, [matches.length, onMatchesFound]);

  // Scroll a la coincidencia de búsqueda activa
  useEffect(() => {
    if (matches.length > 0 && activeHighlightRef.current) {
      activeHighlightRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentMatchIndex, matches]);

  // Scroll to active segment during playback (auto-scroll)
  useEffect(() => {
    if (activeSegmentIndex !== -1 && activeSegmentRef.current && !userIsScrolling) {
       activeSegmentRef.current.scrollIntoView({
         behavior: 'smooth',
         block: 'nearest'
       });
    }
  }, [activeSegmentIndex, userIsScrolling]);

  // Detect user scroll to pause auto-scroll temporarily (simple version: click to re-enable?)
  // For now, simpler approach: if user clicks a segment, we assume they want to go there.
  // We won't implement complex "stop auto-scroll on wheel" unless requested.

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

  const handleSegmentClick = (startTime) => {
    onSeek(startTime);
    setUserIsScrolling(false); // Re-enable auto-scroll on click
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
      {/* Header removed as requested, keeping container */}
      
      <div className={styles.conversation} ref={scrollContainerRef}>
        {segments.map((segment, index) => {
          const isActive = index === activeSegmentIndex;
          return (
            <div 
              key={`${segment.start}-${segment.source}-${index}`}
              className={`${styles.message} ${getSourceClass(segment.source)} ${isActive ? styles.activeSegment : ''}`}
              ref={isActive ? activeSegmentRef : null}
              onClick={() => handleSegmentClick(segment.start)}
            >
              <div className={styles.messageHeader}>
                <span className={styles.speaker}>
                  {segment.speaker}
                </span>
                <span 
                  className={`${styles.timestamp} ${isActive ? styles.activeTimestamp : ''}`}
                  title="Click to seek"
                >
                  {formatTimestamp(segment.start)}
                </span>
              </div>
              <div className={styles.messageText}>
                {renderHighlightedText(segment.text, index)}
              </div>
            </div>
          );
        })}
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
