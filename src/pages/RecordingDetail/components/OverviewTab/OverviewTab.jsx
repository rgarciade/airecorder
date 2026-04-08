import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import styles from './OverviewTab.module.css';
import {
  MdAutoAwesome,
  MdHourglassEmpty,
  MdEditNote,
  MdCheck,
  MdClose
} from 'react-icons/md';
import ParticipantsList from '../../../../components/ParticipantsList/ParticipantsList';

const AI_ENGINE_NAMES = { gemini: 'Gemini Pro', geminifree: 'Gemini Free', deepseek: 'DeepSeek', kimi: 'Kimi' };
const formatAiEngine = (provider, model) => {
  if (!provider) return null;
  return model ? `${AI_ENGINE_NAMES[provider] || provider}: ${model}` : (AI_ENGINE_NAMES[provider] || provider);
};

export default function OverviewTab({
  summary,
  detailedSummary,
  highlights,
  participants,
  onAddParticipant,
  onRemoveParticipant,
  onUpdateParticipant,
  isGeneratingAi,
  hasTranscription,
  aiProvider,
  aiModel,
  extraInstructions,
  onSaveExtraInstructions
}) {
  const { t } = useTranslation();
  const [isEditingInstructions, setIsEditingInstructions] = useState(false);
  const [localInstructions, setLocalInstructions] = useState('');

  const handleStartEdit = () => {
    setLocalInstructions(extraInstructions || '');
    setIsEditingInstructions(true);
  };

  const handleSaveInstructions = () => {
    if (onSaveExtraInstructions) {
      onSaveExtraInstructions(localInstructions);
    }
    setIsEditingInstructions(false);
  };

  const handleCancelEdit = () => {
    setIsEditingInstructions(false);
  };

  // Custom markdown components
  const markdownComponents = {
    p: ({ children }) => <p>{children}</p>,
    h4: ({ children }) => (
      <div className={styles.highlightBox}>
        <div className={styles.highlightTitle}>{children}</div>
      </div>
    ),
    ul: ({ children }) => <ul className={styles.listDisc}>{children}</ul>,
    li: ({ children }) => <li className={styles.listItem}>{children}</li>,
  };

  const hasAiData = summary || (highlights && highlights.length > 0) || detailedSummary;
  const showBlur = isGeneratingAi || (!hasAiData && hasTranscription);

  return (
    <div className={styles.container}>
      {showBlur && (
        <div className={styles.blurOverlay}>
          <div className={styles.loadingContainer}>
            <div className={styles.aiSpinner}>
              <MdAutoAwesome className={styles.spinningIcon} size={48} />
            </div>
            <h3 className={styles.loadingTitle}>
              {isGeneratingAi ? t('recordingDetail.overview.analyzing') : t('recordingDetail.overview.waitingAnalysis')}
            </h3>
            <p className={styles.loadingSubtitle}>
              {isGeneratingAi 
                ? t('recordingDetail.overview.aiExtracting') 
                : t('recordingDetail.overview.analysisPending')}
            </p>
          </div>
        </div>
      )}

      {/* Si NO hay transcripción, mostramos un aviso limpio y simple en lugar de la tarjeta con blur */}
      {!hasTranscription && !isGeneratingAi && !hasAiData && (
        <div className={styles.blurOverlay} style={{ backgroundColor: 'transparent', backdropFilter: 'none' }}>
           <div className={styles.loadingContainer}>
            <div className={styles.aiSpinner} style={{ animation: 'none', opacity: 0.5 }}>
              <MdHourglassEmpty size={48} />
            </div>
            <h3 className={styles.loadingTitle} style={{ color: 'var(--text-secondary)' }}>
              {t('recordingDetail.overview.noTranscription')}
            </h3>
            <p className={styles.loadingSubtitle}>
              {t('recordingDetail.overview.noTranscriptionDesc')}
            </p>
          </div>
        </div>
      )}

      <div className={`${styles.mainColumn} ${(showBlur || (!hasTranscription && !hasAiData)) ? styles.blurredContent : ''}`}>
        <div className={styles.grid}>
          {/* Left Column (Content) */}
          <div className={styles.leftPanel}>
            {/* Quick Summary */}
            <section className={`${styles.card} ${styles.quickSummaryCard}`}>
              <div className={styles.cardHeader} style={{ justifyContent: 'space-between' }}>
                <div className={`${styles.cardTitle} ${styles.quickTitle}`}>
                  <MdAutoAwesome size={20} />
                  {t('common.quickSummary', 'Quick Summary')}
                </div>
                {formatAiEngine(aiProvider, aiModel) && (
                  <span className={styles.aiBadge}>{formatAiEngine(aiProvider, aiModel)}</span>
                )}
              </div>
              <div className={styles.summaryText}>
                <ReactMarkdown>
                  {summary || t('recordingDetail.overview.noHighlights')}
                </ReactMarkdown>
              </div>
            </section>

            {/* Detailed Summary */}
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{t('recordingDetail.overview.detailedSummary')}</h3>
              </div>
              <div className={styles.detailedContent}>
                <ReactMarkdown components={markdownComponents}>
                  {detailedSummary || t('recordingDetail.overview.noHighlights')}
                </ReactMarkdown>
              </div>
            </section>
          </div>

          {/* Right Column (Sidebar info) */}
          <div className={styles.rightPanel}>
            {/* Extra Instructions */}
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{t('recordingDetail.overview.notesAndInstructions')}</h3>
                {!isEditingInstructions && (
                  <button
                    onClick={handleStartEdit}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}
                  >
                    <MdEditNote size={18} />
                    {t('recordingDetail.overview.edit')}
                  </button>
                )}
              </div>
              {isEditingInstructions ? (
                <div>
                  <textarea
                    value={localInstructions}
                    onChange={(e) => setLocalInstructions(e.target.value)}
                    placeholder={t('recordingDetail.overview.placeholder')}
                    style={{
                      width: '100%',
                      minHeight: '80px',
                      resize: 'vertical',
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg-secondary)',
                      color: 'var(--color-text-primary)',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={handleCancelEdit} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                      <MdClose size={14} /> {t('recordingDetail.overview.cancel')}
                    </button>
                    <button onClick={handleSaveInstructions} style={{ background: 'var(--color-primary)', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '600' }}>
                      <MdCheck size={14} /> {t('recordingDetail.overview.save')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.summaryText} style={{ whiteSpace: 'pre-wrap', color: extraInstructions ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontStyle: extraInstructions ? 'normal' : 'italic' }}>
                  {extraInstructions || t('recordingDetail.overview.noInstructions')}
                </div>
              )}
            </section>

            {/* Key Highlights */}
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{t('recordingDetail.overview.keyHighlights')}</h3>
              </div>
              <div className={styles.highlightsList}>
                {highlights && highlights.length > 0 ? (
                  highlights.map((highlight, idx) => (
                    <div key={idx} className={styles.highlightItem}>
                      <div className={styles.highlightDot}></div>
                      <div className={styles.highlightContent}>
                        <ReactMarkdown>
                          {highlight}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={styles.summaryText}>{t('recordingDetail.overview.noHighlights')}</p>
                )}
              </div>
            </section>

            {/* Participants */}
            <section className={styles.card}>
              <ParticipantsList 
                participants={participants}
                onAddParticipant={onAddParticipant}
                onRemoveParticipant={onRemoveParticipant}
                onUpdateParticipant={onUpdateParticipant}
                title={t('recordingDetail.overview.participants')}
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
