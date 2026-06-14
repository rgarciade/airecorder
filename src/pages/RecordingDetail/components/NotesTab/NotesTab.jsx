import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { MdAdd, MdContentCopy, MdEdit, MdDelete, MdCheck, MdPictureAsPdf, MdDescription } from 'react-icons/md';
import styles from './NotesTab.module.css';

export default function NotesTab({ recordingId, onGenerateClick }) {
  const { i18n } = useTranslation();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const isSpanish = i18n.language === 'es';

  useEffect(() => {
    loadNotes();
  }, [recordingId]);

  const loadNotes = async () => {
    setLoading(true);
    setError(null);
    try {
      const notesList = await window.electronAPI.templates.getNotesForRecording(recordingId);
      setNotes(notesList || []);
    } catch (err) {
      console.error('Error loading notes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (note) => {
    try {
      await navigator.clipboard.writeText(note.content_md);
      setCopiedId(note.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
  };

  const handleDelete = async (noteId) => {
    const confirmMsg = isSpanish 
      ? '¿Eliminar esta nota? Esta acción no se puede deshacer.'
      : 'Delete this note? This action cannot be undone.';
    
    if (window.confirm(confirmMsg)) {
      try {
        await window.electronAPI.templates.deleteNote(noteId);
        setNotes(prev => prev.filter(n => n.id !== noteId));
      } catch (err) {
        console.error('Error deleting note:', err);
        alert(isSpanish ? 'Error al eliminar la nota' : 'Error deleting note');
      }
    }
  };

  const handleExport = async (note, exportFormat) => {
    try {
      const result = await window.electronAPI.exportDocument(
        { type: 'note', contentMd: note.content_md },
        exportFormat
      );
      
      if (result.success && !result.canceled) {
        alert(isSpanish 
          ? `Nota exportada a ${exportFormat.toUpperCase()}`
          : `Note exported to ${exportFormat.toUpperCase()}`);
      } else if (result.error) {
        console.error('Export error:', result.error);
        alert(isSpanish ? 'Error al exportar la nota' : 'Error exporting note');
      }
    } catch (err) {
      console.error('Export error:', err);
      alert(isSpanish ? 'Error al exportar la nota' : 'Error exporting note');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(isSpanish ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Custom markdown components for cleaner rendering
  const markdownComponents = {
    p: ({ children }) => <p className={styles.mdP}>{children}</p>,
    h2: ({ children }) => <h2 className={styles.mdH2}>{children}</h2>,
    h3: ({ children }) => <h3 className={styles.mdH3}>{children}</h3>,
    ul: ({ children }) => <ul className={styles.mdUl}>{children}</ul>,
    ol: ({ children }) => <ol className={styles.mdOl}>{children}</ol>,
    li: ({ children }) => <li className={styles.mdLi}>{children}</li>,
    blockquote: ({ children }) => <blockquote className={styles.mdBlockquote}>{children}</blockquote>,
    code: ({ children }) => <code className={styles.mdCode}>{children}</code>,
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>{isSpanish ? 'Cargando notas...' : 'Loading notes...'}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header with generate button */}
      <div className={styles.header}>
        <h2 className={styles.title}>
          {isSpanish ? 'Notas Generadas' : 'Generated Notes'}
        </h2>
        <button 
          className={styles.generateBtn}
          onClick={onGenerateClick}
        >
          <MdAdd size={18} />
          {isSpanish ? 'Generar desde plantilla' : 'Generate from template'}
        </button>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>
            {isSpanish ? 'Aún no hay notas generadas' : 'No notes generated yet'}
          </p>
          <button 
            className={styles.generateBtn}
            onClick={onGenerateClick}
          >
            <MdAdd size={18} />
            {isSpanish ? 'Generar desde plantilla' : 'Generate from template'}
          </button>
        </div>
      ) : (
        <div className={styles.notesList}>
          {notes.map((note) => (
            <div key={note.id} className={styles.noteCard}>
              <div className={styles.noteHeader}>
                <div className={styles.noteMeta}>
                  <span className={styles.noteIcon}>{note.template_icon || '📝'}</span>
                  <span className={styles.noteTemplateName}>{note.template_name}</span>
                  <span className={styles.noteDate}>
                    {formatDate(note.created_at)}
                  </span>
                </div>
                <div className={styles.noteActions}>
                  <button 
                    className={styles.actionBtn}
                    onClick={() => handleExport(note, 'pdf')}
                    title={isSpanish ? 'Exportar PDF' : 'Export PDF'}
                  >
                    <MdPictureAsPdf size={16} />
                  </button>
                  <button 
                    className={styles.actionBtn}
                    onClick={() => handleExport(note, 'docx')}
                    title={isSpanish ? 'Exportar DOCX' : 'Export DOCX'}
                  >
                    <MdDescription size={16} />
                  </button>
                  <button 
                    className={styles.actionBtn}
                    onClick={() => handleCopy(note)}
                    title={isSpanish ? 'Copiar' : 'Copy'}
                  >
                    {copiedId === note.id ? <MdCheck size={16} /> : <MdContentCopy size={16} />}
                  </button>
                  <button 
                    className={styles.actionBtn}
                    onClick={() => handleDelete(note.id)}
                    title={isSpanish ? 'Eliminar' : 'Delete'}
                  >
                    <MdDelete size={16} />
                  </button>
                </div>
              </div>
              <div className={styles.noteContent}>
                <ReactMarkdown components={markdownComponents}>
                  {note.content_md}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}