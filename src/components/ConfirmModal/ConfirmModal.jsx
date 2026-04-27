/**
 * ConfirmModal.jsx
 *
 * Modal de confirmación simple reutilizable.
 *
 * Props:
 *   - isOpen: boolean
 *   - title: string
 *   - message: string | ReactNode
 *   - confirmText: string
 *   - cancelText: string
 *   - onConfirm: () => void
 *   - onCancel: () => void
 *   - isDanger: boolean (para acciones destructivas)
 */

import React from 'react';
import styles from './ConfirmModal.module.css';

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  isDanger = false,
}) {
  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 id="confirm-modal-title" className={styles.title}>
            {title}
          </h2>
        </div>

        <div className={styles.body}>
          <p className={styles.message}>{message}</p>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className={`${styles.confirmBtn} ${isDanger ? styles.dangerBtn : ''}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
