import React from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './OverviewTab.module.css';
import { 
  MdAutoAwesome
} from 'react-icons/md';
import ParticipantsList from '../../../../components/ParticipantsList/ParticipantsList';

export default function OverviewTab({ 
  summary, 
  detailedSummary, 
  highlights, 
  participants,
  onAddParticipant,
  onRemoveParticipant,
  onUpdateParticipant
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

  return (
    <div className={styles.container}>
      <div className={styles.mainColumn}>
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
