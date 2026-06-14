import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MdPlayArrow, MdAutoAwesome, MdRefresh, MdExpandMore, MdExpandLess, MdViewList, MdAccountTree, MdDownload } from 'react-icons/md';
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
  const [viewMode, setViewMode] = useState('mindmap'); // 'outline' | 'mindmap'
  const mindmapRef = useRef(null);

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

  const handleExportMarkdown = () => {
    if (!schema) return;
    const lines = ['# Meeting Outline\n'];

    function renderChildrenMd(children, depth) {
      const indent = '  '.repeat(depth);
      for (const child of children) {
        const ts = child.start != null
          ? `[${String(Math.floor(child.start / 60)).padStart(2, '0')}:${String(Math.floor(child.start) % 60).padStart(2, '0')}] `
          : '';
        lines.push(`${indent}- ${ts}${child.label}`);
        if (child.children?.length) renderChildrenMd(child.children, depth + 1);
      }
    }

    for (const branch of schema.branches || []) {
      lines.push(`## ${branch.title}`);
      renderChildrenMd(branch.children || branch.items || [], 0);
      lines.push('');
    }
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'esquema.md';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportPng = () => {
    if (mindmapRef.current) {
      mindmapRef.current.exportPng('esquema.png');
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
                onClick={handleExportMarkdown}
                title={t('schema.exportMarkdown')}
              >
                <MdDownload size={15} />
                .md
              </button>
              <button
                className={styles.regenerateBtn}
                onClick={handleExportPng}
                title={t('schema.exportPng')}
                disabled={viewMode !== 'mindmap'}
              >
                <MdDownload size={15} />
                .png
              </button>
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
          ref={mindmapRef}
          branches={schema.branches || []}
          title=""
          onSeek={onSeek}
        />
      )}

      {schema && !generating && viewMode === 'outline' && (
        <div className={styles.outline}>
          {(schema.branches || []).map((branch, idx) => {
            const nodes = branch.children || branch.items || [];

            function renderItems(children, depth) {
              return children.map((item, iIdx) => {
                const ts = formatSeconds(item.start);
                return (
                  <React.Fragment key={iIdx}>
                    <li
                      className={styles.item}
                      style={depth > 0 ? { paddingLeft: `${16 + depth * 20}px` } : undefined}
                    >
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
                    {item.children?.length > 0 && renderItems(item.children, depth + 1)}
                  </React.Fragment>
                );
              });
            }

            return (
              <div key={idx} className={styles.branch}>
                <button
                  className={styles.branchHeader}
                  onClick={() => toggleBranch(idx)}
                >
                  <span className={styles.branchTitle}>{branch.title}</span>
                  <span className={styles.branchCount}>{nodes.length}</span>
                  {collapsedBranches[idx]
                    ? <MdExpandMore size={18} className={styles.chevron} />
                    : <MdExpandLess size={18} className={styles.chevron} />
                  }
                </button>

                {!collapsedBranches[idx] && (
                  <ul className={styles.itemList}>
                    {renderItems(nodes, 0)}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
