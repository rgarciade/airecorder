/**
 * MergeSpeakersModal.jsx
 *
 * Modal para fusionar dos o más hablantes en un único perfil.
 *
 * Flujo:
 *   1. El usuario selecciona los hablantes efímeros a fusionar.
 *   2. Escribe (o elige) el nombre unificado.
 *   3. Al confirmar:
 *      - Despacha `mergeSpeakers` en Redux (actualiza todos los segmentos en UI).
 *      - Llama IPC `assign-alias` para cada ephemeralId implicado.
 *
 * IMPORTANTE:
 *   - El JSON de transcripción NO se modifica. Solo se actualiza el mapa de Redux.
 *   - Los ephemeralId son inmutables; solo cambia su alias de presentación.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  selectSpeakersMap,
  selectAllSpeakers,
  mergeSpeakers,
} from '../../store/slices/speakersSlice';
import styles from './MergeSpeakersModal.module.css';

/**
 * @param {Object}    props
 * @param {boolean}   props.isOpen        - Controla visibilidad del modal.
 * @param {Function}  props.onClose       - Callback para cerrar el modal.
 * @param {string[]}  props.ephemeralIds  - Lista de ephemeralIds disponibles en la sesión.
 * @param {number}    [props.recordingId] - ID de la grabación activa.
 */
export default function MergeSpeakersModal({ isOpen, onClose, ephemeralIds = [], recordingId }) {
  const dispatch = useDispatch();
  const speakersMap = useSelector(selectSpeakersMap);
  const allSpeakers = useSelector(selectAllSpeakers);

  const [selectedIds, setSelectedIds] = useState([]);
  const [mergedName, setMergedName] = useState('');
  // null = escribiendo libremente, objeto speaker = seleccionado de BD
  const [selectedSpeaker, setSelectedSpeaker] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Reset al abrir
  useEffect(() => {
    if (isOpen) {
      setSelectedIds([]);
      setMergedName('');
      setSelectedSpeaker(null);
      setError('');
      setSuggestions([]);
      setIsDropdownOpen(false);
    }
  }, [isOpen]);

  // Focus en input al abrir
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  // ── Autocompletado del nombre ──────────────────────────────────────────────

  const computeSuggestions = (value) => {
    if (!value.trim()) return allSpeakers.slice(0, 6);
    const lower = value.toLowerCase();
    return allSpeakers.filter((s) => s.display_name.toLowerCase().includes(lower)).slice(0, 6);
  };

  const handleNameChange = (e) => {
    const value = e.target.value;
    setMergedName(value);
    // Si el usuario escribe manualmente, deselecciona el speaker existente
    setSelectedSpeaker(null);
    setSuggestions(computeSuggestions(value));
    setIsDropdownOpen(true);
  };

  const handleInputFocus = () => {
    setSuggestions(computeSuggestions(mergedName));
    setIsDropdownOpen(true);
  };

  const handleSelectExisting = (speaker) => {
    setSelectedSpeaker(speaker);
    setMergedName(speaker.display_name);
    setSuggestions([]);
    setIsDropdownOpen(false);
  };

  const handleClearSelection = () => {
    setSelectedSpeaker(null);
    setMergedName('');
    setSuggestions(allSpeakers.slice(0, 6));
    setIsDropdownOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // ── Selección de hablantes ────────────────────────────────────────────────

  const toggleSpeaker = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setError('');
  };

  // Indica si el nombre actual coincide exactamente con un hablante de BD
  const isNewSpeaker = mergedName.trim() && !selectedSpeaker;

  // ── Guardar merge ─────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    const trimmedName = mergedName.trim();
    if (selectedIds.length < 2) {
      setError('Selecciona al menos 2 hablantes para fusionar.');
      return;
    }
    if (!trimmedName) {
      setError('Introduce un nombre para el hablante unificado.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      let targetSpeakerId = null;

      if (window.electronAPI?.mergeSpeakers) {
        // Pasar el mapa de Redux para que el backend resuelva los speakerIds
        const result = await window.electronAPI.mergeSpeakers({
          sourceEphemeralIds: selectedIds,
          speakersMap,
          targetAlias: trimmedName,
        });

        if (!result?.success) {
          setError(result?.error || 'Error al fusionar hablantes.');
          return;
        }
        targetSpeakerId = result.targetSpeakerId;
      }

      // Actualizar Redux: todos los ephemeralIds seleccionados apuntan al mismo perfil
      dispatch(mergeSpeakers({
        sourceEphemeralIds: selectedIds,
        targetSpeakerId: targetSpeakerId || trimmedName,
        displayName: trimmedName,
      }));

      onClose();
    } catch (err) {
      console.error('[MergeSpeakersModal] Error al fusionar:', err);
      setError('Ocurrió un error al guardar. Inténtalo de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (isDropdownOpen) {
        setIsDropdownOpen(false);
      } else {
        onClose();
      }
    }
    if (e.key === 'Enter' && !isSaving && !isDropdownOpen) handleConfirm();
    if (e.key === 'ArrowDown' && isDropdownOpen) {
      e.preventDefault();
      const first = dropdownRef.current?.querySelector('[role="option"]');
      first?.focus();
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  const getDisplayName = (id) => speakersMap[id]?.displayName || id;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="merge-modal-title"
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 id="merge-modal-title" className={styles.title}>
            Fusionar hablantes
          </h2>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.description}>
            Selecciona los hablantes que son la misma persona y asígnales un nombre unificado.
            Los cambios se reflejarán en todos los segmentos de la transcripción.
          </p>

          {/* Lista de hablantes para seleccionar */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>Hablantes a fusionar</label>
            <ul className={styles.speakerList} role="list">
              {ephemeralIds.map((id) => (
                <li key={id} className={styles.speakerItem}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={selectedIds.includes(id)}
                      onChange={() => toggleSpeaker(id)}
                      aria-label={`Seleccionar ${getDisplayName(id)}`}
                    />
                    <span className={styles.speakerName}>{getDisplayName(id)}</span>
                    <span className={styles.speakerEphemeral}>{id}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          {/* Combobox nombre unificado */}
          <div className={styles.section}>
            <label htmlFor="merge-name-input" className={styles.sectionLabel}>
              Nombre unificado
            </label>

            <div className={styles.comboboxWrapper} ref={dropdownRef}>
              {/* Campo de entrada */}
              <div
                className={`${styles.comboboxInput} ${selectedSpeaker ? styles.comboboxInputSelected : ''} ${isSaving ? styles.comboboxInputDisabled : ''}`}
              >
                {selectedSpeaker ? (
                  // Modo: hablante existente seleccionado
                  <>
                    <span className={styles.selectedBadge}>
                      <span className={styles.selectedBadgeIcon}>✓</span>
                      <span className={styles.selectedBadgeName}>{selectedSpeaker.display_name}</span>
                      <span className={styles.selectedBadgeTag}>Existente</span>
                    </span>
                    {!isSaving && (
                      <button
                        type="button"
                        className={styles.comboboxClearBtn}
                        onClick={handleClearSelection}
                        aria-label="Cambiar selección"
                      >
                        ✕
                      </button>
                    )}
                  </>
                ) : (
                  // Modo: escritura libre
                  <>
                    <input
                      id="merge-name-input"
                      ref={inputRef}
                      type="text"
                      value={mergedName}
                      onChange={handleNameChange}
                      onFocus={handleInputFocus}
                      onKeyDown={handleKeyDown}
                      className={styles.comboboxTextInput}
                      placeholder="Buscar existente o escribir nombre nuevo…"
                      disabled={isSaving}
                      aria-autocomplete="list"
                      aria-expanded={isDropdownOpen}
                      autoComplete="off"
                    />
                    {isNewSpeaker && (
                      <span className={styles.newBadge}>Nuevo</span>
                    )}
                  </>
                )}
              </div>

              {/* Dropdown de sugerencias */}
              {isDropdownOpen && !selectedSpeaker && !isSaving && (
                <ul className={styles.comboboxDropdown} role="listbox" aria-label="Hablantes existentes">
                  {suggestions.length > 0 && (
                    <li className={styles.dropdownGroupLabel}>Hablantes existentes</li>
                  )}
                  {suggestions.map((s) => (
                    <li
                      key={s.id}
                      role="option"
                      tabIndex={-1}
                      className={styles.dropdownItem}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectExisting(s);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectExisting(s);
                        }
                      }}
                    >
                      <span className={styles.dropdownItemName}>{s.display_name}</span>
                      <span className={styles.dropdownItemTag}>Existente</span>
                    </li>
                  ))}
                  {mergedName.trim() && (
                    <li
                      role="option"
                      tabIndex={-1}
                      className={`${styles.dropdownItem} ${suggestions.length > 0 ? styles.dropdownItemNew : ''}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsDropdownOpen(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setIsDropdownOpen(false);
                        }
                      }}
                    >
                      <span className={styles.dropdownItemName}>"{mergedName.trim()}"</span>
                      <span className={styles.dropdownItemNewTag}>Crear nuevo</span>
                    </li>
                  )}
                  {suggestions.length === 0 && !mergedName.trim() && (
                    <li className={styles.dropdownEmpty}>Sin hablantes guardados aún</li>
                  )}
                </ul>
              )}
            </div>
          </div>

          {error && (
            <p className={styles.errorMsg} role="alert">{error}</p>
          )}
        </div>

        <div className={styles.footer}>
          <button
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button
            className={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={isSaving || selectedIds.length < 2 || !mergedName.trim()}
          >
            {isSaving ? 'Guardando…' : 'Fusionar'}
          </button>
        </div>
      </div>
    </div>
  );
}
