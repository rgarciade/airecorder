import React from 'react';
import styles from './AIErrorModal.module.css';

export default function AIErrorModal({ message, tokenHint, onClose }) {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.iconCircle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div className={styles.headerText}>
            <h3 className={styles.title}>Error de IA</h3>
            <p className={styles.subtitle}>Se produjo un problema al procesar tu solicitud</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          <div className={styles.messageBox}>
            <p className={styles.message}>{message}</p>
          </div>

          {tokenHint && (
            <div className={styles.hintBox}>
              <div className={styles.hintIcon}>💡</div>
              <p className={styles.hintText}>{tokenHint}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.closeAction} onClick={onClose}>
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
}
