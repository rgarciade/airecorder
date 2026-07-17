import React, { useEffect } from 'react';
import {
  MdEdit,
  MdDelete,
  MdRefresh,
  MdCheckCircle,
  MdError,
  MdUndo,
} from 'react-icons/md';
import styles from '../../Settings.module.css';

export default function CustomConnectionItem({
  connection,
  isStagedForDelete,
  isActiveForRole,
  isActiveForOtherRole,
  role,
  testResult,
  isTesting,
  onTest,
  onEdit,
  onToggleActive,
  onToggleDelete,
  selectedModel,
  onModelChange,
  t,
}) {
  const badgeKey = isActiveForRole
    ? role === 'chat' ? 'chat' : 'embeddings'
    : isActiveForOtherRole
      ? role === 'chat' ? 'embeddings' : 'chat'
      : null;

  useEffect(() => {
    if (!isActiveForRole || isStagedForDelete) return;
    if (testResult || isTesting) return;
    onTest(connection.id);
  }, [isActiveForRole, isStagedForDelete, testResult, isTesting, onTest, connection.id]);

  const modelLabel = role === 'chat'
    ? t('settings.fields.generalModel')
    : t('settings.fields.embeddingModel', { provider: connection.name });

  return (
    <div
      className={`${styles.card}`}
      style={{
        marginBottom: '12px',
        opacity: isStagedForDelete ? 0.6 : 1,
        borderStyle: isStagedForDelete ? 'dashed' : 'solid',
        borderColor: isActiveForRole ? 'var(--color-success)' : undefined,
      }}
    >
      <div className={styles.cardHeader} style={{ marginBottom: '16px' }}>
        <div className={styles.providerInfo}>
          <div className={styles.providerIcon} style={{ backgroundColor: 'var(--color-layer-frontend-bg)', color: 'var(--color-layer-frontend-text)' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>AI</span>
          </div>
          <div>
            <h4 className={styles.providerName}>{connection.name}</h4>
            <p className={styles.providerDesc}>{connection.baseUrl}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {badgeKey && (
            <span
              className={`${styles.badge} ${isActiveForRole ? styles.badgeActive : ''}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                ...(isActiveForOtherRole && !isActiveForRole ? { borderColor: 'var(--color-info)', color: 'var(--color-info)' } : {}),
              }}
            >
              {isActiveForRole && <MdCheckCircle size={14} />}
              {t(`settings.roles.${badgeKey}`)}
            </span>
          )}
          {testResult?.status === 'success' && (
            <span className={`${styles.badge} ${styles.badgeActive}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MdCheckCircle size={14} />
              {t('settings.customConnections.connected')}
            </span>
          )}
          {testResult?.status === 'error' && (
            <span className={`${styles.badge}`} style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MdError size={14} />
              {t('settings.customConnections.connectionError')}
            </span>
          )}
          {!isStagedForDelete && (
            <button
              type="button"
              className={styles.checkBtn}
              onClick={onEdit}
              disabled={isTesting}
            >
              <MdEdit size={18} />
              {t('common.edit')}
            </button>
          )}
          <button
            type="button"
            className={styles.checkBtn}
            onClick={onToggleDelete}
          >
            {isStagedForDelete ? <MdUndo size={18} /> : <MdDelete size={18} />}
            {isStagedForDelete ? t('settings.customConnections.cancelDelete') : t('common.delete')}
          </button>
          <label className={styles.toggleWrapper}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={isActiveForRole}
              onChange={onToggleActive}
              disabled={isStagedForDelete}
            />
            <div className={styles.toggleSlider}></div>
          </label>
        </div>
      </div>

      <div className={styles.inputRow}>
        <button
          type="button"
          className={styles.checkBtn}
          onClick={() => onTest(connection.id)}
          disabled={isTesting || isStagedForDelete}
        >
          <MdRefresh size={18} className={isTesting ? styles.spinner : ''} />
          {isTesting ? t('settings.customConnections.testing') : t('settings.customConnections.testConnection')}
        </button>
        {testResult?.status === 'success' && testResult.models.length > 0 && (
          <span className={styles.helpText}>
            {testResult.models.length} {t('settings.customConnections.noModels') === 'Sin modelos' ? 'modelos' : 'models'}
          </span>
        )}
        {testResult?.status === 'error' && (
          <span className={styles.errorText}>{testResult.error}</span>
        )}
      </div>

      <div className={styles.formGroup} style={{ marginTop: '12px' }}>
        <label className={styles.label}>{modelLabel}</label>
        <select
          className={styles.input}
          value={selectedModel || ''}
          onChange={(e) => onModelChange(e.target.value || '')}
          disabled={isTesting || isStagedForDelete || !testResult || testResult.models.length === 0}
        >
          <option value="">
            {isTesting
              ? t('settings.customConnections.testing')
              : testResult?.models?.length > 0
                ? t('settings.customConnections.selectModel')
                : t('settings.customConnections.testFirst')}
          </option>
          {testResult?.models?.map((model) => (
            <option key={model.name} value={model.name}>
              {model.label || model.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
