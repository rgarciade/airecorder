import React, { useState, useEffect } from 'react';
import { FaArrowRight, FaUsers } from 'react-icons/fa';
import { MdVisibility, MdVisibilityOff, MdRecordVoiceOver } from 'react-icons/md';
import OnboardingFooter from './OnboardingFooter';

const IS_WIN = navigator.userAgent.includes('Windows');
const DIARIZATION_ENV_SIZE = IS_WIN ? '~1.2 GB' : '~1.9 GB';
const DIARIZATION_TOTAL = IS_WIN ? '~1.4 GB' : '~2.1 GB';

const DiarizationStep = ({
  t,
  hfToken,
  setHfToken,
  diarizationEnabled,
  setDiarizationEnabled,
  onBack,
  onNext,
  StepProgressComponent
}) => {
  const [showToken, setShowToken] = useState(false);
  const [envStatus, setEnvStatus] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState('');

  useEffect(() => {
    window.electronAPI?.getDiarizationEnvStatus?.().then(r => {
      if (r?.success) setEnvStatus(r);
    });
    window.electronAPI?.onDiarizationInstallProgress?.((data) => {
      if (data.phase === 'done') {
        setInstalling(false);
        window.electronAPI?.getDiarizationEnvStatus?.().then(r => {
          if (r?.success) setEnvStatus(r);
        });
      } else if (data.phase === 'error') {
        setInstalling(false);
        setInstallError(data.detail || 'Error desconocido');
      }
    });
    return () => window.electronAPI?.offDiarizationInstallProgress?.();
  }, []);

  const handleInstall = () => {
    setInstalling(true);
    setInstallError('');
    window.electronAPI?.installDiarizationEnv?.();
  };

  const openExternal = (url) => window.electronAPI?.openExternal(url);

  const downloadRows = [
    {
      name: 'PyTorch + pyannote.audio',
      size: DIARIZATION_ENV_SIZE,
      when: t('onboarding.diarization.whenInstall'),
      done: envStatus?.installed,
    },
    {
      name: 'pyannote/speaker-diarization-3.1',
      size: '~200 MB',
      when: t('onboarding.diarization.whenFirst'),
      done: envStatus?.modelCached,
    },
  ];

  const steps = [
    { label: t('settings.diarization.step1'), link: 'https://huggingface.co/join', linkText: 'huggingface.co/join' },
    {
      label: t('settings.diarization.step2'),
      link: 'https://huggingface.co/pyannote/speaker-diarization-3.1', linkText: t('settings.diarization.step2Link'),
      link2: 'https://huggingface.co/pyannote/segmentation-3.0', linkText2: t('settings.diarization.step2bLink'),
      label2: t('settings.diarization.step2b'),
      link3: 'https://huggingface.co/pyannote/speaker-diarization-community-1', linkText3: t('settings.diarization.step2cLink'),
      label3: t('settings.diarization.step2c'),
    },
    { label: t('settings.diarization.step3'), link: 'https://huggingface.co/settings/tokens/new?tokenType=read', linkText: 'huggingface.co/settings/tokens', note: t('settings.diarization.step3Note') },
    { label: t('settings.diarization.step4'), link: null },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-surface-primary overflow-hidden">
      <div className="flex-1 max-w-3xl mx-auto w-full px-8 py-8 flex flex-col overflow-y-auto">
        {StepProgressComponent && (
          <div className="mb-6 w-full">{StepProgressComponent}</div>
        )}

        {/* Cabecera */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-500 dark:text-indigo-400">
              <MdRecordVoiceOver size={22} />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-content-primary">
              {t('onboarding.diarization.title')}
            </h1>
          </div>
          <p className="text-slate-500 dark:text-content-secondary text-base leading-relaxed">
            {t('onboarding.diarization.subtitle')}
          </p>
        </div>

        {/* Ilustración */}
        <div className="bg-white dark:bg-surface-secondary border border-slate-200 dark:border-edge-primary rounded-2xl p-5 shadow-sm mb-5">
          <div className="flex flex-col gap-2">
            {[
              { who: 'Ana', color: 'bg-blue-500', text: '¿Cuándo es la siguiente reunión?' },
              { who: 'Luis', color: 'bg-emerald-500', text: 'El jueves a las 10:00 h.' },
              { who: 'Ana', color: 'bg-blue-500', text: 'Perfecto, lo confirmo por email.' },
            ].map((line, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-full ${line.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5`}>
                  {line.who[0]}
                </div>
                <div className="flex-1 bg-slate-50 dark:bg-surface-tertiary rounded-lg px-3 py-1.5 text-sm text-slate-700 dark:text-content-primary">
                  <span className="font-semibold mr-1">{line.who}:</span>{line.text}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 dark:text-content-secondary mt-3 text-center">
            {t('onboarding.diarization.illustration')}
          </p>
        </div>

        <div className="flex flex-col gap-4 flex-1">
          {/* Toggle activar */}
          <div className="bg-white dark:bg-surface-secondary border border-slate-200 dark:border-edge-primary rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-500 dark:text-indigo-400">
                  <FaUsers size={15} />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-content-primary text-sm">
                    {t('settings.diarization.enableLabel')}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-content-secondary mt-0.5">
                    {t('onboarding.diarization.optional')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDiarizationEnabled(v => !v)}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: diarizationEnabled ? '#6366f1' : '#cbd5e1',
                  position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: diarizationEnabled ? 23 : 3,
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s', display: 'block',
                }} />
              </button>
            </div>
          </div>

          {/* Sección de configuración — solo si activado */}
          {diarizationEnabled && (
            <div className="bg-white dark:bg-surface-secondary border border-slate-200 dark:border-edge-primary rounded-2xl p-5 shadow-sm flex flex-col gap-5">

              {/* Tabla de descargas */}
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-content-secondary uppercase tracking-wide mb-2">
                  {t('onboarding.diarization.willDownload')}
                </p>
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-edge-primary text-sm">
                  {downloadRows.map((row, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between px-3 py-2.5 gap-3${i > 0 ? ' border-t border-slate-100 dark:border-edge-primary' : ''}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-base flex-shrink-0 ${row.done ? '' : 'opacity-40'}`}>
                          {row.done ? '✅' : '⬜'}
                        </span>
                        <span className="text-slate-700 dark:text-content-primary font-medium truncate">{row.name}</span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{row.size}</span>
                        <p className="text-xs text-slate-400 dark:text-content-secondary">{row.when}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-surface-tertiary border-t border-slate-200 dark:border-edge-primary">
                    <span className="text-xs font-bold text-slate-500 dark:text-content-secondary uppercase tracking-wide">
                      {t('onboarding.diarization.total')}
                    </span>
                    <span className="font-mono font-bold text-slate-700 dark:text-content-primary">
                      {DIARIZATION_TOTAL}
                    </span>
                  </div>
                </div>
              </div>

              {/* Botón instalar — solo si el env no está instalado */}
              {!envStatus?.installed && (
                <div className="flex flex-col gap-2">
                  {installError && (
                    <p className="text-xs text-red-500">{installError}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleInstall}
                    disabled={installing}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all text-sm"
                  >
                    {installing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {t('settings.diarization.installing')}
                      </>
                    ) : (
                      `${t('settings.diarization.installBtn')} (${DIARIZATION_ENV_SIZE})`
                    )}
                  </button>
                  <p className="text-xs text-slate-400 dark:text-content-secondary text-center">
                    {t('onboarding.diarization.installNote')}
                  </p>
                </div>
              )}

              {/* Pasos para obtener el token */}
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-content-secondary uppercase tracking-wide mb-3">
                  {t('settings.diarization.stepsTitle')}
                </p>
                <div className="flex flex-col gap-3">
                  {steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <span className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-slate-600 dark:text-content-secondary">
                        {step.label}{' '}
                        {step.link && (
                          <button
                            type="button"
                            onClick={() => openExternal(step.link)}
                            className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline bg-transparent border-0 cursor-pointer p-0"
                          >
                            {step.linkText}
                          </button>
                        )}
                        {step.link2 && (
                          <>{' '}{step.label2}{' '}
                            <button
                              type="button"
                              onClick={() => openExternal(step.link2)}
                              className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline bg-transparent border-0 cursor-pointer p-0"
                            >
                              {step.linkText2}
                            </button>
                          </>
                        )}
                        {step.link3 && (
                          <>{' '}{step.label3}{' '}
                            <button
                              type="button"
                              onClick={() => openExternal(step.link3)}
                              className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline bg-transparent border-0 cursor-pointer p-0"
                            >
                              {step.linkText3}
                            </button>
                          </>
                        )}
                        {step.note && (
                          <span className="block text-xs text-slate-400 dark:text-content-secondary mt-0.5">
                            ℹ️ {step.note}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Input del token HF */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-content-primary mb-1.5">
                  {t('settings.diarization.hfTokenLabel')}
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    placeholder={t('settings.diarization.hfTokenPlaceholder')}
                    value={hfToken}
                    onChange={(e) => setHfToken(e.target.value)}
                    className="w-full border border-slate-200 dark:border-edge-primary bg-slate-50 dark:bg-surface-tertiary text-slate-800 dark:text-content-primary rounded-xl px-4 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-content-primary bg-transparent border-0 cursor-pointer flex items-center"
                  >
                    {showToken ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                  </button>
                </div>
                <p className="text-xs text-slate-400 dark:text-content-secondary mt-1.5">
                  {t('settings.diarization.hfTokenHelp')}
                </p>
              </div>

            </div>
          )}
        </div>
      </div>

      <OnboardingFooter onBack={onBack} t={t}>
        <div className="flex items-center gap-3">
          {!diarizationEnabled && (
            <button
              onClick={onNext}
              className="px-5 py-2.5 text-slate-500 dark:text-content-secondary font-medium text-sm hover:text-slate-700 dark:hover:text-content-primary transition-colors"
            >
              {t('onboarding.diarization.skipBtn')}
            </button>
          )}
          <button
            onClick={onNext}
            className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            {diarizationEnabled ? t('onboarding.diarization.nextBtn') : t('onboarding.diarization.skipBtn')}
            <FaArrowRight size={14} />
          </button>
        </div>
      </OnboardingFooter>
    </div>
  );
};

export default DiarizationStep;
