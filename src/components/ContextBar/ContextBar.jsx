import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ContextBar.module.css';

const ModeToggle = ({ ragMode, onRagModeChange, isProject, t }) => (
  <div className={styles.modeToggle}>
    <div className={`${styles.modeSlider} ${ragMode === 'detallado' ? styles.modeSliderRight : ''}`} />
    <button
      className={`${styles.modeBtn} ${ragMode === 'auto' ? styles.modeBtnActive : ''}`}
      onClick={() => onRagModeChange('auto')}
      data-tooltip={isProject ? t('contextBar.tooltips.projectAuto') : t('contextBar.tooltips.recordingAuto')}
    >{t('contextBar.auto')}</button>
    <button
      className={`${styles.modeBtn} ${ragMode === 'detallado' ? styles.modeBtnActive : ''}`}
      onClick={() => onRagModeChange('detallado')}
      data-tooltip={isProject ? t('contextBar.tooltips.projectDetailed') : t('contextBar.tooltips.recordingDetailed')}
    >{t('contextBar.detailed')}</button>
  </div>
);

const ContextBar = ({ contextInfo, maxContextLength = 8000, ragIndexed, ragTotalChunks = 0, ragMode, onRagModeChange, isProject = false }) => {
  const { t } = useTranslation();
  
  // Modo activo: RAG usado en el último mensaje
  if (contextInfo && contextInfo.mode === 'rag') {
    const pct = Math.min((contextInfo.estimatedTokens / maxContextLength) * 100, 100);
    const colorClass = pct >= 80 ? styles.red : pct >= 50 ? styles.yellow : styles.green;

    return (
      <div className={styles.container}>
        <span className={`${styles.dot} ${styles.dotActive}`} />
        <span className={styles.label}>
          {t('contextBar.context')} · {contextInfo.chunksUsed} {t('contextBar.chunks')}
        </span>
        <span className={styles.sep}>·</span>
        <span className={styles.tokens}>~{contextInfo.estimatedTokens.toLocaleString()} / {maxContextLength.toLocaleString()} {t('contextBar.tokens')}</span>
        <div className={styles.bar}>
          <div className={`${styles.fill} ${colorClass}`} style={{ width: `${pct}%` }} />
        </div>
        {onRagModeChange && <ModeToggle ragMode={ragMode} onRagModeChange={onRagModeChange} isProject={isProject} t={t} />}
      </div>
    );
  }

  // Modo completo: transcripción entera enviada al LLM
  if (contextInfo && contextInfo.mode === 'full') {
    const pct = Math.min((contextInfo.estimatedTokens / maxContextLength) * 100, 100);
    const colorClass = pct >= 80 ? styles.red : pct >= 50 ? styles.yellow : styles.green;

    return (
      <div className={styles.container}>
        <span className={`${styles.dot} ${styles.dotFull}`} />
        <span className={`${styles.label} ${styles.labelMuted}`}>{t('contextBar.fullMode')}</span>
        <span className={styles.sep}>·</span>
        <span className={styles.tokens}>~{contextInfo.estimatedTokens.toLocaleString()} / {maxContextLength.toLocaleString()} {t('contextBar.tokens')}</span>
        <div className={styles.bar}>
          <div className={`${styles.fill} ${colorClass}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  // Indexando en background
  if (ragIndexed === false) {
    return (
      <div className={styles.container}>
        <span className={`${styles.dot} ${styles.dotIndexing}`} />
        <span className={`${styles.label} ${styles.labelMuted}`}>{t('contextBar.indexing')}</span>
      </div>
    );
  }

  // Transcripción demasiado corta para RAG
  if (ragIndexed === 'skipped') {
    return (
      <div className={styles.container}>
        <span className={`${styles.dot} ${styles.dotSkipped}`} />
        <span className={`${styles.label} ${styles.labelMuted}`}>{t('contextBar.skipped')}</span>
      </div>
    );
  }

  // Listo para usar RAG
  if (ragIndexed === true) {
    return (
      <div className={styles.container}>
        <span className={`${styles.dot} ${styles.dotReady}`} />
        <span className={`${styles.label} ${styles.labelMuted}`}>
          {t('contextBar.ready')}{ragTotalChunks > 0 ? ` · ${ragTotalChunks} ${t('contextBar.chunks')}` : ''}
        </span>
        {onRagModeChange && <ModeToggle ragMode={ragMode} onRagModeChange={onRagModeChange} isProject={isProject} t={t} />}
      </div>
    );
  }

  return null;
};

export default ContextBar;
