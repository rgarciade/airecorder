import React from 'react';
import {
  MdTranslate, MdGraphicEq, MdAutoFixHigh, MdVisibility, MdVisibilityOff
} from 'react-icons/md';
import styles from '../../Settings.module.css';
import { useSettings, mockLanguages, whisperModels } from '../../SettingsContext';

export default function TranscriptionSection() {
  const {
    t,
    selectedLanguage, setSelectedLanguage,
    whisperModel, setWhisperModel,
    cpuThreads, setCpuThreads,
    maxCpuThreads,
    autoTranscribe, setAutoTranscribe,
    autoAnalyze, setAutoAnalyze,
    enableDiarization, setEnableDiarization,
    hfToken, setHfToken,
    speakerSimilarityThreshold, setSpeakerSimilarityThreshold,
    showApiKey, setShowApiKey,
  } = useSettings();

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleGroup}>
          <MdTranslate className={styles.sectionIcon} size={20} />
          <h3 className={styles.sectionTitle}>{t('settings.sections.transcription')}</h3>
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('settings.fields.language')}</label>
          <select
            className={styles.input}
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
          >
            {mockLanguages.map(lang => (
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>
          <p className={styles.helpText}>
            {t('settings.helpText.transcriptionLanguage')}
          </p>
        </div>

        <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
          <label className={styles.label}>{t('settings.fields.whisperModel')}</label>
          <select
            className={styles.input}
            value={whisperModel}
            onChange={(e) => setWhisperModel(e.target.value)}
          >
            {whisperModels.map(model => (
              <option key={model.value} value={model.value}>{t(`settings.whisperModels.${model.value}`)}</option>
            ))}
          </select>
          <p className={styles.helpText}>
            {t('settings.helpText.whisperModel')}
          </p>
        </div>

        <div className={styles.formGroup} style={{ marginBottom: 0 }}>
          <label className={styles.label}>{t('settings.fields.cpuThreads')}</label>
          <select
            className={styles.input}
            value={cpuThreads}
            onChange={(e) => setCpuThreads(parseInt(e.target.value))}
          >
            {Array.from({ length: maxCpuThreads }, (_, i) => i + 1).map(num => (
              <option key={num} value={num}>
                {num} {num === Math.floor(maxCpuThreads / 2) ? t('settings.misc.recommended') : ''} {num === maxCpuThreads ? t('settings.misc.maximum') : ''}
              </option>
            ))}
          </select>
          <p className={styles.helpText}>
            {t('settings.helpText.cpuThreads')}
          </p>
        </div>
      </div>

      {/* Auto-transcripción */}
      <div className={styles.card} style={{marginTop: '16px'}}>
        <div className={styles.cardHeader}>
          <div className={styles.providerInfo}>
            <div className={styles.providerIcon} style={{backgroundColor: '#e0f2fe', color: '#0ea5e9'}}>
              <MdGraphicEq size={24} />
            </div>
            <div>
              <h4 className={styles.providerName}>{t('settings.misc.autoTranscribe.title')}</h4>
              <p className={styles.providerDesc}>{t('settings.misc.autoTranscribe.desc')}</p>
            </div>
          </div>
          <label className={styles.toggleWrapper}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={autoTranscribe}
              onChange={(e) => setAutoTranscribe(e.target.checked)}
            />
            <div className={styles.toggleSlider}></div>
          </label>
        </div>
      </div>

      {/* Auto-análisis IA */}
      <div className={styles.card} style={{marginTop: '16px'}}>
        <div className={styles.cardHeader}>
          <div className={styles.providerInfo}>
            <div className={styles.providerIcon} style={{backgroundColor: '#f0fdf4', color: '#16a34a'}}>
              <MdAutoFixHigh size={24} />
            </div>
            <div>
              <h4 className={styles.providerName}>{t('settings.misc.autoAnalyze.title')}</h4>
              <p className={styles.providerDesc}>{t('settings.misc.autoAnalyze.desc')}</p>
            </div>
          </div>
          <label className={styles.toggleWrapper}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={autoAnalyze}
              onChange={(e) => setAutoAnalyze(e.target.checked)}
            />
            <div className={styles.toggleSlider}></div>
          </label>
        </div>
      </div>

      {/* Diarización de Interlocutores (pyannote.audio) */}
      <div id="diarization-settings" className={styles.card} style={{marginTop: '16px'}}>
        <div className={styles.cardHeader}>
          <div className={styles.providerInfo}>
            <div className={styles.providerIcon} style={{backgroundColor: '#fff7ed', color: '#f97316'}}>
              <MdGraphicEq size={24} />
            </div>
            <div>
              <h4 className={styles.providerName}>Diarización de Interlocutores (Experimental)</h4>
              <p className={styles.providerDesc}>Identifica y separa las voces de distintas personas en el audio del sistema usando pyannote.audio (PyTorch).</p>
            </div>
          </div>
          <label className={styles.toggleWrapper}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={enableDiarization}
              onChange={(e) => setEnableDiarization(e.target.checked)}
            />
            <div className={styles.toggleSlider}></div>
          </label>
        </div>

        {enableDiarization && (
          <div className={styles.formGroup} style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border-subtle)' }}>
            <label className={styles.label}>HuggingFace Access Token</label>
            <div className={styles.inputWrapper}>
              <input
                type={showApiKey ? "text" : "password"}
                className={styles.input}
                placeholder="hf_..."
                value={hfToken}
                onChange={(e) => setHfToken(e.target.value)}
              />
              <button
                className={styles.inputIcon}
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <MdVisibilityOff /> : <MdVisibility />}
              </button>
            </div>
            <p className={styles.helpText}>
              <strong>Sigue estos pasos para configurar la diarización:</strong>
            </p>
            <ol className={styles.helpText} style={{ paddingLeft: '20px', listStyleType: 'decimal' }}>
              <li style={{marginBottom: '4px'}}>
                Ve a <a href="https://huggingface.co/pyannote/speaker-diarization-3.1" target="_blank" rel="noreferrer" style={{color: 'var(--color-primary)', textDecoration: 'underline'}}>pyannote/speaker-diarization-3.1</a> y acepta los términos de uso (haz clic en "Agree and access repository").
              </li>
              <li style={{marginBottom: '4px'}}>
                Haz lo mismo en <a href="https://huggingface.co/pyannote/segmentation-3.0" target="_blank" rel="noreferrer" style={{color: 'var(--color-primary)', textDecoration: 'underline'}}>pyannote/segmentation-3.0</a> (es una dependencia requerida).
              </li>
              <li style={{marginBottom: '4px'}}>
                Crea un Access Token en <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" style={{color: 'var(--color-primary)', textDecoration: 'underline'}}>HuggingFace Settings</a>. Debe ser de tipo <strong>Read</strong>.
              </li>
              <li>Pega el token aquí arriba y guarda los ajustes.</li>
            </ol>
            <p className={styles.helpText} style={{ color: 'var(--color-warning)', fontWeight: 500, marginTop: '12px' }}>
              ⚠️ Nota: La primera vez que se use, la aplicación descargará varios gigabytes de modelos de IA. Ten paciencia y asegúrate de tener una buena conexión.
            </p>

            {/* Slider de umbral de similitud */}
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--color-border-subtle)' }}>
              <label className={styles.label}>
                Umbral de similitud de hablantes
                <span style={{ marginLeft: '8px', fontWeight: 400, color: 'var(--color-text-secondary)' }}>
                  {Math.round(speakerSimilarityThreshold * 100)}%
                </span>
              </label>
              <input
                type="range"
                min="50"
                max="99"
                step="1"
                value={Math.round(speakerSimilarityThreshold * 100)}
                onChange={(e) => setSpeakerSimilarityThreshold(parseInt(e.target.value) / 100)}
                style={{ width: '100%', marginTop: '8px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span className={styles.helpText} style={{ fontSize: '0.75rem' }}>Más permisivo</span>
                <span className={styles.helpText} style={{ fontSize: '0.75rem' }}>Más estricto</span>
              </div>
              <p className={styles.helpText} style={{ marginTop: '8px' }}>
                Valores bajos = más falsos positivos (une voces diferentes). Valores altos = más falsos negativos (separa la misma voz).
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
