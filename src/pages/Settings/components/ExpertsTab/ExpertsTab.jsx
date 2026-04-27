import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MdPsychology, MdCheck, MdRefresh, MdSave } from 'react-icons/md';
import { getSettings, updateSettings } from '../../../../services/settingsService';
import { getAvailableExperts, getDefaultSpecialtyPrompt, invalidateExpertCache } from '../../../../services/ai/promptBuilder';
import styles from './ExpertsTab.module.css';

// ── Definición de las 5 features configurables ────────────────────────────

const FEATURES = [
  {
    key: 'specialty_base',
    labelKey: 'experts.features.base.label',
    hintKey: 'experts.features.base.hint',
    placeholderKey: 'experts.features.base.placeholder',
    isBase: true,
  },
  {
    key: 'short_summary',
    labelKey: 'experts.features.shortSummary.label',
    hintKey: 'experts.features.shortSummary.hint',
    placeholderKey: 'experts.features.shortSummary.placeholder',
  },
  {
    key: 'long_summary',
    labelKey: 'experts.features.longSummary.label',
    hintKey: 'experts.features.longSummary.hint',
    placeholderKey: 'experts.features.longSummary.placeholder',
  },
  {
    key: 'key_points',
    labelKey: 'experts.features.keyPoints.label',
    hintKey: 'experts.features.keyPoints.hint',
    placeholderKey: 'experts.features.keyPoints.placeholder',
  },
  {
    key: 'chat',
    labelKey: 'experts.features.chat.label',
    hintKey: 'experts.features.chat.hint',
    placeholderKey: 'experts.features.chat.placeholder',
  },
  {
    key: 'tasks',
    labelKey: 'experts.features.tasks.label',
    hintKey: 'experts.features.tasks.hint',
    placeholderKey: 'experts.features.tasks.placeholder',
  },
];

// ── Componente principal ──────────────────────────────────────────────────

export default function ExpertsTab() {
  const { t } = useTranslation();

  const [activeExpertId, setActiveExpertId] = useState('developer');
  const [editingExpertId, setEditingExpertId] = useState('developer');
  const [activeFeature, setActiveFeature] = useState('specialty_base');
  const [customizations, setCustomizations] = useState({}); // { feature: text }
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [loading, setLoading] = useState(true);

  const experts = getAvailableExperts();

  // ── Cargar settings y customizaciones iniciales ───────────────────────

  useEffect(() => {
    async function load() {
      const settings = await getSettings();
      const expertId = settings.activeExpert || 'developer';
      setActiveExpertId(expertId);
      setEditingExpertId(expertId);
      await loadCustomizations(expertId);
      setLoading(false);
    }
    load();
  }, []);

  const loadCustomizations = useCallback(async (expertId) => {
    const data = await window.electronAPI.getExpertCustomizations(expertId);
    setCustomizations(data || {});
  }, []);

  // ── Cambiar el experto que se está editando ───────────────────────────

  const handleSelectEditingExpert = async (expertId) => {
    setEditingExpertId(expertId);
    setActiveFeature('specialty_base');
    await loadCustomizations(expertId);
  };

  const handleExpertCardKeyDown = (event, expertId) => {
    // Evita interceptar teclado cuando el foco está en elementos internos (ej. botón Activar)
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSelectEditingExpert(expertId);
    }
  };

  // ── Activar un experto como el modo global de la app ─────────────────

  const handleActivateExpert = async (expertId) => {
    setActiveExpertId(expertId);
    await updateSettings({ activeExpert: expertId });
    invalidateExpertCache();
  };

  // ── Editar el texto de la feature seleccionada ────────────────────────

  const handleTextChange = (value) => {
    setCustomizations(prev => ({ ...prev, [activeFeature]: value }));
  };

  // ── Guardar customización ─────────────────────────────────────────────

  const handleSave = async () => {
    const text = customizations[activeFeature] || '';
    await window.electronAPI.saveExpertCustomization({
      expertId: editingExpertId,
      feature: activeFeature,
      instructions: text,
    });
    invalidateExpertCache();
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  // ── Resetear al original ──────────────────────────────────────────────

  const handleReset = async () => {
    await window.electronAPI.resetExpertCustomization({
      expertId: editingExpertId,
      feature: activeFeature,
    });
    invalidateExpertCache();

    // Limpiamos la customización del estado — para specialty_base,
    // getTextareaValue() mostrará automáticamente el texto de fábrica editable.
    setCustomizations(prev => ({ ...prev, [activeFeature]: '' }));

    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  // ── Valor editable del textarea según la feature ──────────────────────
  // Para specialty_base siempre mostramos el texto real (custom o default),
  // nunca como placeholder, para que el usuario pueda seleccionarlo y editarlo.

  const getTextareaValue = () => {
    const saved = customizations[activeFeature] || '';
    if (!saved && activeFeature === 'specialty_base') {
      return getDefaultSpecialtyPrompt(editingExpertId);
    }
    return saved;
  };

  const getPlaceholder = () => {
    if (activeFeature === 'specialty_base') return '';
    const feature = FEATURES.find(f => f.key === activeFeature);
    return t(feature?.placeholderKey || '');
  };

  if (loading) return null;

  const currentText = getTextareaValue();
  const currentFeatureDef = FEATURES.find(f => f.key === activeFeature);

  return (
    <div>
      {/* ── Selector de experto ──────────────────────────────────────── */}
      <div className={styles.sectionHeader}>
        <MdPsychology className={styles.sectionIcon} size={20} />
        <h3 className={styles.sectionTitle}>{t('experts.sections.mode.title')}</h3>
      </div>
      <p className={styles.sectionDescription}>{t('experts.sections.mode.description')}</p>

      <div className={styles.expertGrid}>
        {experts.map(expert => {
          const isActive = expert.id === activeExpertId;
          const isEditing = expert.id === editingExpertId;
          return (
            <div
              key={expert.id}
              className={`${styles.expertCard} ${isEditing ? styles.expertCardActive : ''}`}
              role="button"
              tabIndex={0}
              aria-pressed={isEditing}
              aria-label={t('experts.sections.customize.title', { expert: t(expert.nameKey) })}
              onClick={() => handleSelectEditingExpert(expert.id)}
              onKeyDown={(event) => handleExpertCardKeyDown(event, expert.id)}
            >
              <span className={styles.expertIcon}>{expert.icon}</span>
              <span className={styles.expertName}>{t(expert.nameKey)}</span>
              <span className={styles.expertDescription}>{t(expert.descriptionKey)}</span>
              {isActive ? (
                <span className={styles.expertActiveBadge}>
                  <MdCheck size={10} />
                  {t('experts.active')}
                </span>
              ) : (
                <button
                  type="button"
                  className={styles.btnSecondary}
                  style={{ marginTop: 4, padding: '4px 12px', fontSize: '0.75rem' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleActivateExpert(expert.id);
                  }}
                >
                  {t('experts.activate')}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <hr className={styles.divider} />

      {/* ── Configurador de indicaciones extras ─────────────────────── */}
      <div className={styles.sectionHeader}>
        <MdPsychology className={styles.sectionIcon} size={20} />
        <h3 className={styles.sectionTitle}>
          {t('experts.sections.customize.title', { expert: t(experts.find(e => e.id === editingExpertId)?.nameKey || '') })}
        </h3>
      </div>
      <p className={styles.sectionDescription}>{t('experts.sections.customize.description')}</p>

      {/* Tabs de features */}
      <div className={styles.featureTabsContainer}>
        {FEATURES.map(feature => {
          const hasContent = !!(customizations[feature.key]?.trim());
          return (
            <button
              type="button"
              key={feature.key}
              className={`${styles.featureTab} ${activeFeature === feature.key ? styles.featureTabActive : ''} ${hasContent ? styles.featureTabHasContent : ''}`}
              onClick={() => setActiveFeature(feature.key)}
            >
              <span className={styles.featureTabDot} />
              {t(feature.labelKey)}
            </button>
          );
        })}
      </div>

      {/* Editor */}
      <div className={styles.editorCard}>
        <div className={styles.editorHeader}>
          <div className={styles.editorLabel}>{t(currentFeatureDef?.labelKey || '')}</div>
          <div className={styles.editorHint}>{t(currentFeatureDef?.hintKey || '')}</div>
        </div>

        <textarea
          className={`${styles.textarea} ${activeFeature === 'specialty_base' ? styles.textareaBase : ''}`}
          value={currentText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={getPlaceholder()}
          spellCheck={false}
        />

        <div className={styles.actions}>
          {savedFeedback && (
            <span className={styles.savedFeedback}>
              <MdCheck size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {t('experts.saved')}
            </span>
          )}
          <button type="button" className={styles.btnSecondary} onClick={handleReset}>
            <MdRefresh size={15} />
            {activeFeature === 'specialty_base'
              ? t('experts.resetToDefault')
              : t('experts.clear')}
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleSave}>
            <MdSave size={15} />
            {t('experts.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
