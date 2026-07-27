import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ContextBar.module.css';
import { CONTEXT_WARNING_RATIO } from '../../services/chat/chatTokens';

// Barra de progreso + tokens + aviso de límite, compartida por las ramas 'rag' y 'full'
// (antes duplicaban ~15 líneas cada una y el aviso solo vivía en 'full').
const ContextUsage = ({ estimatedTokens, maxContextLength, onCompact, compacting, t }) => {
  const pct = Math.min((estimatedTokens / maxContextLength) * 100, 100);
  const ratio = maxContextLength > 0 ? estimatedTokens / maxContextLength : 0;
  const colorClass = pct >= 80 ? styles.red : pct >= 50 ? styles.yellow : styles.green;
  const exceeded = ratio >= 1;
  const near = ratio >= CONTEXT_WARNING_RATIO;

  return (
    <>
      <span className={styles.tokens}>~{estimatedTokens.toLocaleString()} / {maxContextLength.toLocaleString()} {t('contextBar.tokens')}</span>
      <div className={styles.bar}>
        <div className={`${styles.fill} ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      {(near || exceeded) && (
        <span
          className={exceeded ? styles.tokenWarning : styles.tokenNearWarning}
          title={exceeded ? t('contextBar.limitExceededTooltip') : t('contextBar.nearLimitTooltip')}
        >
          {exceeded ? t('contextBar.limitExceeded') : t('contextBar.nearLimit', { pct: Math.round(pct) })}
        </span>
      )}
      {(near || exceeded) && onCompact && (
        <button
          type="button"
          className={styles.compactBtn}
          onClick={onCompact}
          disabled={compacting}
          aria-busy={compacting || undefined}
        >
          {compacting ? t('contextBar.compacting') : t('contextBar.compactAction')}
        </button>
      )}
    </>
  );
};

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

const ContextToggle = ({ chatContextMode, onChatContextModeChange }) => (
  <div className={styles.contextToggle}>
    <div className={`${styles.modeSlider} ${chatContextMode === 'full' ? styles.modeSliderRight : ''}`} />
    <button
      className={`${styles.modeBtn} ${chatContextMode === 'rag' ? styles.modeBtnActive : ''}`}
      onClick={() => onChatContextModeChange('rag')}
      data-tooltip="Busca los fragmentos más relevantes de la transcripción"
    >RAG</button>
    <button
      className={`${styles.modeBtn} ${chatContextMode === 'full' ? styles.modeBtnActive : ''}`}
      onClick={() => onChatContextModeChange('full')}
      data-tooltip="Usa el resumen completo como contexto"
    >Completo</button>
  </div>
);

const TogglesGroup = ({ chatContextMode, onChatContextModeChange, ragMode, onRagModeChange, isProject, t, showModeToggle = false }) => {
  if (!onChatContextModeChange && !onRagModeChange) return null;
  return (
    <div className={styles.togglesGroup}>
      {onRagModeChange && showModeToggle && chatContextMode !== 'full' && (
        <ModeToggle ragMode={ragMode} onRagModeChange={onRagModeChange} isProject={isProject} t={t} />
      )}
      {onChatContextModeChange && (
        <ContextToggle chatContextMode={chatContextMode} onChatContextModeChange={onChatContextModeChange} />
      )}

    </div>
  );
};

const ContextBar = ({ contextInfo, maxContextLength = 8000, ragIndexed, ragTotalChunks = 0, ragMode, onRagModeChange, isProject = false, chatContextMode, onChatContextModeChange, onCompact, compacting = false }) => {
  const { t } = useTranslation();

  // Modo activo: RAG usado en el último mensaje
  if (contextInfo && contextInfo.mode === 'rag') {
    return (
      <div className={styles.container}>
        <span className={`${styles.dot} ${styles.dotActive}`} />
        <span className={styles.label}>
          {t('contextBar.context')} · {contextInfo.chunksUsed} {t('contextBar.chunks')}
        </span>
        <span className={styles.sep}>·</span>
        <ContextUsage estimatedTokens={contextInfo.estimatedTokens} maxContextLength={maxContextLength} onCompact={onCompact} compacting={compacting} t={t} />
        <TogglesGroup chatContextMode={chatContextMode} onChatContextModeChange={onChatContextModeChange} ragMode={ragMode} onRagModeChange={onRagModeChange} isProject={isProject} t={t} />
      </div>
    );
  }

  // Modo completo: resumen completo enviado al LLM
  if (contextInfo && contextInfo.mode === 'full') {
    return (
      <div className={styles.container}>
        <span className={`${styles.dot} ${styles.dotFull}`} />
        <span className={`${styles.label} ${styles.labelMuted}`}>{t('contextBar.fullMode')}</span>
        <span className={styles.sep}>·</span>
        <ContextUsage estimatedTokens={contextInfo.estimatedTokens} maxContextLength={maxContextLength} onCompact={onCompact} compacting={compacting} t={t} />
        <TogglesGroup chatContextMode={chatContextMode} onChatContextModeChange={onChatContextModeChange} ragMode={ragMode} onRagModeChange={onRagModeChange} isProject={isProject} t={t} />
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
        <TogglesGroup chatContextMode={chatContextMode} onChatContextModeChange={onChatContextModeChange} ragMode={ragMode} onRagModeChange={onRagModeChange} isProject={isProject} t={t} showModeToggle />
      </div>
    );
  }

  return null;
};

export default ContextBar;
