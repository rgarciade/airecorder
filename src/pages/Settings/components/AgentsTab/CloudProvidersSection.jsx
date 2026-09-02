import React, { useState } from 'react';
import CodexLoginControls from '../../../../components/CodexLoginControls/CodexLoginControls';
import CodexModelControls from '../../../../components/CodexModelControls/CodexModelControls';
import {
  MdCloud, MdVisibility, MdVisibilityOff, MdRefresh, MdOpenInNew, MdExpandMore, MdExpandLess
} from 'react-icons/md';
import styles from '../../Settings.module.css';
import AiProviderIcon from '../../../../components/AiProviderIcon/AiProviderIcon';
import RoleBadge from './RoleBadge';
import { useSettings } from '../../SettingsContext';
import { CLOUD_PROVIDERS } from '../../../../services/ai/providerRouter';

const WIKI_URL = import.meta.env.VITE_WIKI_URL || 'https://rgarciade.github.io/airecorder/vp/';

const GEMINI_EMBEDDING_MODEL = 'text-embedding-004';
const KIMI_EMBEDDING_MODEL = 'moonshot-embedding-v1';
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';

export default function CloudProvidersSection({ role, defaultOpen = false }) {
  const {
    t,
    aiProvider,
    toggleProvider,
    embeddingProvider,
    toggleEmbeddingProvider,
    showApiKey, setShowApiKey,
    // Codex subscription
    codexModel,
    codexReasoningEffort, setCodexReasoningEffort,
    codexContextLengthSaved, setCodexContextLengthSaved,
    codexModels, codexModelsLoading, codexModelsError,
    loadCodexModels, handleCodexModelChange,
    codexStatus, setCodexStatus,
    // OpenAI
    openaiApiKey, setOpenaiApiKey,
    openaiModel, setOpenaiModel,
    openaiModels,
    openaiModelsLoading,
    loadOpenaiModels,
    // Gemini
    geminiApiKey, setGeminiApiKey,
    geminiModel, setGeminiModel,
    geminiModels,
    geminiModelsLoading,
    loadGeminiModels,
    // DeepSeek
    deepseekApiKey, setDeepseekApiKey,
    deepseekModel, setDeepseekModel,
    deepseekModels,
    // Kimi
    kimiApiKey, setKimiApiKey,
    kimiModel, setKimiModel,
    kimiModels,
  } = useSettings();

  const activeProvider = role === 'general' ? aiProvider : embeddingProvider;
  const handleToggle = (provider) => {
    if (role === 'general') {
      toggleProvider(provider);
    } else {
      toggleEmbeddingProvider(provider);
    }
  };
  const isProviderActive = (provider) => activeProvider === provider;

  const [isOpen, setIsOpen] = useState(defaultOpen);


  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div
          className={styles.sectionTitleGroup}
          onClick={() => setIsOpen(!isOpen)}
          style={{ cursor: 'pointer' }}
        >
          <MdCloud className={styles.sectionIcon} size={20} />
          <h3 className={styles.sectionTitle}>{t('settings.sections.cloudProviders')}</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <a
            href={`${WIKI_URL}guide/cloud-ai`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 500 }}
            onClick={(e) => {
              e.preventDefault();
              if (window.electronAPI && window.electronAPI.openExternal) {
                window.electronAPI.openExternal(`${WIKI_URL}guide/cloud-ai`);
              }
            }}
          >
            <MdOpenInNew size={14} />
            {t('settings.wikiLink')}
          </a>
          <span className={`${styles.badge} ${CLOUD_PROVIDERS.includes(activeProvider) ? styles.badgeActive : styles.badgeInactive}`}>
           {activeProvider === 'gemini' ? t('settings.providers.geminiName') :
            activeProvider === 'deepseek' ? t('settings.providers.deepseekName') :
            activeProvider === 'kimi' ? t('settings.providers.kimiName') :
            activeProvider === 'openai' ? t('settings.providers.openaiName') :
            activeProvider === 'codex' ? t('settings.providers.codexName') : t('settings.providers.inactive')}
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
      {/* Codex / ChatGPT subscription — general generation only */}
      <div className={`${styles.card} ${!isProviderActive('codex') ? styles.cardDisabled : ''}`}>
        <div className={styles.cardHeader}>
          <div className={styles.providerInfo}>
            <div className={styles.providerIcon} style={{ backgroundColor: '#eef2ff', color: '#4f46e5' }}><AiProviderIcon provider="codex" size={24} /></div>
            <div><h4 className={styles.providerName}>Codex</h4><RoleBadge aiProvider={aiProvider} embeddingProvider={embeddingProvider} providerKey="codex" styles={styles} /><p className={styles.providerDesc}>{t('settings.providers.codexDesc')}</p></div>
          </div>
          <label className={styles.toggleWrapper}><input type="checkbox" className={styles.toggleInput} checked={isProviderActive('codex')} disabled={role === 'embeddings'} onChange={() => handleToggle('codex')} /><div className={styles.toggleSlider} /></label>
        </div>
        {role === 'embeddings' ? <p className={styles.helpText}>{t('settings.providers.codexEmbeddingNotice')}</p> : <div className={styles.formGroup}>
          <p className={styles.helpText}>{codexStatus?.available === false ? (codexStatus.error || t('settings.providers.codexUnavailable')) : (codexStatus?.connected ? t('settings.providers.codexConnected') : t('settings.providers.codexLoginInstructions'))}</p>
          <CodexModelControls
            t={t}
            models={codexModels}
            loading={codexModelsLoading}
            error={codexModelsError}
            model={codexModel}
            reasoningEffort={codexReasoningEffort}
            onModelChange={handleCodexModelChange}
            onReasoningEffortChange={setCodexReasoningEffort}
            onRefresh={() => loadCodexModels({ force: true })}
            disabled={!isProviderActive('codex') || !codexStatus?.connected}
            classNames={{
              labelRow: styles.inputRow,
              label: styles.label,
              input: styles.input,
              refresh: styles.checkBtn,
              spinner: styles.spinner,
              help: styles.helpText,
              error: styles.helpText,
              effortGroup: styles.formGroup,
            }}
          />
          <CodexLoginControls t={t} onStatus={setCodexStatus} connected={codexStatus?.connected === true} disabled={!isProviderActive('codex') || codexStatus?.available === false} className={styles.codexLogin} />

          {/* Ventana de Contexto — Codex: sin auto-detección (el SDK/CLI no expone
              este dato por ninguna API, a diferencia de Ollama/LM Studio) — solo
              un input manual, sin botón "detectar" ni estado de éxito/error. */}
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('settings.fields.contextLength')}</label>
            <input
              type="number"
              className={styles.input}
              value={codexContextLengthSaved}
              onChange={(e) => setCodexContextLengthSaved(e.target.value)}
              placeholder="400000"
              disabled={!isProviderActive('codex')}
              min="512"
            />
            <p className={styles.helpText}>{t('settings.helpText.contextLengthCodex')}</p>
          </div>
        </div>}
      </div>

      {/* OpenAI */}
      <div className={`${styles.card} ${!isProviderActive('openai') ? styles.cardDisabled : ''}`} style={{marginTop: '16px'}}>
        <div className={styles.cardHeader}>
          <div className={styles.providerInfo}>
            <div className={`${styles.providerIcon}`} style={{backgroundColor: '#e2e8f0', color: '#10a37f'}}>
              <AiProviderIcon provider="openai" size={24} />
            </div>
            <div>
              <h4 className={styles.providerName}>OpenAI</h4>
              <RoleBadge aiProvider={aiProvider} embeddingProvider={embeddingProvider} providerKey="openai" styles={styles} />
              <p className={styles.providerDesc}>{t('settings.providers.openaiDesc')}</p>
            </div>
          </div>
          <label className={styles.toggleWrapper}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={isProviderActive('openai')}
              onChange={() => handleToggle('openai')}
            />
            <div className={styles.toggleSlider}></div>
          </label>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>{t('settings.fields.apiKey')}</label>
          <div className={styles.inputWrapper}>
            <input
              type={showApiKey ? "text" : "password"}
              className={styles.input}
              placeholder={t('settings.misc.enterApiKey')}
              value={openaiApiKey}
              onChange={(e) => {
                const newKey = e.target.value;
                setOpenaiApiKey(newKey);
                if (newKey && newKey.length > 10) {
                  clearTimeout(window.openaiKeyTimeout);
                  window.openaiKeyTimeout = setTimeout(() => {
                    loadOpenaiModels(newKey);
                  }, 1000);
                }
              }}
              disabled={!isProviderActive('openai')}
            />
            <button
              className={styles.inputIcon}
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? <MdVisibilityOff /> : <MdVisibility />}
            </button>
          </div>
        </div>

        {role === 'embeddings' ? (
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('settings.providers.embeddingModelLabel')}</label>
            <p className={styles.helpText} style={{ color: 'var(--color-text-secondary)' }}>
              {OPENAI_EMBEDDING_MODEL}
            </p>
          </div>
        ) : (
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('settings.fields.model')}</label>
            <div className={styles.inputRow}>
              <select
                className={styles.input}
                value={openaiModel}
                onChange={(e) => setOpenaiModel(e.target.value)}
                disabled={!isProviderActive('openai') || openaiModelsLoading || openaiModels.length === 0}
              >
                {openaiModels.length === 0 ? (
                  <option value="" disabled>
                    {openaiApiKey ? (openaiModelsLoading ? t('settings.misc.loading') : t('settings.misc.noModels')) : t('settings.misc.enterApiKey')}
                  </option>
                ) : (
                  openaiModels.map(model => (
                    <option key={model.name} value={model.name}>
                      {model.label}
                    </option>
                  ))
                )}
              </select>
              <button
                className={styles.checkBtn}
                onClick={() => loadOpenaiModels(openaiApiKey)}
                disabled={!isProviderActive('openai') || !openaiApiKey || openaiModelsLoading}
              >
                <MdRefresh size={18} className={openaiModelsLoading ? styles.spinner : ''} />
                {t('settings.buttons.refresh')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Gemini */}
      <div className={`${styles.card} ${!isProviderActive('gemini') ? styles.cardDisabled : ''}`} style={{marginTop: '16px'}}>
        <div className={styles.cardHeader}>
          <div className={styles.providerInfo}>
            <div className={`${styles.providerIcon} ${styles.geminiIcon}`}>
              <AiProviderIcon provider="gemini" size={24} />
            </div>
            <div>
              <h4 className={styles.providerName}>Gemini</h4>
              <RoleBadge aiProvider={aiProvider} embeddingProvider={embeddingProvider} providerKey="gemini" styles={styles} />
              <p className={styles.providerDesc}>{t('settings.providers.google')}</p>
            </div>
          </div>
          <label className={styles.toggleWrapper}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={isProviderActive('gemini')}
              onChange={() => handleToggle('gemini')}
            />
            <div className={styles.toggleSlider}></div>
          </label>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>{t('settings.fields.apiKey')}</label>
          <div className={styles.inputWrapper}>
            <input
              type={showApiKey ? "text" : "password"}
              className={styles.input}
              placeholder={t('settings.misc.enterApiKey')}
              value={geminiApiKey}
              onChange={(e) => {
                const newKey = e.target.value;
                setGeminiApiKey(newKey);
                if (newKey && newKey.length > 10) {
                  clearTimeout(window.geminiKeyTimeout);
                  window.geminiKeyTimeout = setTimeout(() => {
                    loadGeminiModels(newKey);
                  }, 1000);
                }
              }}
              disabled={!isProviderActive('gemini')}
            />
            <button
              className={styles.inputIcon}
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? <MdVisibilityOff /> : <MdVisibility />}
            </button>
          </div>
        </div>

        {role === 'embeddings' ? (
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('settings.providers.embeddingModelLabel')}</label>
            <p className={styles.helpText} style={{ color: 'var(--color-text-secondary)' }}>
              {GEMINI_EMBEDDING_MODEL}
            </p>
          </div>
        ) : (
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('settings.fields.model')}</label>
            <div className={styles.inputRow}>
              <select
                className={styles.input}
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                disabled={!isProviderActive('gemini') || geminiModelsLoading || geminiModels.length === 0}
              >
                {geminiModels.length === 0 ? (
                  <option value="" disabled>
                    {geminiApiKey ? (geminiModelsLoading ? t('settings.misc.loading') : t('settings.misc.noModels')) : t('settings.misc.enterApiKey')}
                  </option>
                ) : (
                  geminiModels.map(model => (
                    <option key={model.name} value={model.name}>
                      {model.label}
                    </option>
                  ))
                )}
              </select>
              <button
                className={styles.checkBtn}
                onClick={() => loadGeminiModels(geminiApiKey)}
                disabled={!isProviderActive('gemini') || !geminiApiKey || geminiModelsLoading}
              >
                <MdRefresh size={18} className={geminiModelsLoading ? styles.spinner : ''} />
                {t('settings.buttons.refresh')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DeepSeek — hidden in embeddings tab */}
      {role !== 'embeddings' && (
      <div className={`${styles.card} ${!isProviderActive('deepseek') ? styles.cardDisabled : ''}`} style={{marginTop: '16px'}}>
        <div className={styles.cardHeader}>
          <div className={styles.providerInfo}>
            <div className={`${styles.providerIcon}`} style={{backgroundColor: '#dbeafe', color: '#3b82f6'}}>
              <AiProviderIcon provider="deepseek" size={24} />
            </div>
            <div>
              <h4 className={styles.providerName}>DeepSeek</h4>
              <RoleBadge aiProvider={aiProvider} embeddingProvider={embeddingProvider} providerKey="deepseek" styles={styles} />
              <p className={styles.providerDesc}>DeepSeek AI</p>
            </div>
          </div>
          <label className={styles.toggleWrapper}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={isProviderActive('deepseek')}
              onChange={() => handleToggle('deepseek')}
            />
            <div className={styles.toggleSlider}></div>
          </label>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>{t('settings.fields.apiKey')}</label>
          <div className={styles.inputWrapper}>
            <input
              type={showApiKey ? "text" : "password"}
              className={styles.input}
              placeholder={t('settings.misc.enterApiKey')}
              value={deepseekApiKey}
              onChange={(e) => setDeepseekApiKey(e.target.value)}
              disabled={!isProviderActive('deepseek')}
            />
            <button
              className={styles.inputIcon}
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? <MdVisibilityOff /> : <MdVisibility />}
            </button>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>{t('settings.fields.model')}</label>
          <select
            className={styles.input}
            value={deepseekModel}
            onChange={(e) => setDeepseekModel(e.target.value)}
            disabled={!isProviderActive('deepseek')}
          >
            {deepseekModels.map(model => (
              <option key={model.name} value={model.name}>
                {model.label}
              </option>
            ))}
          </select>
          <p className={styles.helpText} style={{ color: 'var(--color-success)' }}>
            ✓ {deepseekModels.find(m => m.name === deepseekModel)?.description}
          </p>
        </div>
      </div>
      )}

      {/* Kimi */}
      <div className={`${styles.card} ${!isProviderActive('kimi') ? styles.cardDisabled : ''}`} style={{marginTop: '16px'}}>
        <div className={styles.cardHeader}>
          <div className={styles.providerInfo}>
            <div className={`${styles.providerIcon}`} style={{backgroundColor: '#fce7f3', color: '#ec4899'}}>
              <AiProviderIcon provider="kimi" size={24} />
            </div>
            <div>
              <h4 className={styles.providerName}>Kimi</h4>
              <RoleBadge aiProvider={aiProvider} embeddingProvider={embeddingProvider} providerKey="kimi" styles={styles} />
              <p className={styles.providerDesc}>Moonshot AI</p>
            </div>
          </div>
          <label className={styles.toggleWrapper}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={isProviderActive('kimi')}
              onChange={() => handleToggle('kimi')}
            />
            <div className={styles.toggleSlider}></div>
          </label>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>{t('settings.fields.apiKey')}</label>
          <div className={styles.inputWrapper}>
            <input
              type={showApiKey ? "text" : "password"}
              className={styles.input}
              placeholder={t('settings.misc.enterApiKey')}
              value={kimiApiKey}
              onChange={(e) => setKimiApiKey(e.target.value)}
              disabled={!isProviderActive('kimi')}
            />
            <button
              className={styles.inputIcon}
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? <MdVisibilityOff /> : <MdVisibility />}
            </button>
          </div>
        </div>

        {role === 'embeddings' ? (
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('settings.providers.embeddingModelLabel')}</label>
            <p className={styles.helpText} style={{ color: 'var(--color-text-secondary)' }}>
              {KIMI_EMBEDDING_MODEL}
            </p>
          </div>
        ) : (
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('settings.fields.model')}</label>
            <select
              className={styles.input}
              value={kimiModel}
              onChange={(e) => setKimiModel(e.target.value)}
              disabled={!isProviderActive('kimi')}
            >
              {kimiModels.map(model => (
                <option key={model.name} value={model.name}>
                  {model.label}
                </option>
              ))}
            </select>
            <p className={styles.helpText} style={{ color: 'var(--color-success)' }}>
              ✓ {kimiModels.find(m => m.name === kimiModel)?.description}
            </p>
          </div>
        )}
      </div>
      </>
      )}
    </section>
  );
}
