import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './ProjectAttachmentsTab.module.css';
import {
  MdImage,
  MdPictureAsPdf,
  MdDescription,
  MdInsertDriveFile,
  MdTableChart,
  MdFolder,
  MdDelete,
  MdAdd,
  MdSearch
} from 'react-icons/md';
import { getAttachmentThumbnail, deleteAttachment, pickAndAddAttachment } from '../../../../services/attachmentsService';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentIcon({ type, className }) {
  if (type === 'image') return <MdImage className={className} />;
  if (type === 'pdf') return <MdPictureAsPdf className={className} />;
  if (type === 'text') return <MdDescription className={className} />;
  if (type === 'excel') return <MdTableChart className={className} />;
  return <MdInsertDriveFile className={className} />;
}

function AttachmentCard({ attachment, recordingId, onDelete }) {
  const [thumbnail, setThumbnail] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (attachment.type === 'image') {
      getAttachmentThumbnail(recordingId, attachment.filename).then(url => {
        if (url) setThumbnail(url);
      });
    }
  }, [attachment.filename, attachment.type, recordingId]);

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    const ok = await deleteAttachment(recordingId, attachment.filename);
    if (ok) {
      onDelete(recordingId, attachment.filename);
    } else {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className={styles.card} onMouseLeave={() => setConfirmDelete(false)}>
      <div className={styles.cardPreview}>
        {thumbnail ? (
          <img src={thumbnail} alt={attachment.filename} className={styles.thumbnail} />
        ) : (
          <div className={styles.iconPreview}>
            <AttachmentIcon type={attachment.type} className={styles.typeIcon} />
          </div>
        )}
      </div>
      <div className={styles.cardInfo}>
        <span className={styles.filename} title={attachment.filename}>
          {attachment.filename}
        </span>
        <span className={styles.fileSize}>{formatBytes(attachment.size)}</span>
      </div>
      <button
        className={`${styles.deleteBtn} ${confirmDelete ? styles.deleteBtnConfirm : ''}`}
        onClick={handleDelete}
        disabled={deleting}
        title={confirmDelete ? 'Confirmar eliminación' : 'Eliminar adjunto'}
      >
        {deleting ? (
          <span className={styles.spinner} />
        ) : (
          <MdDelete size={16} />
        )}
      </button>
      {confirmDelete && !deleting && (
        <div className={styles.confirmBadge} onClick={handleDelete}>
          Confirmar
        </div>
      )}
    </div>
  );
}

export default function ProjectAttachmentsTab({ recordings, attachments, onAttachmentsChange }) {
  const [uploadingRecordings, setUploadingRecordings] = useState({});
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [uploadSearch, setUploadSearch] = useState('');
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const uploadBtnRef = useRef(null);

  const toggleUploadMenu = () => {
    if (!showUploadMenu && uploadBtnRef.current) {
      const rect = uploadBtnRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right
      });
      setShowUploadMenu(true);
    } else {
      setShowUploadMenu(false);
    }
  };

  useEffect(() => {
    const closeMenu = () => setShowUploadMenu(false);
    if (showUploadMenu) {
      window.addEventListener('resize', closeMenu);
      // Opcionalmente, agregar listener al scroll del contenedor si es necesario
    }
    return () => {
      window.removeEventListener('resize', closeMenu);
    };
  }, [showUploadMenu]);

  const handleUpload = async (recordingId) => {
    setShowUploadMenu(false);
    setUploadSearch('');
    setUploadingRecordings(prev => ({ ...prev, [recordingId]: true }));
    const result = await pickAndAddAttachment(recordingId);
    setUploadingRecordings(prev => ({ ...prev, [recordingId]: false }));
    if (!result.canceled && result.attachments.length > 0) {
      const newAtts = result.attachments.map(a => {
        const recording = recordings.find(r => r.id === recordingId);
        return { ...a, recordingId, recordingName: recording ? recording.title : `Grabación ${recordingId}` };
      });
      onAttachmentsChange([...attachments, ...newAtts]);
    }
  };

  const handleDelete = (recordingId, filename) => {
    onAttachmentsChange(attachments.filter(a => !(a.recordingId === recordingId && a.filename === filename)));
  };

  // Create an array of groups, filtering out those with no attachments
  const groups = recordings.map(rec => {
    return {
      recordingId: rec.id,
      recordingName: rec.title || `Grabación ${rec.id}`,
      attachments: attachments.filter(a => a.recordingId === rec.id)
    };
  }).filter(group => group.attachments.length > 0);

  const anyUploading = Object.values(uploadingRecordings).some(v => v);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <h3 className={styles.title}>Adjuntos del Proyecto</h3>
          <span className={styles.count}>
            {attachments.length} {attachments.length === 1 ? 'archivo' : 'archivos'} en total
          </span>
        </div>
        
        {recordings.length > 0 && (
          <div className={styles.uploadMenuWrapper}>
            <button
              ref={uploadBtnRef}
              className={styles.uploadBtn}
              onClick={toggleUploadMenu}
              disabled={anyUploading}
            >
              {anyUploading ? (
                <span className={styles.spinner} />
              ) : (
                <MdAdd size={18} />
              )}
              <span style={{ marginLeft: 4 }}>Subir archivo</span>
            </button>
            {showUploadMenu && createPortal(
              <>
                <div 
                  style={{position: 'fixed', inset: 0, zIndex: 9998}} 
                  onClick={() => setShowUploadMenu(false)} 
                />
                <div 
                  className={styles.uploadMenu} 
                  style={{ 
                    position: 'fixed', 
                    top: `${menuPos.top}px`, 
                    right: `${menuPos.right}px`, 
                    zIndex: 9999 
                  }}
                >
                  <div className={styles.uploadMenuHeader}>Selecciona a qué récord subir</div>
                  <div className={styles.uploadMenuSearch}>
                    <MdSearch size={15} className={styles.uploadMenuSearchIcon} />
                    <input
                      className={styles.uploadMenuSearchInput}
                      placeholder="Buscar grabación..."
                      value={uploadSearch}
                      onChange={e => setUploadSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className={styles.uploadMenuList}>
                    {recordings
                      .filter(rec => (rec.title || '').toLowerCase().includes(uploadSearch.toLowerCase()))
                      .slice(0, 5)
                      .map(rec => (
                        <button
                          key={rec.id}
                          className={styles.uploadMenuItem}
                          onClick={() => handleUpload(rec.id)}
                          title={rec.title || `Grabación ${rec.id}`}
                        >
                          {rec.title || `Grabación ${rec.id}`}
                        </button>
                      ))
                    }
                  </div>
                </div>
              </>,
              document.body
            )}
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <div className={styles.emptyState}>
          <MdInsertDriveFile size={48} className={styles.emptyIcon} />
          <h4 className={styles.emptyTitle}>No hay archivos</h4>
          <p className={styles.emptyText}>
            Usa el botón "Subir archivo" para añadir documentos a las grabaciones de este proyecto.
          </p>
        </div>
      ) : (
        <div className={styles.groupsContainer}>
          {groups.map(group => {
            const isUploading = uploadingRecordings[group.recordingId];
            return (
              <div key={group.recordingId} className={styles.group}>
                <div className={styles.groupHeader}>
                  <MdFolder size={20} className={styles.groupIcon} />
                  <span className={styles.groupTitle}>{group.recordingName}</span>
                  <span className={styles.groupCount}>
                    {group.attachments.length} {group.attachments.length === 1 ? 'archivo' : 'archivos'}
                  </span>
                  {isUploading && (
                    <span className={styles.spinner} style={{ marginLeft: 8, borderColor: 'rgba(156, 163, 175, 0.4)', borderTopColor: '#9CA3AF' }} />
                  )}
                </div>
                <div className={styles.grid}>
                  {group.attachments.map(att => (
                    <AttachmentCard
                      key={`${att.recordingId}-${att.filename}`}
                      attachment={att}
                      recordingId={att.recordingId}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
