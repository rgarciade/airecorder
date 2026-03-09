import React from 'react';
import { useTranslation } from 'react-i18next';
import whatsNewData from '../../data/whatsNew.json';
import styles from './WhatsNewModal.module.css';

/**
 * Modal "Novedades" que muestra los cambios de la versión actual.
 * El contenido se lee de src/data/whatsNew.json, en ES o EN según
 * el idioma de interfaz activo (i18next).
 *
 * Props:
 *  - onClose  {function} — Callback para cerrar el modal
 */
export default function WhatsNewModal({ onClose }) {
  // i18next nos da el idioma actual; si no es 'en' usamos 'es' por defecto
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('en') ? 'en' : 'es';

  const { version, changes, i18n: labels } = whatsNewData;
  const t = labels[lang];

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleChangelogClick = (e) => {
    e.preventDefault();
    window.electronAPI?.openDownloadUrl?.(
      'https://rgarciade.github.io/airecorder/changelog.html'
    );
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div>
              <span className={styles.versionBadge}>v{version}</span>
              {import.meta.env.DEV && (
                <span className={styles.devBadge}>{t.devBadge}</span>
              )}
            </div>
            <h2 className={styles.title}>{t.modalTitle}</h2>
            <p className={styles.subtitle}>{t.modalSubtitle}</p>
          </div>

          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Lista de cambios ── */}
        <div className={styles.body}>
          <ul className={styles.changeList}>
            {changes.map((item) => (
              <li key={item.id} className={styles.changeItem}>
                <span className={styles.changeIcon}>{item.icon}</span>
                <div className={styles.changeText}>
                  <strong className={styles.changeName}>{item[lang].title}</strong>
                  <span className={styles.changeDesc}>{item[lang].desc}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Footer ── */}
        <div className={styles.footer}>
          <a
            href="#"
            className={styles.changelogLink}
            onClick={handleChangelogClick}
          >
            {t.changelogLinkText}
          </a>
          <button className={styles.closeAction} onClick={onClose}>
            {t.closeButton}
          </button>
        </div>

      </div>
    </div>
  );
}
