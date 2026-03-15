import React, { useState, useRef, useEffect } from 'react';
import { MdOpenInNew } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import styles from './InfoTooltip.module.css';

/**
 * Enlace de texto "Modelos recomendados" con popover + botón a canirun.ai.
 * @param {string}  title    - Título del popover (opcional)
 * @param {Array}   sections - [{ title, items: [{ icon, label, value }] }]
 * @param {string}  position - 'left' | 'right' (alineación del popover, default 'left')
 */
export default function InfoTooltip({ title, sections = [], position = 'left' }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setVisible(false);
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') setVisible(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [visible]);

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        className={`${styles.trigger} ${visible ? styles.active : ''}`}
        onClick={(e) => { e.stopPropagation(); setVisible(!visible); }}
        type="button"
      >
        {t('modelInfo.recommendedModels')}
      </button>

      <button
        type="button"
        className={styles.canirunLink}
        title={t('modelInfo.canirunTooltip')}
        onClick={(e) => {
          e.stopPropagation();
          if (window.electronAPI?.openExternal) {
            window.electronAPI.openExternal('https://www.canirun.ai/');
          } else {
            window.open('https://www.canirun.ai/', '_blank', 'noreferrer');
          }
        }}
      >
        <MdOpenInNew size={13} />
        {t('modelInfo.canirunLabel')}
      </button>

      {visible && (
        <div className={`${styles.popover} ${position === 'right' ? styles.popoverRight : styles.popoverLeft}`}>
          {title && <p className={styles.popoverTitle}>{title}</p>}

          {sections.map((section, i) => (
            <div key={i} className={`${styles.section} ${i > 0 ? styles.sectionBorder : ''}`}>
              <p className={styles.sectionTitle}>{section.title}</p>
              {section.items.map((item, j) => (
                <div key={j} className={styles.item}>
                  <span className={styles.itemIcon}>{item.icon}</span>
                  <span className={styles.itemLabel}>{item.label}:</span>
                  <code className={styles.itemValue}>{item.value}</code>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
