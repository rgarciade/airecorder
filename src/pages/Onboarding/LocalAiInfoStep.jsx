import React from 'react';
import { FaRobot, FaServer, FaExternalLinkAlt, FaBrain, FaSearch, FaArrowRight, FaShieldAlt } from 'react-icons/fa';
import OnboardingFooter from './OnboardingFooter';

const LocalAiInfoStep = ({ t, onNext, onBack, StepProgressComponent }) => {
  const handleOpenDocs = (e) => {
    e.preventDefault();
    const url = 'https://rgarciade.github.io/airecorder/docs.html';
    if (window.electronAPI && window.electronAPI.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <div className="flex-1 max-w-6xl mx-auto w-full px-8 py-8 flex flex-col overflow-y-auto">

        {/* Step Progress */}
        {StepProgressComponent && <div className="mb-3">{StepProgressComponent}</div>}

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-blue-600 mb-4 shadow-sm">
            <FaShieldAlt size={28} />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-3">{t('onboarding.aiInfo.title')}</h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto leading-relaxed">
            {t('onboarding.aiInfo.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          {/* Left Column: What and Tools */}
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                {t('onboarding.aiInfo.whatIsLocalAi')}
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                {t('onboarding.aiInfo.whatIsLocalAiDesc')}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex-1">
              <h3 className="text-lg font-bold text-slate-900 mb-4">{t('onboarding.aiInfo.tools')}</h3>
              
              <div className="flex flex-col gap-4">
                <div className="flex gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center flex-shrink-0 text-lg">
                    <img src="https://ollama.com/public/ollama.png" alt="Ollama" width="24" height="24" className="rounded object-contain" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 mb-1">Ollama</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{t('onboarding.aiInfo.ollamaDesc')}</p>
                  </div>
                </div>

                <div className="flex gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center flex-shrink-0 text-lg">
                    <svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
                      <rect width="36" height="36" rx="9" fill="#6D28D9"/>
                      <rect x="7" y="9"  width="22" height="3.5" rx="1.75" fill="rgba(255,255,255,0.95)"/>
                      <rect x="5" y="16" width="26" height="3.5" rx="1.75" fill="rgba(255,255,255,0.95)"/>
                      <rect x="9" y="23" width="18" height="3.5" rx="1.75" fill="rgba(255,255,255,0.95)"/>
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 mb-1">LM Studio</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{t('onboarding.aiInfo.lmstudioDesc')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Models and Docs */}
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex-1">
              <h3 className="text-lg font-bold text-slate-900 mb-4">{t('onboarding.aiInfo.models')}</h3>
              
              <div className="flex flex-col gap-5">
                <div className="flex gap-3">
                  <div className="mt-1 text-blue-500">
                    <FaBrain size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm mb-1">{t('onboarding.aiInfo.normalModels')}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{t('onboarding.aiInfo.normalModelsDesc')}</p>
                    <div className="mt-2 flex gap-2">
                      <span className="text-[10px] font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">llama3</span>
                      <span className="text-[10px] font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">qwen2</span>
                    </div>
                  </div>
                </div>

                <div className="h-px w-full bg-slate-100"></div>

                <div className="flex gap-3">
                  <div className="mt-1 text-emerald-500">
                    <FaSearch size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm mb-1">{t('onboarding.aiInfo.embeddingModels')}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{t('onboarding.aiInfo.embeddingModelsDesc')}</p>
                    <div className="mt-2 flex gap-2">
                      <span className="text-[10px] font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">nomic-embed-text</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Docs CTA */}
            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100 relative overflow-hidden group">
              
              <div className="relative z-10 flex flex-col items-start gap-3">
                <div>
                  <h4 className="font-bold text-blue-900 mb-1">{t('onboarding.aiInfo.noInstallTitle', '¿No tienes nada instalado?')}</h4>
                  <p className="text-sm text-blue-700 mb-4">{t('onboarding.aiInfo.noInstallDesc', 'Recomendamos pausar un momento, seguir nuestra guía e instalar Ollama antes de continuar.')}</p>
                </div>
                <button
                  onClick={handleOpenDocs}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors shadow-sm"
                >
                  <FaExternalLinkAlt size={12} />
                  {t('onboarding.aiInfo.docsBtn')}
                </button>
                <span className="text-xs text-blue-500 font-medium">{t('onboarding.aiInfo.docsNote')}</span>
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
