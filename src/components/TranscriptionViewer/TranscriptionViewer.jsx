import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { clearAliases, initAliases, setAllSpeakers, updateAlias, selectSpeakersMap } from '../../store/slices/speakersSlice';
import SpeakerLabel from './SpeakerLabel';
import MergeSpeakersModal from './MergeSpeakersModal';
import SpeakerSuggestions from './SpeakerSuggestions';
import { hasEditableSpeakerResolution } from './speakerCompatibility.mjs';
import styles from './TranscriptionViewer.module.css';

/**
 * Componente para mostrar transcripciones en formato de conversación.
 * Micrófono a la izquierda, Sistema a la derecha.
 *
 * Integra identificación de hablantes mediante:
 *   - Redux `speakersSlice` para el mapa ephemeralId → alias.
 *   - `SpeakerLabel` para edición inline de nombres.
 *   - `MergeSpeakersModal` para fusionar hablantes.
 *   - IPC `get-all-speakers` al montar para pre-cargar aliases y autocompletado.
 */
export default function TranscriptionViewer({ 
  transcription, 
  loading = false, 
  error = null,
  searchTerm = '',
  currentMatchIndex = 0,
  onMatchesFound = () => {},
  currentTime = -1,
  onSeek = () => {},
  recordingId = null,
  audioSrc = null,
}) {
  const dispatch = useDispatch();
  const speakersMap = useSelector(selectSpeakersMap);

  const activeHighlightRef = useRef(null);
  const activeSegmentRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [userIsScrolling, setUserIsScrolling] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const hasSpeakerResolution = useMemo(
    () => hasEditableSpeakerResolution(transcription?.speakerResolution),
    [transcription?.speakerResolution]
  );

  // ── Cargar speakers de BD al montar ─────────────────────────────────────────

  useEffect(() => {
    async function loadSpeakers() {
      try {
        if (!window.electronAPI?.getAllSpeakers) return;

        const result = await window.electronAPI.getAllSpeakers();
        if (result?.success && Array.isArray(result.data)) {
          dispatch(setAllSpeakers(result.data));
        }
      } catch (err) {
        console.error('[TranscriptionViewer] Error al cargar hablantes:', err);
      }
    }
    loadSpeakers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  // ── Sincronizar speakerResolution cuando llega la transcripción ─────────────
  // Usa initAliases en lugar de setAliases para evitar sobreescribir ediciones
  // del usuario cuando TranscriptionViewer se remonta dentro de la misma grabación
  // (navegación entre tabs con renderizado condicional). initAliases solo reemplaza
  // el mapa completo cuando cambia la grabación; para la misma grabación, solo
  // añade entradas que falten.
  useEffect(() => {
    if (hasSpeakerResolution) {
      dispatch(initAliases({
        recordingId,
        speakerResolution: transcription.speakerResolution,
      }));
      return;
    }

    dispatch(clearAliases());
    setIsMergeModalOpen(false);
  }, [dispatch, hasSpeakerResolution, transcription?.speakerResolution, recordingId]);

  // ── Lista única de ephemeralIds en la transcripción ─────────────────────────

  const uniqueEphemeralIds = useMemo(() => {
    if (!transcription?.segments) return [];
    const ids = new Set(
      transcription.segments
        .map((s) => s.speaker)
        .filter(Boolean)
    );
    return [...ids];
  }, [transcription]);

  // ── Enriquecer pendingSuggestions con datos del speakersMap actual ───────────
  // El backend genera las suggestions con candidateSpeakerId/candidateDisplayName
  // pero no sabe el nombre temporal que Redux asignó al ephemeralId. Lo añadimos aquí.

  const enrichedSuggestions = useMemo(() => {
    const raw = transcription?.speakerResolution?._pendingSuggestions;
    if (!raw?.length) return [];
    return raw.map((s) => ({
      ...s,
      currentSpeakerId: speakersMap[s.ephemeralId]?.speakerId ?? null,
      currentDisplayName: speakersMap[s.ephemeralId]?.displayName ?? s.ephemeralId,
    }));
  }, [transcription?.speakerResolution?._pendingSuggestions, speakersMap]);

  // ── Cálculo de coincidencias de búsqueda ────────────────────────────────────

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

  // ── Segmento activo durante reproducción ────────────────────────────────────

  const activeSegmentIndex = useMemo(() => {
    if (currentTime < 0 || !transcription?.segments) return -1;
    
    for (let i = 0; i < transcription.segments.length; i++) {
      const seg = transcription.segments[i];
      const start = Number(seg.start);
      const nextSeg = transcription.segments[i + 1];
      const end = nextSeg ? Number(nextSeg.start) : (Number(seg.end) || start + 10);
      
      if (currentTime >= start && currentTime < end) {
        return i;
      }
    }
    return -1;
  }, [currentTime, transcription]);

  // ── Efectos de scroll ────────────────────────────────────────────────────────

  useEffect(() => {
    onMatchesFound(matches.length);
  }, [matches.length, onMatchesFound]);

  useEffect(() => {
    if (matches.length > 0 && activeHighlightRef.current) {
      activeHighlightRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentMatchIndex, matches]);

  useEffect(() => {
    if (activeSegmentIndex !== -1 && activeSegmentRef.current && !userIsScrolling) {
       activeSegmentRef.current.scrollIntoView({
         behavior: 'smooth',
         block: 'start'
       });
    }
  }, [activeSegmentIndex, userIsScrolling]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSegmentClick = useCallback((startTime) => {
    onSeek(startTime);
    setUserIsScrolling(false);
  }, [onSeek]);

  // ── Función para renderizar texto con resaltado ──────────────────────────────

  const renderHighlightedText = (text, segIdx) => {
    if (!searchTerm || searchTerm.trim() === '') return text;

    const segmentMatches = matches
      .map((m, i) => ({ ...m, globalIndex: i }))
      .filter(m => m.segmentIndex === segIdx);

    if (segmentMatches.length === 0) return text;

    const parts = [];
    let lastIndex = 0;

    segmentMatches.forEach((match) => {
      if (match.startIndex > lastIndex) {
        parts.push(text.substring(lastIndex, match.startIndex));
      }
      
      const isActive = match.globalIndex === currentMatchIndex;
      
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

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  // ── Helpers de layout ────────────────────────────────────────────────────────

  const isMicrophone = (source) => {
    if (!source) return false;
    return source.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === 'microfono';
  };

  const getSourceClass = (source) => {
    return isMicrophone(source) ? styles.microphone : styles.system;
  };

  // ── Estados de carga / error / vacío ────────────────────────────────────────

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

  // ── Render principal ─────────────────────────────────────────────────────────

  return (
    <div className={styles.container}>
      {/* Barra de herramientas de hablantes */}
      {uniqueEphemeralIds.length > 1 && hasSpeakerResolution && (
        <div className={styles.speakersToolbar}>
          <span className={styles.speakersCount}>
            {uniqueEphemeralIds.length} hablantes
          </span>
          <button
            className={styles.mergeBtn}
            onClick={() => setIsMergeModalOpen(true)}
            title="Fusionar hablantes"
          >
            ⇄ Fusionar hablantes
          </button>
        </div>
      )}

      {/* Sugerencias de hablantes pendientes de confirmar */}
      {enrichedSuggestions.length > 0 && (
        <SpeakerSuggestions
          suggestions={enrichedSuggestions}
          recordingId={recordingId}
          audioSrc={audioSrc}
          onConfirmed={({ ephemeralId, confirmedSpeakerId, displayName }) => {
            dispatch(updateAlias({ ephemeralId, speakerId: confirmedSpeakerId, displayName }));
          }}
          onDismissed={() => {}}
        />
      )}

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
                {/* SpeakerLabel reemplaza el <span> de texto plano */}
                <SpeakerLabel
                  ephemeralId={segment.speaker || 'SPEAKER_00'}
                  embedding={segment.embedding || null}
                  recordingId={recordingId}
                  speakerResolution={transcription?.speakerResolution}
                />
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

      {/* Modal de fusión de hablantes */}
      {hasSpeakerResolution && (
        <MergeSpeakersModal
          isOpen={isMergeModalOpen}
          onClose={() => setIsMergeModalOpen(false)}
          ephemeralIds={uniqueEphemeralIds}
          recordingId={recordingId}
        />
      )}
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
