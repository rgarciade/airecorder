import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MdEdit, MdCheck } from 'react-icons/md';
import styles from './TranscriptionViewer.module.css';

/**
 * Formatea segundos a H:MM:SS (o MM:SS si < 1 hora)
 */
function formatTimestamp(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Componente para mostrar transcripciones en formato de conversación.
 * El lado (izquierda/derecha) se asigna por orden de aparición del speaker,
 * no por canal de audio.
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
  onSpeakerUpdate = null, // (speakerNames: Map, updatedSegments: Array) => void
}) {
  const activeHighlightRef = useRef(null);
  const activeSegmentRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const inputRef = useRef(null);

  const [userIsScrolling, setUserIsScrolling] = useState(false);
  // { originalName -> displayName } — empieza como identidad
  const [speakerNames, setSpeakerNames] = useState({});
  // qué speaker está siendo editado ahora mismo
  const [editingSpeaker, setEditingSpeaker] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Inicializar speakerNames cuando cargue la transcripción
  useEffect(() => {
    if (!transcription?.segments) return;
    const initial = {};
    for (const seg of transcription.segments) {
      if (seg.speaker && !(seg.speaker in initial)) {
        initial[seg.speaker] = seg.speaker;
      }
    }
    setSpeakerNames(initial);
  }, [transcription]);

  // Asignar lado fijo por speaker:
  // - El primer speaker del micrófono siempre va a la izquierda (es el "yo" del usuario)
  // - El resto se asignan por orden de primera aparición a partir de ahí
  const speakerSideMap = useMemo(() => {
    if (!transcription?.segments) return {};
    const map = {};
    let idx = 0;

    // Prioridad: el primer speaker del canal micrófono → izquierda
    const firstMicSeg = transcription.segments.find(s => s.source === 'micrófono' && s.speaker);
    if (firstMicSeg) {
      map[firstMicSeg.speaker] = 'left';
      idx = 1;
    }

    // Resto por orden de primera aparición
    for (const seg of transcription.segments) {
      if (seg.speaker && !(seg.speaker in map)) {
        map[seg.speaker] = idx % 2 === 0 ? 'left' : 'right';
        idx++;
      }
    }
    return map;
  }, [transcription]);

  // Segmentos con nombres de speaker aplicados
  const segments = useMemo(() => {
    if (!transcription?.segments) return [];
    return transcription.segments.map(seg => ({
      ...seg,
      speaker: speakerNames[seg.speaker] ?? seg.speaker,
      _originalSpeaker: seg.speaker,
    }));
  }, [transcription, speakerNames]);

  // Calcular coincidencias de búsqueda
  const matches = useMemo(() => {
    if (!segments.length || !searchTerm || searchTerm.trim() === '') return [];
    const allMatches = [];
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTerm, 'gi');
    segments.forEach((segment, segIdx) => {
      let match;
      while ((match = regex.exec(segment.text)) !== null) {
        allMatches.push({
          segmentIndex: segIdx,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          text: match[0],
        });
      }
    });
    return allMatches;
  }, [segments, searchTerm]);

  // Índice del segmento activo según currentTime
  const activeSegmentIndex = useMemo(() => {
    if (currentTime < 0 || !segments.length) return -1;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const start = Number(seg.start);
      const nextSeg = segments[i + 1];
      const end = nextSeg ? Number(nextSeg.start) : (Number(seg.end) || start + 10);
      if (currentTime >= start && currentTime < end) return i;
    }
    return -1;
  }, [currentTime, segments]);

  useEffect(() => { onMatchesFound(matches.length); }, [matches.length, onMatchesFound]);

  useEffect(() => {
    if (matches.length > 0 && activeHighlightRef.current) {
      activeHighlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentMatchIndex, matches]);

  useEffect(() => {
    if (activeSegmentIndex !== -1 && activeSegmentRef.current && !userIsScrolling) {
      activeSegmentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeSegmentIndex, userIsScrolling]);

  // Auto-focus al entrar en modo edición
  useEffect(() => {
    if (editingSpeaker && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingSpeaker]);

  // ── Edición de speakers ────────────────────────────────────────────────────

  const startEditing = useCallback((originalName) => {
    setEditingSpeaker(originalName);
    setEditValue(speakerNames[originalName] ?? originalName);
  }, [speakerNames]);

  const confirmEdit = useCallback(() => {
    if (!editingSpeaker) return;
    const trimmed = editValue.trim();
    if (!trimmed) { setEditingSpeaker(null); return; }

    const newNames = { ...speakerNames, [editingSpeaker]: trimmed };
    setSpeakerNames(newNames);
    setEditingSpeaker(null);

    if (onSpeakerUpdate && transcription?.segments) {
      const updatedSegments = transcription.segments.map(seg => ({
        ...seg,
        speaker: newNames[seg.speaker] ?? seg.speaker,
      }));
      onSpeakerUpdate(newNames, updatedSegments);
    }
  }, [editingSpeaker, editValue, speakerNames, onSpeakerUpdate, transcription]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') confirmEdit();
    if (e.key === 'Escape') setEditingSpeaker(null);
  }, [confirmEdit]);

  // ── Búsqueda ───────────────────────────────────────────────────────────────

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
    if (lastIndex < text.length) parts.push(text.substring(lastIndex));
    return parts;
  };

  // ── Estados de carga/error ─────────────────────────────────────────────────

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

  if (!transcription || !segments.length) {
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.container}>
      <div className={styles.conversation} ref={scrollContainerRef}>
        {segments.map((segment, index) => {
          const isActive = index === activeSegmentIndex;
          const side = speakerSideMap[segment._originalSpeaker] ?? 'left';
          const isEditing = editingSpeaker === segment._originalSpeaker;

          return (
            <div
              key={`${segment.start}-${segment._originalSpeaker}-${index}`}
              className={`${styles.message} ${styles[side]} ${isActive ? styles.activeSegment : ''}`}
              ref={isActive ? activeSegmentRef : null}
            >
              <div className={styles.messageHeader}>
                {/* Speaker editable */}
                <span className={styles.speakerWrapper}>
                  {isEditing ? (
                    <span className={styles.speakerEditGroup}>
                      <input
                        ref={inputRef}
                        className={styles.speakerInput}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={confirmEdit}
                        onKeyDown={handleKeyDown}
                        onClick={e => e.stopPropagation()}
                      />
                      <button
                        className={styles.speakerConfirmBtn}
                        onMouseDown={e => { e.preventDefault(); confirmEdit(); }}
                        title="Confirmar"
                      >
                        <MdCheck size={13} />
                      </button>
                    </span>
                  ) : (
                    <button
                      className={styles.speakerBtn}
                      onClick={e => { e.stopPropagation(); startEditing(segment._originalSpeaker); }}
                      title="Click para renombrar"
                    >
                      <span className={styles.speakerName}>{segment.speaker}</span>
                      <MdEdit size={11} className={styles.editIcon} />
                    </button>
                  )}
                </span>

                {/* Timestamp */}
                <span
                  className={`${styles.timestamp} ${isActive ? styles.activeTimestamp : ''}`}
                  onClick={e => { e.stopPropagation(); onSeek(segment.start); setUserIsScrolling(false); }}
                  title="Click para ir a este momento"
                >
                  {formatTimestamp(segment.start)}
                </span>
              </div>

              <div
                className={styles.messageText}
                onClick={() => { onSeek(segment.start); setUserIsScrolling(false); }}
              >
                {renderHighlightedText(segment.text, index)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
