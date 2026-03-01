import React from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './OverviewTab.module.css';
import { 
  MdAutoAwesome,
  MdHourglassEmpty 
} from 'react-icons/md';
import ParticipantsList from '../../../../components/ParticipantsList/ParticipantsList';

export default function OverviewTab({ 
  summary, 
  detailedSummary, 
  highlights, 
  participants,
  onAddParticipant,
  onRemoveParticipant,
  onUpdateParticipant,
  isGeneratingAi,
  hasTranscription
}) {
  
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
              {isGeneratingAi ? 'Analyzing Recording...' : 'Waiting for Analysis'}
            </h3>
            <p className={styles.loadingSubtitle}>
              {isGeneratingAi 
                ? 'AI is extracting insights, summaries, and participants.' 
                : 'Analysis pending or not available.'}
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
              Aún no hay transcripción
            </h3>
            <p className={styles.loadingSubtitle}>
              La inteligencia artificial necesita la transcripción para poder generar el resumen y los temas clave.
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
              <div className={styles.cardHeader}>
                <div className={`${styles.cardTitle} ${styles.quickTitle}`}>
                  <MdAutoAwesome size={20} />
                  Quick Summary
                </div>
              </div>
              <p className={styles.summaryText}>
                {summary || "No quick summary available."}
              </p>
            </section>

            {/* Detailed Summary */}
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Detailed Summary</h3>
              </div>
              <div className={styles.detailedContent}>
                <ReactMarkdown components={markdownComponents}>
                  {detailedSummary || "No detailed summary available."}
                </ReactMarkdown>
              </div>
            </section>
          </div>

          {/* Right Column (Sidebar info) */}
          <div className={styles.rightPanel}>
            {/* Key Highlights */}
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Key Highlights</h3>
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
                  <p className={styles.summaryText}>No highlights available.</p>
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
                title="Participants"
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
