import React, { useState, useRef, useEffect } from 'react';
import { MdInfoOutline } from 'react-icons/md';
import styles from './InfoTooltip.module.css';

/**
 * Icono de información con popover que muestra secciones de ayuda.
 * @param {string}  title    - Título del popover (opcional)
 * @param {Array}   sections - [{ title, items: [{ icon, label, value }] }]
 * @param {string}  position - 'left' | 'right' (alineación del popover, default 'left')
 */
export default function InfoTooltip({ title, sections = [], position = 'left' }) {
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
        <MdInfoOutline size={16} />
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
