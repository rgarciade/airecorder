import React from 'react';
import { FaServer, FaArrowRight, FaComments, FaLayerGroup } from 'react-icons/fa';
import { MdCloud } from 'react-icons/md';
import OnboardingFooter from '../OnboardingFooter';
import LocalProviderCards from './LocalProviderCards';
import CloudProviderCards from './CloudProviderCards';
import CustomConnectionCard from './CustomConnectionCard';

const AiConfigStep = ({
  t,
  activeAiRole,
  setActiveAiRole,
  providerType,
  setProviderType,
  aiProvider,
  setAiProvider,
  ctx,
  canProceed,
  onBack,
  onNext,
  StepProgressComponent
}) => {

  const handleTabLocal = () => {
    setProviderType('local');
    setAiProvider('ollama');
  };

  const handleTabCloud = () => {
    setProviderType('cloud');
    setAiProvider('openai');
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-surface-primary overflow-hidden">
      <div className="flex-1 max-w-6xl mx-auto w-full px-8 py-8 flex flex-col overflow-y-auto">

        {StepProgressComponent && <div className="mb-3">{StepProgressComponent}</div>}

        <div className="text-center mb-5">
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-content-primary mb-3">{t('onboarding.ai.title')}</h1>
          <p className="text-slate-500 dark:text-content-secondary text-lg max-w-2xl mx-auto leading-relaxed">
            {t('onboarding.ai.subtitle')}
          </p>
        </div>

        {/* Role Switcher — General / Embeddings */}
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-surface-tertiary rounded-xl mb-4 max-w-sm mx-auto w-full">
          <button
            onClick={() => setActiveAiRole('general')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-semibold text-sm transition-all
              ${activeAiRole === 'general' ? 'bg-white dark:bg-surface-secondary text-slate-900 dark:text-content-primary shadow-sm' : 'text-slate-500 dark:text-content-secondary hover:text-slate-700 dark:hover:text-content-primary'}`}
          >
            <FaComments size={12} /> {t('settings.agentsTabs.general')}
          </button>
          <button
            onClick={() => setActiveAiRole('embeddings')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-semibold text-sm transition-all
              ${activeAiRole === 'embeddings' ? 'bg-white dark:bg-surface-secondary text-slate-900 dark:text-content-primary shadow-sm' : 'text-slate-500 dark:text-content-secondary hover:text-slate-700 dark:hover:text-content-primary'}`}
          >
            <FaLayerGroup size={12} /> {t('settings.agentsTabs.embeddings')}
          </button>
        </div>
        <p className="text-center text-xs text-slate-400 dark:text-content-secondary mb-5 max-w-md mx-auto">
          {activeAiRole === 'general' ? t('onboarding.ai.roles.generalHelp') : t('onboarding.ai.roles.embeddingsHelp')}
        </p>

        {/* Tab Switcher — Local / Cloud */}
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-surface-tertiary rounded-xl mb-6 max-w-md mx-auto w-full">
          <button
            onClick={handleTabLocal}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all
              ${providerType === 'local' ? 'bg-white dark:bg-surface-secondary text-slate-900 dark:text-content-primary shadow-sm' : 'text-slate-500 dark:text-content-secondary hover:text-slate-700 dark:hover:text-content-primary'}`}
          >
            <FaServer size={13} /> {t('onboarding.ai.localTab')}
          </button>
          <button
            onClick={handleTabCloud}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all
              ${providerType === 'cloud' ? 'bg-white dark:bg-surface-secondary text-slate-900 dark:text-content-primary shadow-sm' : 'text-slate-500 dark:text-content-secondary hover:text-slate-700 dark:hover:text-content-primary'}`}
          >
            <MdCloud size={15} /> {t('onboarding.ai.cloudTab')}
            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold leading-none">
              {t('onboarding.ai.betaBadge')}
            </span>
          </button>
        </div>

        {providerType === 'local' && (
          <LocalProviderCards
            t={t} activeAiRole={activeAiRole} aiProvider={aiProvider} setAiProvider={setAiProvider}
            ollama={ctx.ollama} lmStudio={ctx.lmStudio}
          />
        )}

        {providerType === 'cloud' && (
          <>
            <CloudProviderCards
              t={t} activeAiRole={activeAiRole} aiProvider={aiProvider} setAiProvider={setAiProvider}
              openai={ctx.openai} gemini={ctx.gemini} kimi={ctx.kimi} deepseek={ctx.deepseek}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-4">
              <CustomConnectionCard
                t={t} activeAiRole={activeAiRole} aiProvider={aiProvider} setAiProvider={setAiProvider}
                custom={ctx.custom}
              />
            </div>
          </>
        )}
      </div>

      <OnboardingFooter onBack={onBack} t={t}>
        <div className="flex items-center gap-6">
          {!canProceed && providerType === 'local' ? (
            <span className="text-sm text-amber-600 font-medium hidden sm:inline-block">
              ⚠️ {t('onboarding.ai.testToContinue')}
            </span>
          ) : !canProceed && providerType === 'cloud' ? (
            <span className="text-sm text-amber-600 font-medium hidden sm:inline-block">
              ⚠️ {t('onboarding.ai.apiKeyToContinue')}
            </span>
          ) : (
            <span className="text-sm text-slate-400 dark:text-content-secondary font-medium hidden sm:inline-block">
              {t('onboarding.ai.canChange')}
            </span>
          )}
          <button
            onClick={onNext}
            disabled={!canProceed}
            className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white transition-all shadow-md hover:shadow-lg
              ${!canProceed
                ? 'bg-slate-300 dark:bg-surface-tertiary cursor-not-allowed shadow-none'
                : 'bg-blue-600 hover:bg-blue-700 transform hover:-translate-y-0.5'}`}
          >
            {t('onboarding.ai.nextStep')} <FaArrowRight />
          </button>
        </div>
      </OnboardingFooter>
    </div>
  );
};

export default AiConfigStep;
