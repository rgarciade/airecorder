import React from 'react';
import { FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import InfoTooltip from '../../../components/InfoTooltip/InfoTooltip';

export default function LocalProviderCards({ t, activeAiRole, aiProvider, setAiProvider, ollama, lmStudio }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start mb-4">

      {/* Ollama */}
      <div
        className={`relative bg-white dark:bg-surface-secondary border-2 rounded-2xl p-5 cursor-pointer transition-all flex flex-col h-full overflow-hidden
          ${aiProvider === 'ollama'
            ? 'border-blue-500 bg-blue-50/20 shadow-none ring-1 ring-blue-500/20'
            : 'border-slate-200 dark:border-edge-primary hover:border-blue-400 hover:shadow-lg'}`}
        onClick={() => setAiProvider('ollama')}
      >
        <div className="absolute top-0 right-0 bg-blue-500/10 text-blue-600 text-xs font-bold px-4 py-2 rounded-bl-2xl tracking-wider">
          {t('onboarding.ai.recommended')}
        </div>

        <div className="flex justify-between items-start mb-3 gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl border shadow-sm flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'var(--color-bg-primary)', borderColor: 'var(--color-border-primary)' }}>
              <img src="https://ollama.com/public/ollama.png" alt="Ollama" width="24" height="24" className="rounded object-contain"
                style={{ filter: 'var(--ollama-icon-filter, none)' }} />
            </div>
            <div className="min-w-0">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <h3 className="text-xl font-bold text-slate-900 dark:text-content-primary leading-tight">Ollama (Local)</h3>
                <InfoTooltip
                  title={t('modelInfo.title')}
                  sections={[
                    {
                      title: t('modelInfo.generalModel'),
                      items: [
                        { icon: '⭐', label: t('modelInfo.bestPerformance'), value: 'gemma4:e4b' },
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
              <p className="text-slate-500 dark:text-content-secondary text-sm">{t('onboarding.ai.ollama.subtitle')}</p>
            </div>
          </div>
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 mt-6
            ${aiProvider === 'ollama' ? 'border-blue-500 bg-blue-500' : 'border-slate-300 dark:border-edge-primary'}`}>
            <div className={`w-2.5 h-2.5 rounded-full bg-white transition-transform ${aiProvider === 'ollama' ? 'scale-100' : 'scale-0'}`}></div>
          </div>
        </div>

        <p className="text-slate-500 dark:text-content-secondary mb-2 leading-relaxed text-sm">{t('onboarding.ai.ollama.description')}</p>

        <ul className="flex flex-col gap-1.5 mb-4">
          <li className="flex items-center gap-2 text-slate-600 dark:text-content-secondary text-xs">
            <FaCheckCircle className="text-blue-500 text-sm flex-shrink-0" />
            <span>{t('onboarding.ai.ollama.private')}</span>
          </li>
          <li className="flex items-center gap-2 text-slate-600 dark:text-content-secondary text-xs">
            <FaCheckCircle className="text-blue-500 text-sm flex-shrink-0" />
            <span>{t('onboarding.ai.ollama.noFees')}</span>
          </li>
          <li className="flex items-center gap-2 text-xs">
            <FaCheckCircle className="text-emerald-500 text-sm flex-shrink-0" />
            <span className="font-semibold text-emerald-700">{t('onboarding.ai.stable')}</span>
          </li>
          <li className="flex items-center gap-2 text-slate-600 dark:text-content-secondary text-xs">
            <FaExclamationTriangle className="text-orange-500 text-sm flex-shrink-0" />
            <span>{t('onboarding.ai.ollama.ram')}</span>
          </li>
        </ul>

        <div className="mt-auto pt-4 border-t border-slate-100 dark:border-edge-primary" onClick={(e) => e.stopPropagation()}>
          <label className="block text-xs font-bold text-slate-600 dark:text-content-secondary mb-2 uppercase tracking-wide">
            {t('onboarding.ai.ollama.urlLabel')}
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              type="text"
              className="flex-1 p-2.5 border border-slate-300 dark:border-edge-primary rounded-lg text-sm font-mono bg-slate-50 dark:bg-surface-tertiary text-slate-700 dark:text-content-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={ollama.host}
              onChange={(e) => ollama.setHost(e.target.value)}
              placeholder="http://localhost:11434"
              style={{ minWidth: '200px' }}
            />
            <button
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors border
                ${ollama.status === 'checking'
                  ? 'bg-slate-100 dark:bg-surface-tertiary text-slate-400 dark:text-content-secondary border-slate-200 dark:border-edge-primary cursor-not-allowed'
                  : ollama.status === 'success'
                    ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-500 hover:text-white hover:border-blue-500'
                    : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-sm'}`}
              onClick={ollama.checkConnection}
              disabled={ollama.status === 'checking'}
            >
              {ollama.status === 'checking' ? t('onboarding.ai.ollama.checking') : t('onboarding.ai.ollama.testBtn')}
            </button>
          </div>

          {aiProvider === 'ollama' && ollama.status === 'idle' && (
            <div className="text-amber-600 text-xs flex items-center gap-2 mb-2 font-medium">
              <FaExclamationTriangle /> {t('onboarding.ai.testToContinue')}
            </div>
          )}

          {ollama.status === 'success' && (
            <div className="text-emerald-600 text-xs flex items-center gap-2 mb-2 font-medium">
              <FaCheckCircle /> {t('onboarding.ai.ollama.connected')} {ollama.models.length > 0 ? (ollama.models[0]?.name || ollama.models[0]) : 'Ollama'}
            </div>
          )}
          {ollama.status === 'error' && (
            <div className="text-red-500 text-xs flex items-center gap-2 mb-2 font-medium">
              <FaExclamationTriangle /> {t('onboarding.ai.ollama.connFailed')}
            </div>
          )}

          {ollama.models.length > 0 && activeAiRole === 'chat' && (
            <>
              <div className="mt-3">
                <label className="block text-xs font-bold text-slate-600 dark:text-content-secondary mb-2 uppercase tracking-wide">
                  {t('onboarding.ai.ollama.modelLabel')}
                </label>
                <select
                  className="w-full p-2.5 border border-slate-300 dark:border-edge-primary rounded-lg text-sm bg-slate-50 dark:bg-surface-tertiary text-slate-700 dark:text-content-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={ollama.selectedModel}
                  onChange={(e) => ollama.setSelectedModel(e.target.value)}
                >
                  {ollama.models.filter(m => !m.toLowerCase().includes('embed')).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="mt-3">
                <label className="block text-xs font-bold text-slate-600 dark:text-content-secondary mb-2 uppercase tracking-wide">
                  {t('onboarding.ai.ollama.chatModelLabel')}
                </label>
                <select
                  className="w-full p-2.5 border border-slate-300 dark:border-edge-primary rounded-lg text-sm bg-slate-50 dark:bg-surface-tertiary text-slate-700 dark:text-content-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={ollama.selectedChatModel}
                  onChange={(e) => ollama.setSelectedChatModel(e.target.value)}
                >
                  <option value="">{t('settings.misc.useMainModel')}</option>
                  {ollama.models.filter(m => !m.toLowerCase().includes('embed')).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 dark:text-content-secondary mt-1">{t('onboarding.ai.ollama.chatModelHelp')}</p>
              </div>
            </>
          )}

          {ollama.models.length > 0 && activeAiRole === 'embeddings' && (
            <div className="mt-3">
              <label className="block text-xs font-bold text-slate-600 dark:text-content-secondary mb-2 uppercase tracking-wide">
                {t('settings.fields.embeddingModel', { provider: 'Ollama' })}
              </label>
              <select
                className="w-full p-2.5 border border-slate-300 dark:border-edge-primary rounded-lg text-sm bg-slate-50 dark:bg-surface-tertiary text-slate-700 dark:text-content-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={ollama.embeddingModel}
                onChange={(e) => ollama.setEmbeddingModel(e.target.value)}
              >
                {ollama.models.filter(m => m.toLowerCase().includes('embed')).length === 0
                  ? <option value={ollama.embeddingModel}>{ollama.embeddingModel}</option>
                  : ollama.models.filter(m => m.toLowerCase().includes('embed')).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))
                }
              </select>
              <p className="text-xs text-slate-400 dark:text-content-secondary mt-1">{t('settings.helpText.embeddingModel')}</p>
            </div>
          )}
        </div>
      </div>

      {/* LM Studio */}
      <div
        className={`relative bg-white dark:bg-surface-secondary border-2 rounded-2xl p-5 cursor-pointer transition-all flex flex-col h-full overflow-hidden
          ${aiProvider === 'lmstudio'
            ? 'border-blue-500 bg-blue-50/20 shadow-none ring-1 ring-blue-500/20'
            : 'border-slate-200 dark:border-edge-primary hover:border-blue-400 hover:shadow-lg'}`}
        onClick={() => setAiProvider('lmstudio')}
      >
        <div className="flex justify-between items-start mb-3 gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-surface-secondary border border-slate-200 dark:border-edge-primary shadow-sm flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
                <rect width="36" height="36" rx="9" fill="#6D28D9"/>
                <rect x="7" y="9"  width="22" height="3.5" rx="1.75" fill="rgba(255,255,255,0.95)"/>
                <rect x="5" y="16" width="26" height="3.5" rx="1.75" fill="rgba(255,255,255,0.95)"/>
                <rect x="9" y="23" width="18" height="3.5" rx="1.75" fill="rgba(255,255,255,0.95)"/>
              </svg>
            </div>
            <div className="min-w-0">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <h3 className="text-xl font-bold text-slate-900 dark:text-content-primary leading-tight">LM Studio (Local)</h3>
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
              <p className="text-slate-500 dark:text-content-secondary text-sm">{t('onboarding.ai.lmstudio.subtitle')}</p>
            </div>
          </div>
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 mt-6
            ${aiProvider === 'lmstudio' ? 'border-blue-500 bg-blue-500' : 'border-slate-300 dark:border-edge-primary'}`}>
            <div className={`w-2.5 h-2.5 rounded-full bg-white transition-transform ${aiProvider === 'lmstudio' ? 'scale-100' : 'scale-0'}`}></div>
          </div>
        </div>

        <p className="text-slate-500 dark:text-content-secondary mb-2 leading-relaxed text-sm">{t('onboarding.ai.lmstudio.description')}</p>

        <ul className="flex flex-col gap-1.5 mb-4">
          <li className="flex items-center gap-2 text-slate-600 dark:text-content-secondary text-xs">
            <FaCheckCircle className="text-blue-500 text-sm flex-shrink-0" />
            <span>{t('onboarding.ai.lmstudio.private')}</span>
          </li>
          <li className="flex items-center gap-2 text-slate-600 dark:text-content-secondary text-xs">
            <FaCheckCircle className="text-blue-500 text-sm flex-shrink-0" />
            <span>{t('onboarding.ai.lmstudio.compatible')}</span>
          </li>
        </ul>

        <div className="mt-auto pt-4 border-t border-slate-100 dark:border-edge-primary" onClick={(e) => e.stopPropagation()}>
          <label className="block text-xs font-bold text-slate-600 dark:text-content-secondary mb-2 uppercase tracking-wide">
            {t('onboarding.ai.lmstudio.urlLabel')}
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              type="text"
              className="flex-1 p-2.5 border border-slate-300 dark:border-edge-primary rounded-lg text-sm font-mono bg-slate-50 dark:bg-surface-tertiary text-slate-700 dark:text-content-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={lmStudio.host}
              onChange={(e) => lmStudio.setHost(e.target.value)}
              placeholder="http://localhost:1234/v1"
              style={{ minWidth: '200px' }}
            />
            <button
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors border
                ${lmStudio.status === 'checking'
                  ? 'bg-slate-100 dark:bg-surface-tertiary text-slate-400 dark:text-content-secondary border-slate-200 dark:border-edge-primary cursor-not-allowed'
                  : lmStudio.status === 'success'
                    ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-500 hover:text-white hover:border-blue-500'
                    : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-sm'}`}
              onClick={lmStudio.checkConnection}
              disabled={lmStudio.status === 'checking'}
            >
              {lmStudio.status === 'checking' ? t('onboarding.ai.ollama.checking') : t('onboarding.ai.ollama.testBtn')}
            </button>
          </div>

          {aiProvider === 'lmstudio' && lmStudio.status === 'idle' && (
            <div className="text-amber-600 text-xs flex items-center gap-2 mb-2 font-medium">
              <FaExclamationTriangle /> {t('onboarding.ai.testToContinue')}
            </div>
          )}
          {lmStudio.status === 'success' && (
            <div className="text-emerald-600 text-xs flex items-center gap-2 mb-2 font-medium">
              <FaCheckCircle /> {t('onboarding.ai.ollama.connected')} {lmStudio.models.length > 0 ? lmStudio.models[0].name : 'LM Studio'}
            </div>
          )}
          {lmStudio.status === 'error' && (
            <div className="text-red-500 text-xs flex items-center gap-2 mb-2 font-medium">
              <FaExclamationTriangle /> {t('onboarding.ai.ollama.connFailed')}
            </div>
          )}

          {lmStudio.models.length > 0 && activeAiRole === 'chat' && (
            <>
              <div className="mt-3">
                <label className="block text-xs font-bold text-slate-600 dark:text-content-secondary mb-2 uppercase tracking-wide">
                  {t('onboarding.ai.ollama.modelLabel')}
                </label>
                <select
                  className="w-full p-2.5 border border-slate-300 dark:border-edge-primary rounded-lg text-sm bg-slate-50 dark:bg-surface-tertiary text-slate-700 dark:text-content-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={lmStudio.selectedModel}
                  onChange={(e) => lmStudio.setSelectedModel(e.target.value)}
                >
                  {lmStudio.models.filter(m => !m.name.toLowerCase().includes('embed')).map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="mt-3">
                <label className="block text-xs font-bold text-slate-600 dark:text-content-secondary mb-2 uppercase tracking-wide">
                  {t('onboarding.ai.ollama.chatModelLabel')}
                </label>
                <select
                  className="w-full p-2.5 border border-slate-300 dark:border-edge-primary rounded-lg text-sm bg-slate-50 dark:bg-surface-tertiary text-slate-700 dark:text-content-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={lmStudio.selectedChatModel}
                  onChange={(e) => lmStudio.setSelectedChatModel(e.target.value)}
                >
                  <option value="">{t('settings.misc.useMainModel')}</option>
                  {lmStudio.models.filter(m => !m.name.toLowerCase().includes('embed')).map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 dark:text-content-secondary mt-1">{t('onboarding.ai.ollama.chatModelHelp')}</p>
              </div>
            </>
          )}

          {activeAiRole === 'embeddings' && (
            <div className="mt-3">
              <label className="block text-xs font-bold text-slate-600 dark:text-content-secondary mb-2 uppercase tracking-wide">
                {t('settings.fields.embeddingModel', { provider: 'LM Studio' })}
              </label>
              {lmStudio.models.filter(m => m.name.toLowerCase().includes('embed')).length > 0 ? (
                <select
                  className="w-full p-2.5 border border-slate-300 dark:border-edge-primary rounded-lg text-sm bg-slate-50 dark:bg-surface-tertiary text-slate-700 dark:text-content-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={lmStudio.embeddingModel}
                  onChange={(e) => lmStudio.setEmbeddingModel(e.target.value)}
                >
                  {lmStudio.models.filter(m => m.name.toLowerCase().includes('embed')).map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="w-full p-2.5 border border-slate-300 dark:border-edge-primary rounded-lg text-sm bg-slate-50 dark:bg-surface-tertiary text-slate-700 dark:text-content-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={lmStudio.embeddingModel}
                  onChange={(e) => lmStudio.setEmbeddingModel(e.target.value)}
                  placeholder="nomic-embed-text"
                />
              )}
              <p className="text-xs text-slate-400 dark:text-content-secondary mt-1">{t('settings.helpText.embeddingModel')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
