import React, { useState } from 'react';
import {
  MdComputer, MdRefresh, MdOpenInNew, MdExpandMore, MdExpandLess
} from 'react-icons/md';
import styles from '../../Settings.module.css';
import InfoTooltip from '../../../../components/InfoTooltip/InfoTooltip';
import AiProviderIcon from '../../../../components/AiProviderIcon/AiProviderIcon';
import RoleBadge from './RoleBadge';
import { useSettings } from '../../SettingsContext';

const WIKI_URL = import.meta.env.VITE_WIKI_URL || 'https://rgarciade.github.io/airecorder/vp/';

export default function LocalProvidersSection({ role, defaultOpen = false }) {
  const {
    t,
    aiProvider,
    toggleProvider,
    embeddingProvider,
    toggleEmbeddingProvider,
    // Ollama
    ollamaHost, setOllamaHost,
    ollamaAvailable,
    ollamaModel,
    ollamaModels,
    ollamaRagModel, setOllamaRagModel,
    ollamaEmbeddingModel, setOllamaEmbeddingModel,
    ollamaEmbeddingModels,
    ollamaModelSupportsStreaming,
    ollamaContextLengthSaved, setOllamaContextLengthSaved,
    ollamaCtxStatus, setOllamaCtxStatus,
    handleOllamaModelChange,
    handleDetectOllamaContextLength,
    checkOllamaConnection,
    isCheckingModel,
    // LM Studio
    lmStudioHost, setLmStudioHost,
    lmStudioAvailable,
    lmStudioModel,
    lmStudioModels,
    lmStudioChatModels,
    lmStudioRagModel, setLmStudioRagModel,
    lmStudioEmbeddingModel, setLmStudioEmbeddingModel,
    lmStudioEmbeddingModels,
    lmStudioContextLengthSaved, setLmStudioContextLengthSaved,
    lmStudioCtxStatus, setLmStudioCtxStatus,
    handleLmStudioModelChange,
    handleDetectLmStudioContextLength,
    checkLMStudioConnection,
    isDetectingLmCtx,
  } = useSettings();

  // Role-aware helpers
  const activeProvider = role === 'general' ? aiProvider : embeddingProvider;
  const isProviderActive = (provider) => activeProvider === provider;
  const handleToggle = (provider) => {
    if (role === 'general') {
      toggleProvider(provider);
    } else {
      toggleEmbeddingProvider(provider);
    }
  };
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div
          className={styles.sectionTitleGroup}
          onClick={() => setIsOpen(!isOpen)}
          style={{ cursor: 'pointer' }}
        >
          <MdComputer className={styles.sectionIcon} size={20} />
          <h3 className={styles.sectionTitle}>{t('settings.sections.localProviders')}</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <a
            href={`${WIKI_URL}guide/local-ai`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 500 }}
            onClick={(e) => {
              e.preventDefault();
              if (window.electronAPI && window.electronAPI.openExternal) {
                window.electronAPI.openExternal(`${WIKI_URL}guide/local-ai`);
              }
            }}
          >
            <MdOpenInNew size={14} />
            {t('settings.wikiLink')}
          </a>
          <span className={`${styles.badge} ${['ollama', 'lmstudio'].includes(activeProvider) ? styles.badgeActive : styles.badgeInactive}`}>
           {activeProvider === 'ollama' ? t('settings.providers.ollamaActive') :
            activeProvider === 'lmstudio' ? t('settings.providers.lmStudioActive') : t('settings.providers.inactive')}
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
      {/* Ollama (1st) */}
      <div className={`${styles.card} ${!isProviderActive('ollama') ? styles.cardDisabled : ''}`}>
        <div className={styles.cardHeader}>
          <div className={styles.providerInfo}>
            <div className={`${styles.providerIcon} ${styles.ollamaIcon}`}>
              <AiProviderIcon provider="ollama" size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h4 className={styles.providerName}>Ollama</h4>
                <InfoTooltip
                  title={t('modelInfo.title')}
                  sections={[
                    {
                      title: t('modelInfo.generalModel'),
                      items: [
                        { icon: '⭐', label: t('modelInfo.bestPerformance'), value: 'gemma4:e4b' },
                        { icon: '🪶', label: t('modelInfo.lessResources'), value: 'gemma4:e2b' },
                      ],
                    },
                    {
                      title: t('modelInfo.embedding'),
                      items: [
                        { icon: '⭐', label: t('modelInfo.bestPerformance'), value: 'mxbai-embed-large' },
                        { icon: '🪶', label: t('modelInfo.lessResources'), value: 'nomic-embed-text' },
                      ],
                    },
                  ]}
                />
                <RoleBadge
                  aiProvider={aiProvider}
                  embeddingProvider={embeddingProvider}
                  providerKey="ollama"
                  styles={styles}
                />
              </div>
              <p className={styles.providerDesc}>{t('settings.providers.localInference')}</p>
            </div>
          </div>
          <label className={styles.toggleWrapper}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={isProviderActive('ollama')}
              onChange={() => handleToggle('ollama')}
            />
            <div className={styles.toggleSlider}></div>
          </label>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>{t('settings.fields.hostUrl')}</label>
          <div className={styles.inputRow}>
            <input
              type="text"
              className={styles.input}
              value={ollamaHost}
              onChange={(e) => setOllamaHost(e.target.value)}
              placeholder="http://localhost:11434"
              disabled={!isProviderActive('ollama')}
            />
            <button
              className={styles.checkBtn}
              onClick={() => checkOllamaConnection(ollamaHost)}
              disabled={!isProviderActive('ollama')}
            >
              <MdRefresh size={18} />
              {t('settings.buttons.test')}
            </button>
          </div>
          {!ollamaAvailable ? (
            <p className={styles.errorText}>
              {t('settings.messages.serviceNotDetected', { host: ollamaHost })}
            </p>
          ) : (
            <p className={styles.helpText} style={{ color: 'var(--color-success)' }}>
              {t('settings.messages.serviceConnected')}
            </p>
          )}
        </div>

        {role !== 'embeddings' && (
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('settings.fields.generalModel')}</label>
          <select
            className={styles.input}
            value={ollamaModel}
            onChange={(e) => handleOllamaModelChange(e.target.value)}
            disabled={!isProviderActive('ollama') || !ollamaAvailable || isCheckingModel}
          >
            <option value="" disabled>{t('settings.misc.selectModel')}</option>
            {ollamaModels.map(model => (
              <option key={model.name} value={model.name}>{model.name}</option>
            ))}
          </select>
          {isCheckingModel && (
            <p className={styles.helpText} style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center' }}>
              <MdRefresh className={styles.spinner} style={{ marginRight: '4px' }} />
              {t('settings.messages.verifyingModel')}
            </p>
          )}
          {ollamaModel && !isCheckingModel && (
            <p className={styles.helpText} style={{ color: ollamaModelSupportsStreaming ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {ollamaModelSupportsStreaming ? t('settings.messages.supportsStreaming') : t('settings.messages.noStreaming')}
            </p>
          )}
          <p className={styles.helpText}>{t('settings.helpText.generalModel')}</p>
        </div>
        )}

        {role !== 'embeddings' && (
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('settings.fields.chatModel')}</label>
          <select
            className={styles.input}
            value={ollamaRagModel}
            onChange={(e) => setOllamaRagModel(e.target.value)}
            disabled={!isProviderActive('ollama') || !ollamaAvailable}
          >
            <option value="">{t('settings.misc.useMainModel')}</option>
            {ollamaModels.map(model => (
              <option key={model.name} value={model.name}>{model.name}</option>
            ))}
          </select>
          <p className={styles.helpText}>{t('settings.helpText.chatModel')}</p>
        </div>
        )}

        {role === 'embeddings' && (
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('settings.fields.embeddingModel', { provider: 'Ollama' })}</label>
          <select
            className={styles.input}
            value={ollamaEmbeddingModel}
            onChange={(e) => setOllamaEmbeddingModel(e.target.value)}
            disabled={!isProviderActive('ollama') || !ollamaAvailable}
          >
            {ollamaEmbeddingModels.length === 0 && <option value="">{t('settings.misc.loading')}</option>}
            {ollamaEmbeddingModels.map(model => (
              <option key={model.name} value={model.name}>{model.name}</option>
            ))}
          </select>
          <p className={styles.helpText}>
            {t('settings.helpText.embeddingModel')}
          </p>
        </div>
        )}

        {/* Ventana de Contexto — Ollama */}
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('settings.fields.contextLength')}</label>
          <div className={styles.inputRow}>
            <input
              type="number"
              className={styles.input}
              value={ollamaContextLengthSaved}
              onChange={(e) => { setOllamaContextLengthSaved(e.target.value); setOllamaCtxStatus(null); }}
              placeholder="4096"
              disabled={!isProviderActive('ollama')}
              min="512"
            />
            <button
              className={styles.checkBtn}
              onClick={handleDetectOllamaContextLength}
              disabled={!isProviderActive('ollama') || !ollamaAvailable || !ollamaModel || isCheckingModel}
            >
              <MdRefresh size={18} className={isCheckingModel ? styles.spinner : undefined} />
              {t('settings.buttons.detect')}
            </button>
          </div>
          {ollamaCtxStatus === 'success' && (
            <p className={styles.helpText} style={{ color: 'var(--color-success)' }}>
              {t('settings.messages.contextLengthDetected', { n: parseInt(ollamaContextLengthSaved).toLocaleString() })}
            </p>
          )}
          {ollamaCtxStatus === 'error' && (
            <p className={styles.helpText} style={{ color: 'var(--color-danger)' }}>
              {t('settings.messages.contextLengthNotFound')}
              {' '}<span style={{ color: 'var(--color-text-tertiary)' }}>{t('settings.helpText.contextLengthOllama')}</span>
            </p>
          )}
          {!ollamaCtxStatus && (
            <p className={styles.helpText}>{t('settings.helpText.contextLengthInput')}</p>
          )}
        </div>
      </div>

      {/* LM Studio (2nd) */}
      <div className={`${styles.card} ${!isProviderActive('lmstudio') ? styles.cardDisabled : ''}`} style={{marginTop: '16px'}}>
        <div className={styles.cardHeader}>
          <div className={styles.providerInfo}>
            <div className={`${styles.providerIcon} ${styles.lmStudioIcon}`}>
              <AiProviderIcon provider="lmstudio" size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h4 className={styles.providerName}>LM Studio</h4>
                <InfoTooltip
                  title={t('modelInfo.title')}
                  sections={[
                    {
                      title: t('modelInfo.generalModel'),
                      items: [
                        { icon: '⭐', label: t('modelInfo.bestPerformance'), value: 'gemma4:e4b' },
                        { icon: '🪶', label: t('modelInfo.lessResources'), value: 'gemma4:e2b' },
                      ],
                    },
                    {
                      title: t('modelInfo.embedding'),
                      items: [
                        { icon: '⭐', label: t('modelInfo.bestPerformance'), value: 'mxbai-embed-large' },
                        { icon: '🪶', label: t('modelInfo.lessResources'), value: 'nomic-embed-text' },
                      ],
                    },
                  ]}
                />
                <RoleBadge
                  aiProvider={aiProvider}
                  embeddingProvider={embeddingProvider}
                  providerKey="lmstudio"
                  styles={styles}
                />
              </div>
              <p className={styles.providerDesc}>{t('settings.providers.localServer')}</p>
            </div>
          </div>
          <label className={styles.toggleWrapper}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={isProviderActive('lmstudio')}
              onChange={() => handleToggle('lmstudio')}
            />
            <div className={styles.toggleSlider}></div>
          </label>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>{t('settings.fields.baseUrl')}</label>
          <div className={styles.inputRow}>
            <input
              type="text"
              className={styles.input}
              value={lmStudioHost}
              onChange={(e) => setLmStudioHost(e.target.value)}
              placeholder="http://localhost:1234/v1"
              disabled={!isProviderActive('lmstudio')}
            />
            <button
              className={styles.checkBtn}
              onClick={() => checkLMStudioConnection(lmStudioHost)}
              disabled={!isProviderActive('lmstudio')}
            >
              <MdRefresh size={18} />
              {t('settings.buttons.test')}
            </button>
          </div>
          {!lmStudioAvailable ? (
            <p className={styles.errorText}>
              {t('settings.messages.serviceNotDetected', { host: lmStudioHost })}
            </p>
          ) : (
            <p className={styles.helpText} style={{ color: 'var(--color-success)' }}>
              {t('settings.messages.serviceConnected')}
            </p>
          )}
        </div>

        {role !== 'embeddings' && (
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('settings.fields.generalModel')}</label>
          <select
            className={styles.input}
            value={lmStudioModel}
            onChange={(e) => handleLmStudioModelChange(e.target.value)}
            disabled={!isProviderActive('lmstudio') || !lmStudioAvailable}
          >
            <option value="" disabled>{t('settings.misc.selectModel')}</option>
            {(lmStudioChatModels.length > 0 ? lmStudioChatModels : lmStudioModels).map(model => (
              <option key={model.name} value={model.name}>{model.name}</option>
            ))}
          </select>
          {lmStudioAvailable && lmStudioModels.length === 0 && (
            <p className={styles.helpText} style={{ color: 'var(--color-danger)' }}>
              {t('settings.messages.modelError')}
            </p>
          )}
          <p className={styles.helpText}>{t('settings.helpText.generalModel')}</p>
        </div>
        )}

        {role !== 'embeddings' && (
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('settings.fields.chatModel')}</label>
          <select
            className={styles.input}
            value={lmStudioRagModel}
            onChange={(e) => setLmStudioRagModel(e.target.value)}
            disabled={!isProviderActive('lmstudio') || !lmStudioAvailable}
          >
            <option value="">{t('settings.misc.useMainModel')}</option>
            {(lmStudioChatModels.length > 0 ? lmStudioChatModels : lmStudioModels).map(model => (
              <option key={model.name} value={model.name}>{model.name}</option>
            ))}
          </select>
          <p className={styles.helpText}>{t('settings.helpText.chatModel')}</p>
        </div>
        )}

        {role === 'embeddings' && (
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('settings.fields.embeddingModel', { provider: 'LM Studio' })}</label>
          <select
            className={styles.input}
            value={lmStudioEmbeddingModel}
            onChange={(e) => setLmStudioEmbeddingModel(e.target.value)}
            disabled={!isProviderActive('lmstudio') || !lmStudioAvailable}
          >
            {lmStudioEmbeddingModels.length === 0 && <option value="">{t('settings.misc.noModels')}</option>}
            {lmStudioEmbeddingModels.map(model => (
              <option key={model.name} value={model.name}>{model.name}</option>
            ))}
          </select>
          <p className={styles.helpText}>
            {t('settings.helpText.embeddingModel')}
          </p>
        </div>
        )}

        {/* Ventana de Contexto — LM Studio */}
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('settings.fields.contextLength')}</label>
          <div className={styles.inputRow}>
            <input
              type="number"
              className={styles.input}
              value={lmStudioContextLengthSaved}
              onChange={(e) => { setLmStudioContextLengthSaved(e.target.value); setLmStudioCtxStatus(null); }}
              placeholder="4096"
              disabled={!isProviderActive('lmstudio')}
              min="512"
            />
            <button
              className={styles.checkBtn}
              onClick={handleDetectLmStudioContextLength}
              disabled={!isProviderActive('lmstudio') || !lmStudioAvailable || !lmStudioModel || isDetectingLmCtx}
            >
              <MdRefresh size={18} className={isDetectingLmCtx ? styles.spinner : undefined} />
              {t('settings.buttons.detect')}
            </button>
          </div>
          {lmStudioCtxStatus === 'success' && (
            <p className={styles.helpText} style={{ color: 'var(--color-success)' }}>
              {t('settings.messages.contextLengthDetected', { n: parseInt(lmStudioContextLengthSaved).toLocaleString() })}
            </p>
          )}
          {lmStudioCtxStatus === 'error' && (
            <p className={styles.helpText} style={{ color: 'var(--color-danger)' }}>
              {t('settings.messages.contextLengthNotFound')}
              {' '}<span style={{ color: 'var(--color-text-tertiary)' }}>{t('settings.helpText.contextLengthLmStudio')}</span>
            </p>
          )}
          {!lmStudioCtxStatus && (
            <p className={styles.helpText}>{t('settings.helpText.contextLengthInput')}</p>
          )}
        </div>
      </div>
      </>
      )}
    </section>
  );
}
