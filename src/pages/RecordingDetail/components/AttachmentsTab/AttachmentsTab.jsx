import React, { useState, useEffect } from 'react';
import styles from './AttachmentsTab.module.css';
import {
  MdUploadFile,
  MdDelete,
  MdImage,
  MdPictureAsPdf,
  MdDescription,
  MdAdd,
  MdInsertDriveFile,
  MdTableChart
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
      onDelete(attachment.filename);
    } else {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className={styles.card}>
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
        <div className={styles.confirmBadge} onClick={() => setConfirmDelete(false)}>
          ¿Eliminar?
        </div>
      )}
    </div>
  );
}

export default function AttachmentsTab({ recordingId, attachments, onAttachmentsChange }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    setUploading(true);
    const result = await pickAndAddAttachment(recordingId);
    setUploading(false);
    if (!result.canceled && result.attachments.length > 0) {
      onAttachmentsChange([...attachments, ...result.attachments]);
    }
  };

  const handleDelete = (filename) => {
    onAttachmentsChange(attachments.filter(a => a.filename !== filename));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <h3 className={styles.title}>Adjuntos</h3>
          <span className={styles.count}>
            {attachments.length} {attachments.length === 1 ? 'archivo' : 'archivos'}
          </span>
        </div>
        {attachments.length > 0 && (
          <button
            className={styles.uploadBtn}
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? (
              <span className={styles.spinner} />
            ) : (
              <MdAdd size={18} />
            )}
            Subir archivo
          </button>
        )}
      </div>

      <p className={styles.hint}>
        Los adjuntos se usarán como contexto en el chat con IA. Soportado: imágenes (.png, .jpg, .webp, .gif), documentos (.pdf, .txt, .md), hojas de cálculo (.xlsx, .xls).
      </p>

      {attachments.length === 0 ? (
        <div className={styles.emptyState}>
          <MdUploadFile size={48} className={styles.emptyIcon} />
          <h4 className={styles.emptyTitle}>Sin adjuntos</h4>
          <p className={styles.emptySubtitle}>
            Sube imágenes o documentos para usarlos como contexto en el chat.
          </p>
          <button
            className={styles.uploadBtnLarge}
            onClick={handleUpload}
            disabled={uploading}
          >
            <MdAdd size={18} />
            Subir primer archivo
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {attachments.map(attachment => (
            <AttachmentCard
              key={attachment.filename}
              attachment={attachment}
              recordingId={recordingId}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
