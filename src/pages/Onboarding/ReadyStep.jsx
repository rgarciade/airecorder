import React from 'react';
import { FaCheckCircle, FaMicrophone, FaRobot, FaServer, FaRocket } from 'react-icons/fa';
import { MdCloud } from 'react-icons/md';

const ReadyStep = ({
  t,
  aiProvider,
  modelName,
  onComplete,
  StepProgressComponent
}) => {
  const isLocal = aiProvider === 'ollama' || aiProvider === 'lmstudio';

  const providerLabel = {
    ollama: 'Ollama (Local)',
    lmstudio: 'LM Studio (Local)',
    gemini: 'Gemini',
    kimi: 'Kimi (Moonshot)',
    deepseek: 'DeepSeek',
  }[aiProvider] || aiProvider;

  // Solo Ollama tiene un modelo seleccionado con nombre significativo
  const showModelName = aiProvider === 'ollama' && modelName;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-y-auto">
      <div className="flex-1 max-w-4xl mx-auto w-full px-8 py-8 flex flex-col items-center">
        {StepProgressComponent && <div className="mb-12 w-full">{StepProgressComponent}</div>}

        {/* Success Icon */}
        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-100/50 animate-bounce-slow">
          <FaCheckCircle className="text-5xl text-emerald-500" />
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-slate-900 mb-4">{t('onboarding.finish.title')}</h1>
          <p className="text-slate-500 text-lg max-w-xl mx-auto leading-relaxed">
            {t('onboarding.finish.subtitle')}
          </p>
        </div>

        {/* Configuration Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl mb-12">

          {/* Audio Status */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500 text-xl mb-4">
              <FaMicrophone />
            </div>
            <h3 className="font-bold text-slate-800 text-lg mb-1">{t('onboarding.finish.audioSection')}</h3>
            <p className="text-slate-500 text-sm mb-3">{t('onboarding.finish.audioSubtitle')}</p>
            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <FaCheckCircle size={10} /> {t('onboarding.finish.configured')}
            </span>
          </div>

          {/* AI Status */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl mb-4 ${
              isLocal ? 'bg-orange-50 text-orange-500' : 'bg-indigo-50 text-indigo-500'
            }`}>
              {isLocal ? <FaRobot /> : <MdCloud />}
            </div>
            <h3 className="font-bold text-slate-800 text-lg mb-1">{providerLabel}</h3>
            {showModelName && (
              <p className="text-slate-500 text-sm mb-3 truncate max-w-full px-4">{modelName}</p>
            )}
            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <FaCheckCircle size={10} /> {t('onboarding.finish.active')}
            </span>
          </div>

        </div>

        {/* Launch Button */}
        <button
          onClick={onComplete}
          className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-blue-600 rounded-xl hover:bg-blue-700 hover:shadow-lg hover:-translate-y-1 focus:outline-none ring-offset-2 focus:ring-2 ring-blue-500"
        >
          <span className="mr-2 text-lg">{t('onboarding.finish.launchBtn')}</span>
          <FaRocket className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
        </button>

        <p className="mt-6 text-slate-400 text-sm">{t('onboarding.finish.changeNote')}</p>
      </div>
    </div>
  );
};

export default ReadyStep;
