import React from 'react';
import { FaRobot, FaServer, FaCheckCircle, FaExclamationTriangle, FaArrowRight, FaBrain } from 'react-icons/fa';
import { MdCloud, MdAutoAwesome } from 'react-icons/md';
import OnboardingFooter from './OnboardingFooter';
import InfoTooltip from '../../components/InfoTooltip/InfoTooltip';

const AiConfigStep = ({
  t,
  providerType,
  setProviderType,
  aiProvider,
  setAiProvider,
  ollamaHost,
  setOllamaHost,
  checkOllama,
  ollamaStatus,
  ollamaModels,
  selectedOllamaModel,
  setSelectedOllamaModel,
  ollamaEmbeddingModel,
  setOllamaEmbeddingModel,
  lmStudioEmbeddingModel,
  setLmStudioEmbeddingModel,
  geminiKey,
  setGeminiKey,
  kimiApiKey,
  setKimiApiKey,
  deepseekApiKey,
  setDeepseekApiKey,
  onBack,
  onNext,
  StepProgressComponent
}) => {

  const canProceed =
    (providerType === 'local' && aiProvider === 'ollama' && ollamaStatus === 'success') ||
    (providerType === 'local' && aiProvider === 'lmstudio') ||
    (providerType === 'cloud' && aiProvider === 'gemini' && geminiKey.trim()) ||
    (providerType === 'cloud' && aiProvider === 'kimi' && kimiApiKey.trim()) ||
    (providerType === 'cloud' && aiProvider === 'deepseek' && deepseekApiKey.trim());

  const handleTabLocal = () => {
    setProviderType('local');
    setAiProvider('ollama');
  };

  const handleTabCloud = () => {
    setProviderType('cloud');
    setAiProvider('gemini');
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <div className="flex-1 max-w-6xl mx-auto w-full px-8 py-8 flex flex-col overflow-y-auto">

        {/* Step Progress */}
        {StepProgressComponent && <div className="mb-3">{StepProgressComponent}</div>}

        {/* Header */}
        <div className="text-center mb-5">
          <h1 className="text-3xl font-extrabold text-slate-900 mb-3">{t('onboarding.ai.title')}</h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto leading-relaxed">
            {t('onboarding.ai.subtitle')}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6 max-w-md mx-auto w-full">
          <button
            onClick={handleTabLocal}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all
              ${providerType === 'local' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <FaServer size={13} /> {t('onboarding.ai.localTab')}
          </button>
          <button
            onClick={handleTabCloud}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all
              ${providerType === 'cloud' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <MdCloud size={15} /> {t('onboarding.ai.cloudTab')}
            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold leading-none">
              {t('onboarding.ai.betaBadge')}
            </span>
          </button>
        </div>

        {/* ── LOCAL TAB ──────────────────────────────────────────────── */}
        {providerType === 'local' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start mb-4">

            {/* Ollama */}
            <div
              className={`relative bg-white border-2 rounded-2xl p-5 cursor-pointer transition-all flex flex-col h-full overflow-hidden
                ${aiProvider === 'ollama'
                  ? 'border-blue-500 bg-blue-50/20 shadow-none ring-1 ring-blue-500/20'
                  : 'border-slate-200 hover:border-blue-400 hover:shadow-lg'}`}
              onClick={() => setAiProvider('ollama')}
            >
              {/* RECOMMENDED badge */}
              <div className="absolute top-0 right-0 bg-blue-500/10 text-blue-600 text-xs font-bold px-4 py-2 rounded-bl-2xl tracking-wider">
                {t('onboarding.ai.recommended')}
              </div>

              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center text-xl">
                    <FaRobot />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <h3 className="text-xl font-bold text-slate-900 leading-tight">Ollama (Local)</h3>
                      <InfoTooltip
                        title={t('modelInfo.title')}
                        sections={[
                          {
                            title: t('modelInfo.generalModel'),
                            items: [
                              { icon: '⭐', label: t('modelInfo.bestPerformance'), value: 'deepseek-r1:8b' },
                              { icon: '🪶', label: t('modelInfo.lessResources'), value: 'gemma-7b-it' },
                            ],
                          },
                          {
                            title: t('modelInfo.embedding'),
                            items: [
                              { icon: '⭐', label: t('modelInfo.bestPerformance'), value: 'mxbai-embed-large' },
                              { icon: '🪶', label: t('modelInfo.lessResources'), value: 'nomic-embed-text' },
                            ],
                          },
                        ]}
                      />
                    </div>
                    <p className="text-slate-500 text-sm">{t('onboarding.ai.ollama.subtitle')}</p>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all mt-[17px]
                  ${aiProvider === 'ollama' ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`}>
                  <div className={`w-2.5 h-2.5 rounded-full bg-white transition-transform ${aiProvider === 'ollama' ? 'scale-100' : 'scale-0'}`}></div>
                </div>
              </div>

              <p className="text-slate-500 mb-2 leading-relaxed text-sm">{t('onboarding.ai.ollama.description')}</p>

              <ul className="flex flex-col gap-1.5 mb-4">
                <li className="flex items-center gap-2 text-slate-600 text-xs">
                  <FaCheckCircle className="text-blue-500 text-sm flex-shrink-0" />
                  <span>{t('onboarding.ai.ollama.private')}</span>
                </li>
                <li className="flex items-center gap-2 text-slate-600 text-xs">
                  <FaCheckCircle className="text-blue-500 text-sm flex-shrink-0" />
                  <span>{t('onboarding.ai.ollama.noFees')}</span>
                </li>
                <li className="flex items-center gap-2 text-xs">
                  <FaCheckCircle className="text-emerald-500 text-sm flex-shrink-0" />
                  <span className="font-semibold text-emerald-700">{t('onboarding.ai.stable')}</span>
                </li>
                <li className="flex items-center gap-2 text-slate-600 text-xs">
                  <FaExclamationTriangle className="text-orange-500 text-sm flex-shrink-0" />
                  <span>{t('onboarding.ai.ollama.ram')}</span>
                </li>
              </ul>

              {/* Ollama config */}
              <div className="mt-auto pt-4 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                  {t('onboarding.ai.ollama.urlLabel')}
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  <input
                    type="text"
                    className="flex-1 p-2.5 border border-slate-300 rounded-lg text-sm font-mono bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={ollamaHost}
                    onChange={(e) => setOllamaHost(e.target.value)}
                    placeholder="http://localhost:11434"
                    style={{ minWidth: '200px' }}
                  />
                  <button
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors border
                      ${ollamaStatus === 'checking'
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : ollamaStatus === 'success'
                          ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-500 hover:text-white hover:border-blue-500'
                          : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-sm'}`}
                    onClick={checkOllama}
                    disabled={ollamaStatus === 'checking'}
                  >
                    {ollamaStatus === 'checking' ? t('onboarding.ai.ollama.checking') : t('onboarding.ai.ollama.testBtn')}
                  </button>
                </div>

                {aiProvider === 'ollama' && ollamaStatus === 'idle' && (
                  <div className="text-amber-600 text-xs flex items-center gap-2 mb-2 font-medium">
                    <FaExclamationTriangle /> Haz clic en "Probar" para habilitar el siguiente paso
                  </div>
                )}

                {ollamaStatus === 'success' && (
                  <div className="text-emerald-600 text-xs flex items-center gap-2 mb-2 font-medium">
                    <FaCheckCircle /> {t('onboarding.ai.ollama.connected')} {ollamaModels.length > 0 ? (ollamaModels[0]?.name || ollamaModels[0]) : 'Ollama'}
                  </div>
                )}
                {ollamaStatus === 'error' && (
                  <div className="text-red-500 text-xs flex items-center gap-2 mb-2 font-medium">
                    <FaExclamationTriangle /> {t('onboarding.ai.ollama.connFailed')}
                  </div>
                )}

                {ollamaModels.length > 0 && (
                  <>
                    <div className="mt-3">
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                        {t('onboarding.ai.ollama.modelLabel')}
                      </label>
                      <select
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={selectedOllamaModel}
                        onChange={(e) => setSelectedOllamaModel(e.target.value)}
                      >
                        {ollamaModels.filter(m => !m.toLowerCase().includes('embed')).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-3">
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                        {t('settings.fields.embeddingModel', { provider: 'Ollama' })}
                      </label>
                      <select
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={ollamaEmbeddingModel}
                        onChange={(e) => setOllamaEmbeddingModel(e.target.value)}
                      >
                        {ollamaModels.filter(m => m.toLowerCase().includes('embed')).length === 0
                          ? <option value={ollamaEmbeddingModel}>{ollamaEmbeddingModel}</option>
                          : ollamaModels.filter(m => m.toLowerCase().includes('embed')).map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))
                        }
                      </select>
                      <p className="text-xs text-slate-400 mt-1">{t('settings.helpText.embeddingModel')}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* LM Studio */}
            <div
              className={`relative bg-white border-2 rounded-2xl p-5 cursor-pointer transition-all flex flex-col h-full overflow-hidden
                ${aiProvider === 'lmstudio'
                  ? 'border-blue-500 bg-blue-50/20 shadow-none ring-1 ring-blue-500/20'
                  : 'border-slate-200 hover:border-blue-400 hover:shadow-lg'}`}
              onClick={() => setAiProvider('lmstudio')}
            >
              {/* BETA badge */}
              <div className="absolute top-0 right-0 bg-amber-100 text-amber-700 text-xs font-bold px-4 py-2 rounded-bl-2xl tracking-wider">
                {t('onboarding.ai.betaBadge').toUpperCase()}
              </div>

              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center text-xl">
                    <FaServer />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <h3 className="text-xl font-bold text-slate-900 leading-tight">LM Studio (Local)</h3>
                      <InfoTooltip
                        title={t('modelInfo.title')}
                        sections={[
                          {
                            title: t('modelInfo.generalModel'),
                            items: [
                              { icon: '⭐', label: t('modelInfo.bestPerformance'), value: 'neural-chat-7b' },
                              { icon: '🪶', label: t('modelInfo.lessResources'), value: 'TinyLlama-1.1B' },
                            ],
                          },
                          {
                            title: t('modelInfo.embedding'),
                            items: [
                              { icon: '⭐', label: t('modelInfo.bestPerformance'), value: 'mxbai-embed-large' },
                              { icon: '🪶', label: t('modelInfo.lessResources'), value: 'nomic-embed-text' },
                            ],
                          },
                        ]}
                      />
                    </div>
                    <p className="text-slate-500 text-sm">{t('onboarding.ai.lmstudio.subtitle')}</p>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all mt-[17px]
                  ${aiProvider === 'lmstudio' ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`}>
                  <div className={`w-2.5 h-2.5 rounded-full bg-white transition-transform ${aiProvider === 'lmstudio' ? 'scale-100' : 'scale-0'}`}></div>
                </div>
              </div>

              <p className="text-slate-500 mb-2 leading-relaxed text-sm">{t('onboarding.ai.lmstudio.description')}</p>

              <ul className="flex flex-col gap-1.5 mb-4">
                <li className="flex items-center gap-2 text-slate-600 text-xs">
                  <FaCheckCircle className="text-blue-500 text-sm flex-shrink-0" />
                  <span>{t('onboarding.ai.lmstudio.private')}</span>
                </li>
                <li className="flex items-center gap-2 text-slate-600 text-xs">
                  <FaCheckCircle className="text-blue-500 text-sm flex-shrink-0" />
                  <span>{t('onboarding.ai.lmstudio.compatible')}</span>
                </li>
              </ul>

              <div className="mt-auto pt-4 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                  {t('onboarding.ai.lmstudio.urlLabel')}
                </label>
                <input
                  type="text"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-mono bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value="http://localhost:1234/v1"
                  disabled
                  title="Configurable in settings later"
                />
                <p className="text-xs text-slate-400 mt-2">{t('onboarding.ai.lmstudio.urlNote')}</p>

                {/* Embedding model */}
                <div className="mt-3">
                  <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                    {t('settings.fields.embeddingModel', { provider: 'LM Studio' })}
                  </label>
                  <input
                    type="text"
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={lmStudioEmbeddingModel}
                    onChange={(e) => setLmStudioEmbeddingModel(e.target.value)}
                    placeholder="nomic-embed-text"
                  />
                  <p className="text-xs text-slate-400 mt-1">{t('settings.helpText.embeddingModel')}</p>
                </div>

                {aiProvider === 'lmstudio' && (
                  <div className="mt-4 pt-3 border-t border-slate-100 text-emerald-600 text-xs flex items-center gap-2 font-medium">
                    <FaCheckCircle /> ¡Todo listo! Haz clic en Siguiente para continuar
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── CLOUD TAB ──────────────────────────────────────────────── */}
        {providerType === 'cloud' && (
          <div className="flex flex-col gap-5 mb-4">

            {/* Beta warning banner */}
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
              <FaExclamationTriangle className="text-amber-500 text-lg flex-shrink-0 mt-0.5" />
              <p className="text-amber-800 text-sm leading-relaxed">{t('onboarding.ai.betaWarning')}</p>
            </div>

            {/* Cloud provider cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

              {/* Gemini */}
              <div
                className={`relative bg-white border-2 rounded-2xl p-6 cursor-pointer transition-all flex flex-col
                  ${aiProvider === 'gemini'
                    ? 'border-indigo-500 bg-indigo-50/20 ring-1 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-indigo-400 hover:shadow-lg'}`}
                onClick={() => setAiProvider('gemini')}
              >
                <div className="absolute top-0 right-0 bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-bl-xl tracking-wider">
                  {t('onboarding.ai.betaBadge').toUpperCase()}
                </div>

                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center text-xl">
                      <MdAutoAwesome />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">Gemini</h3>
                      <p className="text-slate-400 text-xs">Google AI</p>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all mt-[5px]
                    ${aiProvider === 'gemini' ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`}>
                    <div className={`w-2 h-2 rounded-full bg-white transition-transform ${aiProvider === 'gemini' ? 'scale-100' : 'scale-0'}`}></div>
                  </div>
                </div>

                <p className="text-slate-500 text-sm leading-relaxed mb-4">{t('onboarding.ai.gemini.description')}</p>

                {aiProvider === 'gemini' && (
                  <div className="mt-auto pt-4 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                    <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                      {t('onboarding.ai.gemini.apiKeyLabel')}
                    </label>
                    <input
                      type="password"
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder={t('onboarding.ai.apiKeyPlaceholder')}
                    />
                  </div>
                )}
              </div>

              {/* Kimi */}
              <div
                className={`relative bg-white border-2 rounded-2xl p-6 cursor-pointer transition-all flex flex-col
                  ${aiProvider === 'kimi'
                    ? 'border-teal-500 bg-teal-50/20 ring-1 ring-teal-500/20'
                    : 'border-slate-200 hover:border-teal-400 hover:shadow-lg'}`}
                onClick={() => setAiProvider('kimi')}
              >
                <div className="absolute top-0 right-0 bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-bl-xl tracking-wider">
                  {t('onboarding.ai.betaBadge').toUpperCase()}
                </div>

                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-500 flex items-center justify-center text-xl">
                      <FaRobot />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">Kimi</h3>
                      <p className="text-slate-400 text-xs">Moonshot AI</p>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all mt-[5px]
                    ${aiProvider === 'kimi' ? 'border-teal-500 bg-teal-500' : 'border-slate-300'}`}>
                    <div className={`w-2 h-2 rounded-full bg-white transition-transform ${aiProvider === 'kimi' ? 'scale-100' : 'scale-0'}`}></div>
                  </div>
                </div>

                <p className="text-slate-500 text-sm leading-relaxed mb-4">{t('onboarding.ai.kimi.description')}</p>

                {aiProvider === 'kimi' && (
                  <div className="mt-auto pt-4 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                    <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                      {t('onboarding.ai.kimi.apiKeyLabel')}
                    </label>
                    <input
                      type="password"
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      value={kimiApiKey}
                      onChange={(e) => setKimiApiKey(e.target.value)}
                      placeholder={t('onboarding.ai.apiKeyPlaceholder')}
                    />
                  </div>
                )}
              </div>

              {/* DeepSeek */}
              <div
                className={`relative bg-white border-2 rounded-2xl p-6 cursor-pointer transition-all flex flex-col
                  ${aiProvider === 'deepseek'
                    ? 'border-violet-500 bg-violet-50/20 ring-1 ring-violet-500/20'
                    : 'border-slate-200 hover:border-violet-400 hover:shadow-lg'}`}
                onClick={() => setAiProvider('deepseek')}
              >
                <div className="absolute top-0 right-0 bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-bl-xl tracking-wider">
                  {t('onboarding.ai.betaBadge').toUpperCase()}
                </div>

                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-500 flex items-center justify-center text-xl">
                      <FaBrain />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">DeepSeek</h3>
                      <p className="text-slate-400 text-xs">DeepSeek AI</p>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all mt-[5px]
                    ${aiProvider === 'deepseek' ? 'border-violet-500 bg-violet-500' : 'border-slate-300'}`}>
                    <div className={`w-2 h-2 rounded-full bg-white transition-transform ${aiProvider === 'deepseek' ? 'scale-100' : 'scale-0'}`}></div>
                  </div>
                </div>

                <p className="text-slate-500 text-sm leading-relaxed mb-4">{t('onboarding.ai.deepseek.description')}</p>

                {aiProvider === 'deepseek' && (
                  <div className="mt-auto pt-4 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                    <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                      {t('onboarding.ai.deepseek.apiKeyLabel')}
                    </label>
                    <input
                      type="password"
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      value={deepseekApiKey}
                      onChange={(e) => setDeepseekApiKey(e.target.value)}
                      placeholder={t('onboarding.ai.apiKeyPlaceholder')}
                    />
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <OnboardingFooter onBack={onBack} t={t}>
        <div className="flex items-center gap-6">
          {!canProceed && providerType === 'local' && aiProvider === 'ollama' ? (
            <span className="text-sm text-amber-600 font-medium hidden sm:inline-block">
              ⚠️ Prueba la conexión para continuar
            </span>
          ) : !canProceed && providerType === 'cloud' ? (
            <span className="text-sm text-amber-600 font-medium hidden sm:inline-block">
              ⚠️ Introduce tu API Key para continuar
            </span>
          ) : (
            <span className="text-sm text-slate-400 font-medium hidden sm:inline-block">
              {t('onboarding.ai.canChange')}
            </span>
          )}
          <button
            onClick={onNext}
            disabled={!canProceed}
            className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white transition-all shadow-md hover:shadow-lg
              ${!canProceed
                ? 'bg-slate-300 cursor-not-allowed shadow-none'
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
