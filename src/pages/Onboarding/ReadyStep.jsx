import React, { useState, useEffect } from 'react';
import { FaCheckCircle, FaMicrophone, FaRobot, FaRocket, FaDownload } from 'react-icons/fa';
import { MdCloud } from 'react-icons/md';

const IS_WIN = navigator.userAgent.includes('Windows');
const DIAR_ENV_SIZE = IS_WIN ? '~1.2 GB' : '~1.9 GB';

const WHISPER_SIZES = {
  tiny: '~75 MB',
  base: '~142 MB',
  small: '~244 MB',
  medium: '~769 MB',
  large: '~1.5 GB',
};

const ReadyStep = ({
  t,
  aiProvider,
  modelName,
  whisperModel,
  diarizationEnabled,
  onComplete,
  StepProgressComponent
}) => {
  const isLocal = aiProvider === 'ollama' || aiProvider === 'lmstudio';
  const [diarEnvStatus, setDiarEnvStatus] = useState(null);

  useEffect(() => {
    if (diarizationEnabled) {
      window.electronAPI?.getDiarizationEnvStatus?.().then(r => {
        if (r?.success) setDiarEnvStatus(r);
      });
    }
  }, [diarizationEnabled]);

  const providerLabel = {
    ollama: 'Ollama (Local)',
    lmstudio: 'LM Studio (Local)',
    gemini: 'Gemini',
    kimi: 'Kimi (Moonshot)',
    deepseek: 'DeepSeek',
  }[aiProvider] || aiProvider;

  const showModelName = aiProvider === 'ollama' && modelName;

  const model = whisperModel || 'small';
  const pendingDownloads = [
    {
      name: `Whisper ${model}`,
      size: WHISPER_SIZES[model] || '~244 MB',
      when: t('onboarding.finish.whenFirstTranscription'),
    },
  ];

  if (diarizationEnabled) {
    if (!diarEnvStatus?.installed) {
      pendingDownloads.push({
        name: 'PyTorch + pyannote.audio',
        size: DIAR_ENV_SIZE,
        when: t('onboarding.finish.whenDiarInstall'),
      });
    }
    if (!diarEnvStatus?.modelCached) {
      pendingDownloads.push({
        name: 'pyannote/speaker-diarization-3.1',
        size: '~200 MB',
        when: t('onboarding.finish.whenFirstDiar'),
      });
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-surface-primary overflow-y-auto">
      <div className="flex-1 max-w-4xl mx-auto w-full px-8 py-8 flex flex-col items-center">
        {StepProgressComponent && <div className="mb-12 w-full">{StepProgressComponent}</div>}

        {/* Success Icon */}
        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-100/50 animate-bounce-slow">
          <FaCheckCircle className="text-5xl text-emerald-500" />
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-content-primary mb-4">{t('onboarding.finish.title')}</h1>
          <p className="text-slate-500 dark:text-content-secondary text-lg max-w-xl mx-auto leading-relaxed">
            {t('onboarding.finish.subtitle')}
          </p>
        </div>

        {/* Configuration Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl mb-8">

          {/* Audio Status */}
          <div className="bg-white dark:bg-surface-secondary border border-slate-200 dark:border-edge-primary rounded-2xl p-6 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500 text-xl mb-4">
              <FaMicrophone />
            </div>
            <h3 className="font-bold text-slate-800 dark:text-content-primary text-lg mb-1">{t('onboarding.finish.audioSection')}</h3>
            <p className="text-slate-500 dark:text-content-secondary text-sm mb-3">{t('onboarding.finish.audioSubtitle')}</p>
            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <FaCheckCircle size={10} /> {t('onboarding.finish.configured')}
            </span>
          </div>

          {/* AI Status */}
          <div className="bg-white dark:bg-surface-secondary border border-slate-200 dark:border-edge-primary rounded-2xl p-6 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl mb-4 ${
              isLocal ? 'bg-orange-50 text-orange-500' : 'bg-indigo-50 text-indigo-500'
            }`}>
              {isLocal ? <FaRobot /> : <MdCloud />}
            </div>
            <h3 className="font-bold text-slate-800 dark:text-content-primary text-lg mb-1">{providerLabel}</h3>
            {showModelName && (
              <p className="text-slate-500 dark:text-content-secondary text-sm mb-3 truncate max-w-full px-4">{modelName}</p>
            )}
            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <FaCheckCircle size={10} /> {t('onboarding.finish.active')}
            </span>
          </div>

        </div>

        {/* Pending Downloads */}
        <div className="w-full max-w-3xl mb-10">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/40 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <FaDownload className="text-blue-500 dark:text-blue-400" size={14} />
              <p className="text-sm font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                {t('onboarding.finish.pendingDownloads')}
              </p>
            </div>
            <div className="rounded-xl overflow-hidden border border-blue-200 dark:border-blue-700/40 text-sm">
              {pendingDownloads.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-3 py-2.5 bg-white dark:bg-surface-secondary gap-3${i > 0 ? ' border-t border-blue-100 dark:border-edge-primary' : ''}`}
                >
                  <span className="text-slate-700 dark:text-content-primary font-medium truncate">{item.name}</span>
                  <div className="text-right flex-shrink-0">
                    <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">{item.size}</span>
                    <p className="text-xs text-slate-400 dark:text-content-secondary">{item.when}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2.5">
              {t('onboarding.finish.pendingDownloadsNote')}
            </p>
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

        <p className="mt-6 text-slate-400 dark:text-content-secondary text-sm">{t('onboarding.finish.changeNote')}</p>
      </div>
    </div>
  );
};

export default ReadyStep;
