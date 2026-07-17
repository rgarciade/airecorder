import React, { useState, useEffect, useCallback } from 'react';
import { MdAddLink, MdWarning, MdExpandMore, MdExpandLess, MdOpenInNew } from 'react-icons/md';
import styles from '../../Settings.module.css';
import { useSettings } from '../../SettingsContext';
import { isCustom } from '../../../../services/ai/providerRouter';
import ConfirmModal from '../../../../components/ConfirmModal/ConfirmModal';
import CustomConnectionForm, { EMPTY_DRAFT } from './CustomConnectionForm';
import CustomConnectionItem from './CustomConnectionItem';

const WIKI_URL = import.meta.env.VITE_WIKI_URL || 'https://rgarciade.github.io/airecorder/vp/';

export default function CustomConnectionsSection({ role }) {
  const {
    t,
    hasLoadedSettings,
    customConnections,
    stagedDeletions,
    addCustomConnection,
    updateCustomConnection,
    stageDeleteCustomConnection,
    cancelDeleteCustomConnection,
    testCustomConnection,
    testingCustomConnectionId,
    customConnectionTestResults,
    aiProvider,
    setAiProvider,
    embeddingProvider,
    setEmbeddingProvider,
    customChatModel,
    setCustomChatModel,
    embeddingModel,
    setEmbeddingModel,
    customConnectionsSaveValidation,
    embeddingModelChanged,
    isReindexingRag,
    reindexRagMessage,
    handleReindexAllRag,
  } = useSettings();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // Activo en CUALQUIERA de los dos roles (no solo el tab actual) — así el badge
  // cruzado de rol (RoleBadge) sigue siendo visible al cambiar de tab sin sorpresas.
  const isGroupActive = isCustom(aiProvider) || isCustom(embeddingProvider);

  const activeProviderForRole = role === 'chat' ? aiProvider : embeddingProvider;
  const activeConnectionForRole = customConnections.find(
    (c) => activeProviderForRole === `custom:${c.id}`
  );
  const [isOpen, setIsOpen] = useState(isGroupActive);
  useEffect(() => {
    setIsOpen(isGroupActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLoadedSettings]);

  const startAdd = useCallback(() => {
    setDraft(EMPTY_DRAFT);
    setIsAdding(true);
    setEditingId(null);
  }, []);

  const startEdit = useCallback((connection) => {
    setDraft({
      name: connection.name,
      baseUrl: connection.baseUrl,
      apiKey: connection.apiKey,
    });
    setEditingId(connection.id);
    setIsAdding(false);
  }, []);

  const cancelForm = useCallback(() => {
    setIsAdding(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  }, []);

  const saveConnection = useCallback(() => {
    const trimmed = {
      name: draft.name.trim(),
      baseUrl: draft.baseUrl.trim(),
      apiKey: draft.apiKey.trim(),
    };
    if (!trimmed.name || !trimmed.baseUrl) return;

    if (editingId) {
      updateCustomConnection(editingId, trimmed);
    } else {
      addCustomConnection({
        id: crypto.randomUUID(),
        ...trimmed,
      });
    }
    cancelForm();
  }, [draft, editingId, addCustomConnection, updateCustomConnection, cancelForm]);

  const requestDeleteConnection = useCallback((connectionId) => {
    setDeleteTargetId(connectionId);
  }, []);

  const confirmDeleteConnection = useCallback(() => {
    if (deleteTargetId) stageDeleteCustomConnection(deleteTargetId);
    setDeleteTargetId(null);
  }, [deleteTargetId, stageDeleteCustomConnection]);

  const handleChatConnectionChange = useCallback((connectionId) => {
    if (connectionId) {
      setAiProvider(`custom:${connectionId}`);
      if (!customChatModel) setCustomChatModel('');
    } else {
      setAiProvider('');
      setCustomChatModel('');
    }
  }, [setAiProvider, setCustomChatModel, customChatModel]);

  const handleEmbeddingConnectionChange = useCallback((connectionId) => {
    if (connectionId) {
      setEmbeddingProvider(`custom:${connectionId}`);
      if (!embeddingModel) setEmbeddingModel('');
    } else {
      setEmbeddingProvider('');
      setEmbeddingModel('');
    }
  }, [setEmbeddingProvider, setEmbeddingModel, embeddingModel]);

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleGroup}>
          <MdAddLink className={styles.sectionIcon} size={20} />
          <h3 className={styles.sectionTitle}>{t('settings.customConnections.section')}</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={startAdd}
            disabled={isAdding || editingId !== null}
          >
            <MdAddLink size={18} />
            {t('settings.customConnections.addConnection')}
          </button>
          <a
            href={`${WIKI_URL}#ia`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 500 }}
            onClick={(e) => {
              e.preventDefault();
              if (window.electronAPI && window.electronAPI.openExternal) {
                window.electronAPI.openExternal(`${WIKI_URL}#ia`);
              }
            }}
          >
            <MdOpenInNew size={14} />
            {t('settings.wikiLink')}
          </a>
          <span className={`${styles.badge} ${activeConnectionForRole ? styles.badgeActive : styles.badgeInactive}`}>
            {activeConnectionForRole ? activeConnectionForRole.name : t('settings.providers.inactive')}
          </span>
          <button
            type="button"
            className={styles.checkBtn}
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? t('settings.buttons.collapse') : t('settings.buttons.expand')}
          >
            {isOpen ? <MdExpandLess size={18} /> : <MdExpandMore size={18} />}
          </button>
        </div>
      </div>

      {isOpen && (
      <>
      {customConnections.length === 0 && !isAdding && (
        <div className={styles.card} style={{ textAlign: 'center', padding: '32px' }}>
          <p className={styles.helpText}>{t('settings.customConnections.empty')}</p>
        </div>
      )}

      {isAdding && (
        <div className={styles.card}>
          <h4 className={styles.providerName}>{t('settings.customConnections.addConnection')}</h4>
          <CustomConnectionForm
            draft={draft}
            setDraft={setDraft}
            onSave={saveConnection}
            onCancel={cancelForm}
            isEditing={false}
            t={t}
          />
        </div>
      )}

      {customConnections.map((connection) => {
        const isEditing = editingId === connection.id;
        const isStagedForDelete = stagedDeletions.includes(connection.id);
        const isActiveForRole =
          role === 'chat'
            ? aiProvider === `custom:${connection.id}`
            : embeddingProvider === `custom:${connection.id}`;
        const isActiveForOtherRole =
          role === 'chat'
            ? embeddingProvider === `custom:${connection.id}`
            : aiProvider === `custom:${connection.id}`;

        return (
          <React.Fragment key={connection.id}>
            {isEditing ? (
              <div className={styles.card}>
                <h4 className={styles.providerName}>{t('settings.customConnections.editConnection')}</h4>
                <CustomConnectionForm
                  draft={draft}
                  setDraft={setDraft}
                  onSave={saveConnection}
                  onCancel={cancelForm}
                  isEditing
                  t={t}
                />
              </div>
            ) : (
              <CustomConnectionItem
                connection={connection}
                isStagedForDelete={isStagedForDelete}
                isActiveForRole={isActiveForRole}
                isActiveForOtherRole={isActiveForOtherRole}
                role={role}
                testResult={customConnectionTestResults[connection.id]}
                isTesting={testingCustomConnectionId === connection.id}
                onTest={testCustomConnection}
                onEdit={() => startEdit(connection)}
                onToggleActive={() =>
                  role === 'chat'
                    ? handleChatConnectionChange(connection.id)
                    : handleEmbeddingConnectionChange(connection.id)
                }
                onToggleDelete={() =>
                  isStagedForDelete
                    ? cancelDeleteCustomConnection(connection.id)
                    : requestDeleteConnection(connection.id)
                }
                selectedModel={role === 'chat' ? customChatModel : embeddingModel}
                onModelChange={role === 'chat' ? setCustomChatModel : setEmbeddingModel}
                t={t}
              />
            )}
          </React.Fragment>
        );
      })}
      </>
      )}

      <ConfirmModal
        isOpen={deleteTargetId !== null}
        title={t('settings.customConnections.confirmDeleteTitle')}
        message={t('settings.customConnections.confirmDeleteMessage', {
          name: customConnections.find((c) => c.id === deleteTargetId)?.name || '',
        })}
        confirmText={t('common.delete')}
        cancelText={t('settings.customConnections.cancel')}
        isDanger
        onConfirm={confirmDeleteConnection}
        onCancel={() => setDeleteTargetId(null)}
      />

      {role === 'embeddings' && embeddingModelChanged && (
        <div className={styles.card} style={{ marginTop: '16px', borderColor: 'var(--color-warning)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <MdWarning size={20} color="var(--color-warning)" />
            <p className={styles.helpText} style={{ color: 'var(--color-warning)', fontWeight: 500, margin: 0 }}>
              {t('settings.customConnections.reindexWarning')}
            </p>
          </div>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleReindexAllRag}
            disabled={isReindexingRag}
          >
            {isReindexingRag ? t('settings.customConnections.reindexing') : t('settings.customConnections.reindexNow')}
          </button>
          {reindexRagMessage && (
            <p className={styles.helpText} style={{ marginTop: '12px', marginBottom: 0 }}>
              {reindexRagMessage}
            </p>
          )}
        </div>
      )}

      {customConnectionsSaveValidation?.blocked && (
        <div className={styles.card} style={{ marginTop: '16px', borderColor: 'var(--color-danger)' }}>
          <p className={styles.errorText}>{t(customConnectionsSaveValidation.error)}</p>
        </div>
      )}
    </section>
  );
}
