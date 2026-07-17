import React, { useState } from 'react';
import {
  MdVisibility,
  MdVisibilityOff,
} from 'react-icons/md';
import styles from '../../Settings.module.css';

const EMPTY_DRAFT = { name: '', baseUrl: '', apiKey: '' };

export { EMPTY_DRAFT };

export default function CustomConnectionForm({ draft, setDraft, onSave, onCancel, isEditing, t }) {
  const [showKey, setShowKey] = useState(false);
  const canSave = draft.name.trim() && draft.baseUrl.trim();

  return (
    <div className={styles.formGroup} style={{ marginTop: '16px' }}>
      <div className={styles.inputRow} style={{ marginBottom: '12px' }}>
        <input
          type="text"
          className={styles.input}
          placeholder={t('settings.customConnections.namePlaceholder')}
          value={draft.name}
          onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
        />
        <input
          type="text"
          className={styles.input}
          placeholder={t('settings.customConnections.baseUrlPlaceholder')}
          value={draft.baseUrl}
          onChange={(e) => setDraft((prev) => ({ ...prev, baseUrl: e.target.value }))}
        />
      </div>
      <div className={styles.inputWrapper} style={{ marginBottom: '12px' }}>
        <input
          type={showKey ? 'text' : 'password'}
          className={styles.input}
          placeholder={t('settings.customConnections.apiKeyPlaceholder')}
          value={draft.apiKey}
          onChange={(e) => setDraft((prev) => ({ ...prev, apiKey: e.target.value }))}
        />
        <button
          type="button"
          className={styles.inputIcon}
          onClick={() => setShowKey(!showKey)}
          aria-label={showKey ? t('common.close') : t('common.edit')}
        >
          {showKey ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
        </button>
      </div>
      <div className={styles.inputRow}>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={onSave}
          disabled={!canSave}
        >
          {t('settings.customConnections.saveConnection')}
        </button>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={onCancel}
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
