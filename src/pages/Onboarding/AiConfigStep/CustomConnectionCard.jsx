import React from 'react';
import { FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { MdAddLink } from 'react-icons/md';

export default function CustomConnectionCard({ t, activeAiRole, aiProvider, setAiProvider, custom }) {
  const selectedModel = activeAiRole === 'general' ? custom.chatModel : custom.embedModel;
  const setSelectedModel = activeAiRole === 'general' ? custom.setChatModel : custom.setEmbedModel;

  return (
    <div
      className={`relative bg-white dark:bg-surface-secondary border-2 rounded-2xl p-6 cursor-pointer transition-all flex flex-col
        ${aiProvider === 'custom'
          ? 'border-cyan-500 bg-cyan-50/20 ring-1 ring-cyan-500/20'
          : 'border-slate-200 dark:border-edge-primary hover:border-cyan-400 hover:shadow-lg'}`}
      onClick={() => setAiProvider('custom')}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center text-xl">
            <MdAddLink />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-content-primary">{t('onboarding.ai.custom.title')}</h3>
            <p className="text-slate-400 dark:text-content-secondary text-xs">{t('onboarding.ai.custom.subtitle')}</p>
          </div>
        </div>
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all mt-[5px]
          ${aiProvider === 'custom' ? 'border-cyan-500 bg-cyan-500' : 'border-slate-300 dark:border-edge-primary'}`}>
          <div className={`w-2 h-2 rounded-full bg-white transition-transform ${aiProvider === 'custom' ? 'scale-100' : 'scale-0'}`}></div>
        </div>
      </div>

      <p className="text-slate-500 dark:text-content-secondary text-sm leading-relaxed mb-4">{t('onboarding.ai.custom.description')}</p>

      {aiProvider === 'custom' && (
        <div className="mt-auto pt-4 border-t border-slate-100 dark:border-edge-primary flex flex-col gap-2.5" onClick={(e) => e.stopPropagation()}>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-content-secondary mb-2 uppercase tracking-wide">
              {t('onboarding.ai.custom.nameLabel')}
            </label>
            <input
              type="text"
              className="w-full p-2.5 border border-slate-300 dark:border-edge-primary rounded-lg text-sm bg-slate-50 dark:bg-surface-tertiary text-slate-700 dark:text-content-primary focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              value={custom.name}
              onChange={(e) => custom.setName(e.target.value)}
              placeholder={t('settings.customConnections.namePlaceholder')}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-content-secondary mb-2 uppercase tracking-wide">
              {t('onboarding.ai.custom.baseUrlLabel')}
            </label>
            <input
              type="text"
              className="w-full p-2.5 border border-slate-300 dark:border-edge-primary rounded-lg text-sm font-mono bg-slate-50 dark:bg-surface-tertiary text-slate-700 dark:text-content-primary focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              value={custom.baseUrl}
              onChange={(e) => custom.setBaseUrl(e.target.value)}
              placeholder={t('settings.customConnections.baseUrlPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-content-secondary mb-2 uppercase tracking-wide">
              {t('settings.fields.apiKey')}
            </label>
            <input
              type="password"
              className="w-full p-2.5 border border-slate-300 dark:border-edge-primary rounded-lg text-sm bg-slate-50 dark:bg-surface-tertiary text-slate-700 dark:text-content-primary focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              value={custom.apiKey}
              onChange={(e) => custom.setApiKey(e.target.value)}
              placeholder={t('settings.customConnections.apiKeyPlaceholder')}
            />
          </div>

          <button
            type="button"
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors border self-start
              ${custom.testStatus === 'testing'
                ? 'bg-slate-100 dark:bg-surface-tertiary text-slate-400 dark:text-content-secondary border-slate-200 dark:border-edge-primary cursor-not-allowed'
                : custom.testStatus === 'success'
                  ? 'bg-cyan-50 text-cyan-600 border-cyan-200 hover:bg-cyan-500 hover:text-white hover:border-cyan-500'
                  : 'bg-cyan-600 text-white border-cyan-600 hover:bg-cyan-700 shadow-sm'}`}
            onClick={custom.testConnection}
            disabled={custom.testStatus === 'testing' || !custom.baseUrl.trim()}
          >
            {custom.testStatus === 'testing' ? t('settings.customConnections.testing') : t('settings.customConnections.testConnection')}
          </button>

          {custom.testStatus === 'success' && (
            <div className="text-emerald-600 text-xs flex items-center gap-2 font-medium">
              <FaCheckCircle /> {custom.models.length} {t('settings.customConnections.section')}
            </div>
          )}
          {custom.testStatus === 'error' && (
            <div className="text-red-500 text-xs flex items-center gap-2 font-medium">
              <FaExclamationTriangle /> {t('settings.customConnections.connectionError')}
            </div>
          )}

          {custom.models.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-content-secondary mb-2 uppercase tracking-wide">
                {activeAiRole === 'general' ? t('settings.fields.generalModel') : t('settings.fields.embeddingModel', { provider: custom.name })}
              </label>
              <select
                className="w-full p-2.5 border border-slate-300 dark:border-edge-primary rounded-lg text-sm bg-slate-50 dark:bg-surface-tertiary text-slate-700 dark:text-content-primary focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {custom.models.map(m => <option key={m.name} value={m.name}>{m.label || m.name}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
