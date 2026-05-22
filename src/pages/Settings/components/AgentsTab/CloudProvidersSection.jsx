import React from 'react';
import {
  MdCloud, MdAutoAwesome, MdVisibility, MdVisibilityOff, MdRefresh, MdOpenInNew
} from 'react-icons/md';
import styles from '../../Settings.module.css';
import { useSettings } from '../../SettingsContext';

const WIKI_URL = 'https://rgarciade.github.io/airecorder/vp/';

export default function CloudProvidersSection() {
  const {
    t,
    aiProvider,
    toggleProvider,
    showApiKey, setShowApiKey,
    // Gemini Free
    geminiFreeApiKey, setGeminiFreeApiKey,
    geminiFreeModel, setGeminiFreeModel,
    geminiFreeModels,
    geminiFreeModelsLoading,
    loadGeminiModels,
    // Gemini Pro
    geminiApiKey, setGeminiApiKey,
    geminiModel, setGeminiModel,
    geminiModels,
    geminiModelsLoading,
    // DeepSeek
    deepseekApiKey, setDeepseekApiKey,
    deepseekModel, setDeepseekModel,
    deepseekModels,
    // Kimi
    kimiApiKey, setKimiApiKey,
    kimiModel, setKimiModel,
    kimiModels,
  } = useSettings();

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleGroup}>
          <MdCloud className={styles.sectionIcon} size={20} />
          <h3 className={styles.sectionTitle}>{t('settings.sections.cloudProviders')}</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
          <span className={`${styles.badge} ${['geminifree', 'gemini', 'deepseek', 'kimi'].includes(aiProvider) ? styles.badgeActive : styles.badgeInactive}`}>
          {aiProvider === 'geminifree' ? 'Gemini Free' :
           aiProvider === 'gemini' ? 'Gemini Pro' :
           aiProvider === 'deepseek' ? 'DeepSeek' :
           aiProvider === 'kimi' ? 'Kimi' : t('settings.providers.inactive')}
          </span>
        </div>
      </div>

      {/* Gemini Free */}
      <div className={`${styles.card} ${aiProvider !== 'geminifree' ? styles.cardDisabled : ''}`}>
        <div className={styles.cardHeader}>
          <div className={styles.providerInfo}>
            <div className={`${styles.providerIcon} ${styles.geminiIcon}`}>
              <MdAutoAwesome size={24} />
            </div>
            <div>
              <h4 className={styles.providerName}>Gemini Free</h4>
              <p className={styles.providerDesc}>{t('settings.providers.googleFree')}</p>
            </div>
          </div>
          <label className={styles.toggleWrapper}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={aiProvider === 'geminifree'}
              onChange={() => toggleProvider('geminifree')}
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
              value={geminiFreeApiKey}
              onChange={(e) => {
                const newKey = e.target.value;
                setGeminiFreeApiKey(newKey);
                if (newKey && newKey.length > 10) {
                  clearTimeout(window.geminiFreeKeyTimeout);
                  window.geminiFreeKeyTimeout = setTimeout(() => {
                    loadGeminiModels(newKey, true);
                  }, 1000);
                }
              }}
              disabled={aiProvider !== 'geminifree'}
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
          <div className={styles.inputRow}>
            <select
              className={styles.input}
              value={geminiFreeModel}
              onChange={(e) => setGeminiFreeModel(e.target.value)}
              disabled={aiProvider !== 'geminifree' || geminiFreeModelsLoading || geminiFreeModels.length === 0}
            >
              {geminiFreeModels.length === 0 ? (
                <option value="" disabled>
                  {geminiFreeApiKey ? (geminiFreeModelsLoading ? t('settings.misc.loading') : t('settings.misc.noModels')) : t('settings.misc.enterApiKey')}
                </option>
              ) : (
                geminiFreeModels.map(model => (
                  <option key={model.name} value={model.name}>
                    {model.label}
                  </option>
                ))
              )}
            </select>
            <button
              className={styles.checkBtn}
              onClick={() => loadGeminiModels(geminiFreeApiKey, true)}
              disabled={aiProvider !== 'geminifree' || !geminiFreeApiKey || geminiFreeModelsLoading}
            >
              <MdRefresh size={18} className={geminiFreeModelsLoading ? styles.spinner : ''} />
              {t('settings.buttons.refresh')}
            </button>
          </div>
        </div>
      </div>

      {/* Gemini Pro */}
      <div className={`${styles.card} ${aiProvider !== 'gemini' ? styles.cardDisabled : ''}`} style={{marginTop: '16px'}}>
        <div className={styles.cardHeader}>
          <div className={styles.providerInfo}>
            <div className={`${styles.providerIcon} ${styles.geminiIcon}`}>
              <MdAutoAwesome size={24} />
            </div>
            <div>
              <h4 className={styles.providerName}>Gemini Pro</h4>
              <p className={styles.providerDesc}>{t('settings.providers.googlePaid')}</p>
            </div>
          </div>
          <label className={styles.toggleWrapper}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={aiProvider === 'gemini'}
              onChange={() => toggleProvider('gemini')}
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
                    loadGeminiModels(newKey, false);
                  }, 1000);
                }
              }}
              disabled={aiProvider !== 'gemini'}
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
          <div className={styles.inputRow}>
            <select
              className={styles.input}
              value={geminiModel}
              onChange={(e) => setGeminiModel(e.target.value)}
              disabled={aiProvider !== 'gemini' || geminiModelsLoading || geminiModels.length === 0}
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
              onClick={() => loadGeminiModels(geminiApiKey, false)}
              disabled={aiProvider !== 'gemini' || !geminiApiKey || geminiModelsLoading}
            >
              <MdRefresh size={18} className={geminiModelsLoading ? styles.spinner : ''} />
              {t('settings.buttons.refresh')}
            </button>
          </div>
        </div>
      </div>

      {/* DeepSeek */}
      <div className={`${styles.card} ${aiProvider !== 'deepseek' ? styles.cardDisabled : ''}`} style={{marginTop: '16px'}}>
        <div className={styles.cardHeader}>
          <div className={styles.providerInfo}>
            <div className={`${styles.providerIcon}`} style={{backgroundColor: '#dbeafe', color: '#3b82f6'}}>
              <MdAutoAwesome size={24} />
            </div>
            <div>
              <h4 className={styles.providerName}>DeepSeek</h4>
              <p className={styles.providerDesc}>DeepSeek AI</p>
            </div>
          </div>
          <label className={styles.toggleWrapper}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={aiProvider === 'deepseek'}
              onChange={() => toggleProvider('deepseek')}
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
              disabled={aiProvider !== 'deepseek'}
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
            disabled={aiProvider !== 'deepseek'}
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

      {/* Kimi */}
      <div className={`${styles.card} ${aiProvider !== 'kimi' ? styles.cardDisabled : ''}`} style={{marginTop: '16px'}}>
        <div className={styles.cardHeader}>
          <div className={styles.providerInfo}>
            <div className={`${styles.providerIcon}`} style={{backgroundColor: '#fce7f3', color: '#ec4899'}}>
              <MdAutoAwesome size={24} />
            </div>
            <div>
              <h4 className={styles.providerName}>Kimi</h4>
              <p className={styles.providerDesc}>Moonshot AI</p>
            </div>
          </div>
          <label className={styles.toggleWrapper}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={aiProvider === 'kimi'}
              onChange={() => toggleProvider('kimi')}
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
              disabled={aiProvider !== 'kimi'}
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
            value={kimiModel}
            onChange={(e) => setKimiModel(e.target.value)}
            disabled={aiProvider !== 'kimi'}
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
      </div>
    </section>
  );
}
