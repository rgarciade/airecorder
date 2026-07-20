import React from 'react';
import { FaExternalLinkAlt, FaBrain, FaSearch, FaArrowRight, FaShieldAlt } from 'react-icons/fa';
import OnboardingFooter from './OnboardingFooter';
import AiProviderIcon from '../../components/AiProviderIcon/AiProviderIcon';

const WIKI_BASE_URL = import.meta.env.VITE_WIKI_URL || 'https://rgarciade.github.io/airecorder/vp/';

const LocalAiInfoStep = ({ t, onNext, onBack, StepProgressComponent }) => {
  const handleOpenDocs = (e) => {
    e.preventDefault();
    const url = `${WIKI_BASE_URL}guide/local-ai`;
    if (window.electronAPI && window.electronAPI.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-surface-primary overflow-hidden">

      {/* Scrollable Container (Only this scrolls) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="max-w-6xl mx-auto w-full px-8 py-8 flex flex-col h-full">

          {/* Step Progress */}
          {StepProgressComponent && <div className="mb-3 shrink-0">{StepProgressComponent}</div>}

          {/* Header */}
          <div className="text-center mb-8 shrink-0">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-blue-600 mb-4 shadow-sm">
              <FaShieldAlt size={28} />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-content-primary mb-3">{t('onboarding.aiInfo.title')}</h1>
            <p className="text-slate-500 dark:text-content-secondary text-lg max-w-2xl mx-auto leading-relaxed">
              {t('onboarding.aiInfo.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 min-h-0 pb-4 overflow-y-auto -mr-4 pr-4">
            {/* Left Column: What and Tools */}
            <div className="flex flex-col gap-6">
            <div className="bg-white dark:bg-surface-secondary rounded-2xl p-6 border border-slate-200 dark:border-edge-primary shadow-sm shrink-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-content-primary mb-2 flex items-center gap-2">
                {t('onboarding.aiInfo.whatIsLocalAi')}
              </h3>
              <p className="text-slate-600 dark:text-content-secondary text-sm leading-relaxed">
                {t('onboarding.aiInfo.whatIsLocalAiDesc')}
              </p>
            </div>

            <div className="bg-white dark:bg-surface-secondary rounded-2xl p-6 border border-slate-200 dark:border-edge-primary shadow-sm flex-1 shrink-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-content-primary mb-4">{t('onboarding.aiInfo.tools')}</h3>

              <div className="flex flex-col gap-4">
                <div className="flex gap-4 p-4 rounded-xl bg-slate-50 dark:bg-surface-tertiary border border-slate-100 dark:border-edge-primary">
                  <div className="w-10 h-10 rounded-xl border shadow-sm flex items-center justify-center flex-shrink-0 text-lg text-slate-900 dark:text-content-primary"
                    style={{ backgroundColor: 'var(--color-bg-primary)', borderColor: 'var(--color-border-primary)' }}>
                    <AiProviderIcon provider="ollama" size={22} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-content-primary mb-1">Ollama</h4>
                    <p className="text-xs text-slate-500 dark:text-content-secondary leading-relaxed">{t('onboarding.aiInfo.ollamaDesc')}</p>
                  </div>
                </div>

                <div className="flex gap-4 p-4 rounded-xl bg-slate-50 dark:bg-surface-tertiary border border-slate-100 dark:border-edge-primary">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-surface-secondary border border-slate-200 dark:border-edge-primary shadow-sm flex items-center justify-center flex-shrink-0 text-lg">
                    <AiProviderIcon provider="lmstudio" className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-content-primary mb-1">LM Studio</h4>
                    <p className="text-xs text-slate-500 dark:text-content-secondary leading-relaxed">{t('onboarding.aiInfo.lmstudioDesc')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Models and Docs */}
          <div className="flex flex-col gap-6">
            <div className="bg-white dark:bg-surface-secondary rounded-2xl p-6 border border-slate-200 dark:border-edge-primary shadow-sm flex-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-content-primary mb-4">{t('onboarding.aiInfo.models')}</h3>

              <div className="flex flex-col gap-5">
                <div className="flex gap-3">
                  <div className="mt-1 text-blue-500">
                    <FaBrain size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-content-primary text-sm mb-1">{t('onboarding.aiInfo.normalModels')}</h4>
                    <p className="text-xs text-slate-500 dark:text-content-secondary leading-relaxed">{t('onboarding.aiInfo.normalModelsDesc')}</p>
                    <div className="mt-2 flex gap-2">
                      <span className="text-[10px] font-mono bg-slate-100 dark:bg-surface-tertiary px-2 py-1 rounded text-slate-600 dark:text-content-secondary">gemma4:e4b</span>
                      <span className="text-[10px] font-mono bg-slate-100 dark:bg-surface-tertiary px-2 py-1 rounded text-slate-600 dark:text-content-secondary">gemma4:e2b</span>
                    </div>
                  </div>
                </div>

                <div className="h-px w-full bg-slate-100 dark:bg-surface-tertiary"></div>

                <div className="flex gap-3">
                  <div className="mt-1 text-emerald-500">
                    <FaSearch size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-content-primary text-sm mb-1">{t('onboarding.aiInfo.embeddingModels')}</h4>
                    <p className="text-xs text-slate-500 dark:text-content-secondary leading-relaxed">{t('onboarding.aiInfo.embeddingModelsDesc')}</p>
                    <div className="mt-2 flex gap-2">
                      <span className="text-[10px] font-mono bg-slate-100 dark:bg-surface-tertiary px-2 py-1 rounded text-slate-600 dark:text-content-secondary">nomic-embed-text</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Docs CTA */}
            <div className="bg-blue-50 dark:bg-surface-tertiary rounded-2xl p-6 border border-blue-100 dark:border-edge-primary relative overflow-hidden group">

              <div className="relative z-10 flex flex-col items-start gap-3">
                <div>
                  <h4 className="font-bold text-blue-900 dark:text-content-primary mb-1">{t('onboarding.aiInfo.noInstallTitle', '¿No tienes nada instalado?')}</h4>
                  <p className="text-sm text-blue-700 dark:text-content-secondary mb-4">{t('onboarding.aiInfo.noInstallDesc', 'Recomendamos pausar un momento, seguir nuestra guía e instalar Ollama antes de continuar.')}</p>
                </div>
                <button
                  onClick={handleOpenDocs}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors shadow-sm"
                >
                  <FaExternalLinkAlt size={12} />
                  {t('onboarding.aiInfo.docsBtn')}
                </button>
                <span className="text-xs text-blue-500 dark:text-content-secondary font-medium">{t('onboarding.aiInfo.docsNote')}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    {/* Footer */}
      <OnboardingFooter onBack={onBack} t={t}>
        <div className="flex items-center gap-6">
          <button
            onClick={onNext}
            className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white transition-all shadow-md hover:shadow-lg bg-slate-800 hover:bg-slate-900 transform hover:-translate-y-0.5"
          >
            {t('onboarding.aiInfo.nextStep')} <FaArrowRight />
          </button>
        </div>
      </OnboardingFooter>
    </div>
  );
};

export default LocalAiInfoStep;
