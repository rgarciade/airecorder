import React, { useRef, useEffect } from 'react';
import { MdVisibility, MdVisibilityOff, MdRefresh } from 'react-icons/md';
import styles from '../../Settings.module.css';
import AiProviderIcon from '../../../../components/AiProviderIcon/AiProviderIcon';
import RoleBadge from './RoleBadge';
import { useSettings } from '../../SettingsContext';
import { GLM_ENDPOINTS } from '../../../../services/ai/glmProvider';

const GLM_ENDPOINT_MODES = ['plan', 'general'];

/**
 * Tarjeta de GLM (Z.AI Coding Plan) de la sección de proveedores cloud.
 * En el rol de embeddings se muestra deshabilitada con un aviso (GLM no ofrece embeddings).
 */
export default function GlmProviderCard({ role, isActive, onToggle }) {
  const {
    t,
    aiProvider,
    embeddingProvider,
    showApiKey, setShowApiKey,
    glmApiKey, setGlmApiKey,
    glmModel, setGlmModel,
    glmModels,
    glmModelsLoading,
    glmModelsNotice,
    loadGlmModels,
    glmEndpointMode, setGlmEndpointMode,
    glmBaseUrl, setGlmBaseUrl,
  } = useSettings();

  const keyTimeoutRef = useRef(null);
  useEffect(() => () => clearTimeout(keyTimeoutRef.current), []);

  const isEmbeddingsRole = role === 'embeddings';

  return (
    <div className={`${styles.card} ${!isActive ? styles.cardDisabled : ''}`} style={{ marginTop: '16px' }}>
      <div className={styles.cardHeader}>
        <div className={styles.providerInfo}>
          <div className={styles.providerIcon} style={{ backgroundColor: '#e0e7ff', color: '#4338ca' }}>
            <AiProviderIcon provider="glm" size={24} />
          </div>
          <div>
            <h4 className={styles.providerName}>GLM</h4>
            <RoleBadge aiProvider={aiProvider} embeddingProvider={embeddingProvider} providerKey="glm" styles={styles} />
            <p className={styles.providerDesc}>{t('settings.providers.glmDesc')}</p>
          </div>
        </div>
        <label className={styles.toggleWrapper}>
          <input
            type="checkbox"
            className={styles.toggleInput}
            checked={isActive}
            disabled={isEmbeddingsRole}
            onChange={onToggle}
          />
          <div className={styles.toggleSlider}></div>
        </label>
      </div>

      {isEmbeddingsRole ? (
        <p className={styles.helpText}>{t('settings.providers.glmEmbeddingNotice')}</p>
      ) : (
        <>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('settings.fields.apiKey')}</label>
            <div className={styles.inputWrapper}>
              <input
                type={showApiKey ? 'text' : 'password'}
                className={styles.input}
                placeholder={t('settings.misc.enterApiKey')}
                value={glmApiKey}
                onChange={(e) => {
                  const newKey = e.target.value;
                  setGlmApiKey(newKey);
                  if (newKey && newKey.length > 10) {
                    clearTimeout(keyTimeoutRef.current);
                    keyTimeoutRef.current = setTimeout(() => {
                      loadGlmModels(newKey);
                    }, 1000);
                  }
                }}
                disabled={!isActive}
              />
              <button className={styles.inputIcon} onClick={() => setShowApiKey(!showApiKey)}>
                {showApiKey ? <MdVisibilityOff /> : <MdVisibility />}
              </button>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t('settings.providers.glmEndpointMode')}</label>
            <select
              className={styles.input}
              value={glmEndpointMode}
              onChange={(e) => {
                setGlmEndpointMode(e.target.value);
                if (glmApiKey) loadGlmModels(glmApiKey, { glmEndpointMode: e.target.value });
              }}
              disabled={!isActive}
            >
              {GLM_ENDPOINT_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {t(`settings.providers.glmEndpointModes.${mode}`)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t('settings.providers.glmBaseUrl')}</label>
            <input
              type="text"
              className={styles.input}
              placeholder={GLM_ENDPOINTS.plan}
              value={glmBaseUrl}
              onChange={(e) => setGlmBaseUrl(e.target.value)}
              onBlur={() => glmApiKey && loadGlmModels(glmApiKey)}
              disabled={!isActive}
            />
            <p className={styles.helpText}>{t('settings.providers.glmBaseUrlHelp')}</p>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t('settings.fields.model')}</label>
            <div className={styles.inputRow}>
              <select
                className={styles.input}
                value={glmModel}
                onChange={(e) => setGlmModel(e.target.value)}
                disabled={!isActive || glmModelsLoading || glmModels.length === 0}
              >
                {glmModels.length === 0 ? (
                  <option value="" disabled>
                    {glmApiKey ? (glmModelsLoading ? t('settings.misc.loading') : t('settings.misc.noModels')) : t('settings.misc.enterApiKey')}
                  </option>
                ) : (
                  glmModels.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.label}
                    </option>
                  ))
                )}
              </select>
              <button
                className={styles.checkBtn}
                onClick={() => loadGlmModels(glmApiKey)}
                disabled={!isActive || !glmApiKey || glmModelsLoading}
              >
                <MdRefresh size={18} className={glmModelsLoading ? styles.spinner : ''} />
                {t('settings.buttons.refresh')}
              </button>
            </div>
            {glmModelsNotice && <p className={styles.helpText}>{glmModelsNotice}</p>}
          </div>
        </>
      )}
    </div>
  );
}
