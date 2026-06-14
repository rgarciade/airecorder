import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MdPlayArrow, MdAutoAwesome, MdRefresh, MdExpandMore, MdExpandLess, MdViewList, MdAccountTree } from 'react-icons/md';
import recordingAiService from '../../../../services/recordingAiService';
import recordingsService from '../../../../services/recordingsService';
import SchemaMindMap from './SchemaMindMap';
import styles from './SchemaTab.module.css';

function formatSeconds(secs) {
  if (secs == null) return null;
  const total = Math.floor(secs);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function SchemaTab({ recordingId, hasTranscription, onSeek }) {
  const { t } = useTranslation();
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [collapsedBranches, setCollapsedBranches] = useState({});
  const [viewMode, setViewMode] = useState('outline'); // 'outline' | 'mindmap'

  const loadSchema = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await recordingsService.getRecordingSchema(recordingId);
      setSchema(data);
    } catch (err) {
      console.error('[SchemaTab] Error loading schema:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [recordingId]);

  useEffect(() => {
    loadSchema();
  }, [loadSchema]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const generated = await recordingAiService.generateEsquema(recordingId);
      if (!generated) throw new Error(t('schema.generateError'));
      await recordingsService.saveRecordingSchema(recordingId, generated);
      setSchema(generated);
    } catch (err) {
      console.error('[SchemaTab] Error generating schema:', err);
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const toggleBranch = (idx) => {
    setCollapsedBranches(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <span>{t('schema.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('schema.title')}</h2>
        <div className={styles.headerActions}>
          {schema && (
            <>
              <div className={styles.viewToggle}>
                <button
                  className={`${styles.viewToggleBtn} ${viewMode === 'outline' ? styles.viewToggleActive : ''}`}
                  onClick={() => setViewMode('outline')}
                  title={t('schema.viewOutline')}
                >
                  <MdViewList size={16} />
                </button>
                <button
                  className={`${styles.viewToggleBtn} ${viewMode === 'mindmap' ? styles.viewToggleActive : ''}`}
                  onClick={() => setViewMode('mindmap')}
                  title={t('schema.viewMindmap')}
                >
                  <MdAccountTree size={16} />
                </button>
              </div>
              <button
                className={styles.regenerateBtn}
                onClick={handleGenerate}
                disabled={generating || !hasTranscription}
                title={t('schema.regenerate')}
              >
                <MdRefresh size={16} />
                {t('schema.regenerate')}
              </button>
            </>
          )}
          {!schema && (
            <button
              className={styles.generateBtn}
              onClick={handleGenerate}
              disabled={generating || !hasTranscription}
            >
              <MdAutoAwesome size={16} />
              {generating ? t('schema.generating') : t('schema.generate')}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner}>{error}</div>
      )}

      {generating && (
        <div className={styles.generatingState}>
          <div className={styles.spinner} />
          <span>{t('schema.generating')}</span>
        </div>
      )}

      {!schema && !generating && (
        <div className={styles.emptyState}>
          <MdAutoAwesome size={40} className={styles.emptyIcon} />
          <p className={styles.emptyText}>{t('schema.empty')}</p>
          {!hasTranscription && (
            <p className={styles.emptyHint}>{t('schema.noTranscription')}</p>
          )}
        </div>
      )}

      {schema && !generating && viewMode === 'mindmap' && (
        <SchemaMindMap
          branches={schema.branches || []}
          title=""
          onSeek={onSeek}
        />
      )}

      {schema && !generating && viewMode === 'outline' && (
        <div className={styles.outline}>
          {(schema.branches || []).map((branch, idx) => (
            <div key={idx} className={styles.branch}>
              <button
                className={styles.branchHeader}
                onClick={() => toggleBranch(idx)}
              >
                <span className={styles.branchTitle}>{branch.title}</span>
                <span className={styles.branchCount}>{branch.items?.length ?? 0}</span>
                {collapsedBranches[idx]
                  ? <MdExpandMore size={18} className={styles.chevron} />
                  : <MdExpandLess size={18} className={styles.chevron} />
                }
              </button>

              {!collapsedBranches[idx] && (
                <ul className={styles.itemList}>
                  {(branch.items || []).map((item, iIdx) => {
                    const ts = formatSeconds(item.start);
                    return (
                      <li key={iIdx} className={styles.item}>
                        {ts !== null && (
                          <button
                            className={styles.seekBtn}
                            onClick={() => onSeek?.(item.start)}
                            title={t('schema.seekTo', { time: ts })}
                            aria-label={t('schema.seekTo', { time: ts })}
                          >
                            <MdPlayArrow size={14} />
                            <span className={styles.timestamp}>{ts}</span>
                          </button>
                        )}
                        {ts === null && (
                          <span className={styles.noTimestamp} aria-hidden="true" />
                        )}
                        <span className={styles.itemLabel}>{item.label}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
