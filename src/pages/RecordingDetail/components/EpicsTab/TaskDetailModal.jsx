import React, { useState, useEffect } from 'react';
import styles from './TaskDetailModal.module.css';
import { MdClose, MdSave, MdDelete, MdFolderOpen, MdSend } from 'react-icons/md';

const STATUS_OPTIONS = [
  { value: 'backlog',     label: 'Backlog' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'blocked',     label: 'Bloqueado' },
  { value: 'done',        label: 'Hecho' },
];

const LAYER_OPTIONS = [
  { value: 'frontend',  label: 'Front', cls: 'layerFront' },
  { value: 'backend',   label: 'Back',  cls: 'layerBack'  },
  { value: 'fullstack', label: 'Full',  cls: 'layerFull'  },
  { value: 'general',   label: 'General', cls: 'layerGen' },
];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function TaskDetailModal({
  task,
  recordingInfo,       // { id, title } | undefined
  onClose,
  onUpdate,            // ({ id, title, content, layer, status }) => void
  onDelete,            // (taskId) => void | undefined — opcional
  onNavigateToRecording, // (recordingId) => void | undefined
  getComments,         // (taskId) => Promise<Comment[]>
  onAddComment,        // (taskId, content) => Promise<Comment>
  onDeleteComment,     // (commentId) => Promise<void>
}) {
  const [editData, setEditData] = useState({
    title: task.title || '',
    content: task.content || '',
    layer: task.layer || 'general',
    status: task.status || 'backlog',
  });

  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Cargar comentarios al abrir
  useEffect(() => {
    if (getComments) {
      getComments(task.id).then(setComments);
    }
  }, [task.id]);

  const handleSave = () => {
    if (!editData.title.trim()) return;
    onUpdate({ id: task.id, ...editData, title: editData.title.trim(), content: editData.content.trim() });
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !onAddComment) return;
    setAddingComment(true);
    try {
      const saved = await onAddComment(task.id, newComment.trim());
      if (saved) {
        setComments(prev => [...prev, saved]);
        setNewComment('');
      }
    } finally {
      setAddingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!onDeleteComment) return;
    await onDeleteComment(commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleCommentKey = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddComment();
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <p className={styles.title}>{task.title}</p>

            {/* Status pills */}
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Estado:</span>
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`${styles.statusPill} ${editData.status === opt.value ? styles[`active_${opt.value}`] : ''}`}
                  onClick={() => setEditData(p => ({ ...p, status: opt.value }))}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Grabación origen */}
            {recordingInfo && (
              <button
                className={styles.recordingBadge}
                onClick={() => onNavigateToRecording?.(recordingInfo.id)}
                title={`Ir a: ${recordingInfo.title}`}
              >
                <MdFolderOpen size={12} />
                {recordingInfo.title}
              </button>
            )}
          </div>

          <button className={styles.closeBtn} onClick={onClose} title="Cerrar">
            <MdClose size={18} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Panel edición */}
          <div className={styles.editPanel}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Título</label>
              <input
                type="text"
                className={styles.fieldInput}
                value={editData.title}
                onChange={(e) => setEditData(p => ({ ...p, title: e.target.value }))}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Descripción</label>
              <textarea
                className={styles.fieldTextarea}
                value={editData.content}
                onChange={(e) => setEditData(p => ({ ...p, content: e.target.value }))}
                rows={7}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Capa</label>
              <div className={styles.layerSelector}>
                {LAYER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`${styles.layerOption} ${styles[opt.cls]} ${editData.layer === opt.value ? styles.layerActive : ''}`}
                    onClick={() => setEditData(p => ({ ...p, layer: opt.value }))}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              className={styles.saveButton}
              onClick={handleSave}
              disabled={!editData.title.trim()}
            >
              <MdSave size={16} /> Guardar cambios
            </button>

            {onDelete && (
              <div className={styles.deleteRow}>
                {confirmDelete ? (
                  <>
                    <span className={styles.deleteConfirmText}>¿Eliminar esta tarea?</span>
                    <button
                      className={styles.deleteConfirmBtn}
                      onClick={() => { onDelete(task.id); onClose(); }}
                    >
                      Sí, eliminar
                    </button>
                    <button
                      className={styles.deleteCancelBtn}
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    className={styles.deleteButton}
                    onClick={() => setConfirmDelete(true)}
                  >
                    <MdDelete size={14} /> Eliminar tarea
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Panel comentarios */}
          <div className={styles.commentsPanel}>
            <div className={styles.commentsHeader}>
              Comentarios {comments.length > 0 && `(${comments.length})`}
            </div>

            <div className={styles.commentsList}>
              {comments.length === 0 ? (
                <p className={styles.commentEmpty}>Sin comentarios aún</p>
              ) : (
                comments.map(c => (
                  <div key={c.id} className={styles.commentItem}>
                    <div className={styles.commentMeta}>
                      <span className={styles.commentDate}>{formatDate(c.created_at)}</span>
                      <button
                        className={styles.commentDeleteBtn}
                        onClick={() => handleDeleteComment(c.id)}
                        title="Eliminar comentario"
                      >
                        <MdDelete size={13} />
                      </button>
                    </div>
                    <p className={styles.commentContent}>{c.content}</p>
                  </div>
                ))
              )}
            </div>

            {onAddComment && (
              <div className={styles.commentForm}>
                <textarea
                  className={styles.commentTextarea}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={handleCommentKey}
                  placeholder="Añadir comentario... (Ctrl+Enter para enviar)"
                  rows={3}
                />
                <button
                  className={styles.addCommentBtn}
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || addingComment}
                >
                  <MdSend size={13} />
                  {addingComment ? 'Enviando...' : 'Añadir'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
