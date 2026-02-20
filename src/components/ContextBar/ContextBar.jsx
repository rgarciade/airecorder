import React from 'react';
import styles from './ContextBar.module.css';

const ModeToggle = ({ ragMode, onRagModeChange }) => (
  <div className={styles.modeToggle}>
    <button
      className={`${styles.modeBtn} ${ragMode === 'auto' ? styles.modeBtnActive : ''}`}
      onClick={() => onRagModeChange('auto')}
      data-tooltip="Reparte el contexto entre todas las grabaciones. Más rápido."
    >Auto</button>
    <button
      className={`${styles.modeBtn} ${ragMode === 'detallado' ? styles.modeBtnActive : ''}`}
      onClick={() => onRagModeChange('detallado')}
      data-tooltip="Busca más fragmentos por grabación. Respuestas más completas."
    >Detallado</button>
  </div>
);

const ContextBar = ({ contextInfo, ragIndexed, ragTotalChunks = 0, ragMode, onRagModeChange }) => {
  // Modo activo: RAG usado en el último mensaje
  if (contextInfo && contextInfo.mode === 'rag') {
    const maxTokens = 8000;
    const pct = Math.min((contextInfo.estimatedTokens / maxTokens) * 100, 100);
    const colorClass = pct >= 80 ? styles.red : pct >= 50 ? styles.yellow : styles.green;

    return (
      <div className={styles.container}>
        <span className={`${styles.dot} ${styles.dotActive}`} />
        <span className={styles.label}>
          Contexto · {contextInfo.chunksUsed} fragmentos
        </span>
        <span className={styles.sep}>·</span>
        <span className={styles.tokens}>~{contextInfo.estimatedTokens.toLocaleString()} tokens</span>
        <div className={styles.bar}>
          <div className={`${styles.fill} ${colorClass}`} style={{ width: `${pct}%` }} />
        </div>
        {onRagModeChange && <ModeToggle ragMode={ragMode} onRagModeChange={onRagModeChange} />}
      </div>
    );
  }

  // Modo completo: transcripción entera enviada al LLM
  if (contextInfo && contextInfo.mode === 'full') {
    const maxTokens = 8000;
    const pct = Math.min((contextInfo.estimatedTokens / maxTokens) * 100, 100);
    const colorClass = pct >= 80 ? styles.red : pct >= 50 ? styles.yellow : styles.green;

    return (
      <div className={styles.container}>
        <span className={`${styles.dot} ${styles.dotFull}`} />
        <span className={`${styles.label} ${styles.labelMuted}`}>Modo completo</span>
        <span className={styles.sep}>·</span>
        <span className={styles.tokens}>~{contextInfo.estimatedTokens.toLocaleString()} tokens</span>
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
        <span className={`${styles.label} ${styles.labelMuted}`}>Preparando contexto...</span>
      </div>
    );
  }

  // Transcripción demasiado corta para RAG
  if (ragIndexed === 'skipped') {
    return (
      <div className={styles.container}>
        <span className={`${styles.dot} ${styles.dotSkipped}`} />
        <span className={`${styles.label} ${styles.labelMuted}`}>Contexto no disponible · transcripción muy corta</span>
      </div>
    );
  }

  // Listo para usar RAG
  if (ragIndexed === true) {
    return (
      <div className={styles.container}>
        <span className={`${styles.dot} ${styles.dotReady}`} />
        <span className={`${styles.label} ${styles.labelMuted}`}>
          Contexto listo{ragTotalChunks > 0 ? ` · ${ragTotalChunks} fragmentos` : ''}
        </span>
        {onRagModeChange && <ModeToggle ragMode={ragMode} onRagModeChange={onRagModeChange} />}
      </div>
    );
  }

  return null;
};

export default ContextBar;
