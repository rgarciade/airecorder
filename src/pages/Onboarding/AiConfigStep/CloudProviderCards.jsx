import React from 'react';
import { FaRobot, FaExclamationTriangle, FaBrain } from 'react-icons/fa';
import { MdAutoAwesome, MdRefresh } from 'react-icons/md';
import { SiOpenai } from 'react-icons/si';

const GEMINI_EMBEDDING_MODEL = 'text-embedding-004';
const KIMI_EMBEDDING_MODEL = 'moonshot-embedding-v1';
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';

function ModelPicker({ t, activeAiRole, ring, models, modelsLoading, apiKey, selectedModel, setSelectedModel, loadModels, fixedEmbeddingModel }) {
  if (activeAiRole === 'embeddings') {
    return (
      <div className="mt-3">
        <label className="block text-xs font-bold text-slate-600 dark:text-content-secondary mb-2 uppercase tracking-wide">
          {t('settings.providers.embeddingModelLabel')}
        </label>
        <p className="text-sm text-slate-500 dark:text-content-secondary font-mono">{fixedEmbeddingModel}</p>
      </div>
    );
  }
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs font-bold text-slate-600 dark:text-content-secondary uppercase tracking-wide">
          {t('settings.fields.model')}
        </label>
        <button
          type="button"
          className={`text-xs font-semibold flex items-center gap-1 ${ring.text} disabled:opacity-40 disabled:cursor-not-allowed`}
          onClick={() => loadModels(apiKey)}
          disabled={!apiKey.trim() || modelsLoading}
        >
          <MdRefresh size={13} className={modelsLoading ? 'animate-spin' : ''} />
          {t('settings.buttons.refresh')}
        </button>
      </div>
      <select
        className={`w-full p-2.5 border border-slate-300 dark:border-edge-primary rounded-lg text-sm bg-slate-50 dark:bg-surface-tertiary text-slate-700 dark:text-content-primary focus:outline-none focus:ring-2 ${ring.focus} focus:border-transparent`}
        value={selectedModel}
        onChange={(e) => setSelectedModel(e.target.value)}
        disabled={modelsLoading || models.length === 0}
      >
        {models.length === 0 ? (
          <option value="">{modelsLoading ? t('settings.misc.loading') : t('settings.misc.noModels')}</option>
        ) : (
          models.map(m => <option key={m.name} value={m.name}>{m.label || m.name}</option>)
        )}
      </select>
    </div>
  );
}

export default function CloudProviderCards({ t, activeAiRole, aiProvider, setAiProvider, openai, gemini, kimi, deepseek }) {
  return (
    <div className="flex flex-col gap-5 mb-4">

      {/* Beta warning banner */}
      <div className="flex items-start gap-3 bg-amber-50 dark:bg-surface-tertiary border border-amber-200 dark:border-edge-primary rounded-xl px-5 py-4">
        <FaExclamationTriangle className="text-amber-500 text-lg flex-shrink-0 mt-0.5" />
        <p className="text-amber-800 dark:text-content-secondary text-sm leading-relaxed">{t('onboarding.ai.betaWarning')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

        {/* OpenAI */}
        <div
          className={`relative bg-white dark:bg-surface-secondary border-2 rounded-2xl p-6 cursor-pointer transition-all flex flex-col
            ${aiProvider === 'openai'
              ? 'border-emerald-500 bg-emerald-50/20 ring-1 ring-emerald-500/20'
              : 'border-slate-200 dark:border-edge-primary hover:border-emerald-400 hover:shadow-lg'}`}
          onClick={() => setAiProvider('openai')}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
                <SiOpenai />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-content-primary">OpenAI</h3>
                <p className="text-slate-400 dark:text-content-secondary text-xs">GPT</p>
              </div>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all mt-[5px]
              ${aiProvider === 'openai' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-edge-primary'}`}>
              <div className={`w-2 h-2 rounded-full bg-white transition-transform ${aiProvider === 'openai' ? 'scale-100' : 'scale-0'}`}></div>
            </div>
          </div>

          <p className="text-slate-500 dark:text-content-secondary text-sm leading-relaxed mb-4">{t('onboarding.ai.openai.description')}</p>

          {aiProvider === 'openai' && (
            <div className="mt-auto pt-4 border-t border-slate-100 dark:border-edge-primary" onClick={(e) => e.stopPropagation()}>
              <label className="block text-xs font-bold text-slate-600 dark:text-content-secondary mb-2 uppercase tracking-wide">
                {t('onboarding.ai.openai.apiKeyLabel')}
              </label>
              <input
                type="password"
                className="w-full p-2.5 border border-slate-300 dark:border-edge-primary rounded-lg text-sm bg-slate-50 dark:bg-surface-tertiary text-slate-700 dark:text-content-primary focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                value={openai.apiKey}
                onChange={(e) => openai.setApiKey(e.target.value)}
                placeholder={t('onboarding.ai.apiKeyPlaceholder')}
              />
              <ModelPicker
                t={t} activeAiRole={activeAiRole}
                ring={{ text: 'text-emerald-600', focus: 'focus:ring-emerald-500' }}
                models={openai.models} modelsLoading={openai.modelsLoading} apiKey={openai.apiKey}
                selectedModel={openai.selectedModel} setSelectedModel={openai.setSelectedModel}
                loadModels={openai.loadModels} fixedEmbeddingModel={OPENAI_EMBEDDING_MODEL}
              />
            </div>
          )}
        </div>

        {/* Gemini */}
        <div
          className={`relative bg-white dark:bg-surface-secondary border-2 rounded-2xl p-6 cursor-pointer transition-all flex flex-col
            ${aiProvider === 'gemini'
              ? 'border-indigo-500 bg-indigo-50/20 ring-1 ring-indigo-500/20'
              : 'border-slate-200 dark:border-edge-primary hover:border-indigo-400 hover:shadow-lg'}`}
          onClick={() => setAiProvider('gemini')}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center text-xl">
                <MdAutoAwesome />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-content-primary">Gemini</h3>
                <p className="text-slate-400 dark:text-content-secondary text-xs">Google AI</p>
              </div>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all mt-[5px]
              ${aiProvider === 'gemini' ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300 dark:border-edge-primary'}`}>
              <div className={`w-2 h-2 rounded-full bg-white transition-transform ${aiProvider === 'gemini' ? 'scale-100' : 'scale-0'}`}></div>
            </div>
          </div>

          <p className="text-slate-500 dark:text-content-secondary text-sm leading-relaxed mb-4">{t('onboarding.ai.gemini.description')}</p>

          {aiProvider === 'gemini' && (
            <div className="mt-auto pt-4 border-t border-slate-100 dark:border-edge-primary" onClick={(e) => e.stopPropagation()}>
              <label className="block text-xs font-bold text-slate-600 dark:text-content-secondary mb-2 uppercase tracking-wide">
                {t('onboarding.ai.gemini.apiKeyLabel')}
              </label>
              <input
                type="password"
                className="w-full p-2.5 border border-slate-300 dark:border-edge-primary rounded-lg text-sm bg-slate-50 dark:bg-surface-tertiary text-slate-700 dark:text-content-primary focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                value={gemini.apiKey}
                onChange={(e) => gemini.setApiKey(e.target.value)}
                placeholder={t('onboarding.ai.apiKeyPlaceholder')}
              />
              <ModelPicker
                t={t} activeAiRole={activeAiRole}
                ring={{ text: 'text-indigo-600', focus: 'focus:ring-indigo-500' }}
                models={gemini.models} modelsLoading={gemini.modelsLoading} apiKey={gemini.apiKey}
                selectedModel={gemini.selectedModel} setSelectedModel={gemini.setSelectedModel}
                loadModels={gemini.loadModels} fixedEmbeddingModel={GEMINI_EMBEDDING_MODEL}
              />
            </div>
          )}
        </div>

        {/* Kimi */}
        <div
          className={`relative bg-white dark:bg-surface-secondary border-2 rounded-2xl p-6 cursor-pointer transition-all flex flex-col
            ${aiProvider === 'kimi'
              ? 'border-teal-500 bg-teal-50/20 ring-1 ring-teal-500/20'
              : 'border-slate-200 dark:border-edge-primary hover:border-teal-400 hover:shadow-lg'}`}
          onClick={() => setAiProvider('kimi')}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-500 flex items-center justify-center text-xl">
                <FaRobot />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-content-primary">Kimi</h3>
                <p className="text-slate-400 dark:text-content-secondary text-xs">Moonshot AI</p>
              </div>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all mt-[5px]
              ${aiProvider === 'kimi' ? 'border-teal-500 bg-teal-500' : 'border-slate-300 dark:border-edge-primary'}`}>
              <div className={`w-2 h-2 rounded-full bg-white transition-transform ${aiProvider === 'kimi' ? 'scale-100' : 'scale-0'}`}></div>
            </div>
          </div>

          <p className="text-slate-500 dark:text-content-secondary text-sm leading-relaxed mb-4">{t('onboarding.ai.kimi.description')}</p>

          {aiProvider === 'kimi' && (
            <div className="mt-auto pt-4 border-t border-slate-100 dark:border-edge-primary" onClick={(e) => e.stopPropagation()}>
              <label className="block text-xs font-bold text-slate-600 dark:text-content-secondary mb-2 uppercase tracking-wide">
                {t('onboarding.ai.kimi.apiKeyLabel')}
              </label>
              <input
                type="password"
                className="w-full p-2.5 border border-slate-300 dark:border-edge-primary rounded-lg text-sm bg-slate-50 dark:bg-surface-tertiary text-slate-700 dark:text-content-primary focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                value={kimi.apiKey}
                onChange={(e) => kimi.setApiKey(e.target.value)}
                placeholder={t('onboarding.ai.apiKeyPlaceholder')}
              />
              {activeAiRole === 'general' ? (
                <div className="mt-3">
                  <label className="block text-xs font-bold text-slate-600 dark:text-content-secondary mb-2 uppercase tracking-wide">
                    {t('settings.fields.model')}
                  </label>
                  <select
                    className="w-full p-2.5 border border-slate-300 dark:border-edge-primary rounded-lg text-sm bg-slate-50 dark:bg-surface-tertiary text-slate-700 dark:text-content-primary focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    value={kimi.selectedModel}
                    onChange={(e) => kimi.setSelectedModel(e.target.value)}
                  >
                    {kimi.models.map(m => <option key={m.name} value={m.name}>{m.label || m.name}</option>)}
                  </select>
                </div>
              ) : (
                <div className="mt-3">
                  <label className="block text-xs font-bold text-slate-600 dark:text-content-secondary mb-2 uppercase tracking-wide">
                    {t('settings.providers.embeddingModelLabel')}
                  </label>
                  <p className="text-sm text-slate-500 dark:text-content-secondary font-mono">{KIMI_EMBEDDING_MODEL}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* DeepSeek — no soporta embeddings, se oculta en ese rol */}
        {activeAiRole !== 'embeddings' && (
        <div
          className={`relative bg-white dark:bg-surface-secondary border-2 rounded-2xl p-6 cursor-pointer transition-all flex flex-col
            ${aiProvider === 'deepseek'
              ? 'border-violet-500 bg-violet-50/20 ring-1 ring-violet-500/20'
              : 'border-slate-200 dark:border-edge-primary hover:border-violet-400 hover:shadow-lg'}`}
          onClick={() => setAiProvider('deepseek')}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-500 flex items-center justify-center text-xl">
                <FaBrain />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-content-primary">DeepSeek</h3>
                <p className="text-slate-400 dark:text-content-secondary text-xs">DeepSeek AI</p>
              </div>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all mt-[5px]
              ${aiProvider === 'deepseek' ? 'border-violet-500 bg-violet-500' : 'border-slate-300 dark:border-edge-primary'}`}>
              <div className={`w-2 h-2 rounded-full bg-white transition-transform ${aiProvider === 'deepseek' ? 'scale-100' : 'scale-0'}`}></div>
            </div>
          </div>

          <p className="text-slate-500 dark:text-content-secondary text-sm leading-relaxed mb-4">{t('onboarding.ai.deepseek.description')}</p>

          {aiProvider === 'deepseek' && (
            <div className="mt-auto pt-4 border-t border-slate-100 dark:border-edge-primary" onClick={(e) => e.stopPropagation()}>
              <label className="block text-xs font-bold text-slate-600 dark:text-content-secondary mb-2 uppercase tracking-wide">
                {t('onboarding.ai.deepseek.apiKeyLabel')}
              </label>
              <input
                type="password"
                className="w-full p-2.5 border border-slate-300 dark:border-edge-primary rounded-lg text-sm bg-slate-50 dark:bg-surface-tertiary text-slate-700 dark:text-content-primary focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                value={deepseek.apiKey}
                onChange={(e) => deepseek.setApiKey(e.target.value)}
                placeholder={t('onboarding.ai.apiKeyPlaceholder')}
              />
              <div className="mt-3">
                <label className="block text-xs font-bold text-slate-600 dark:text-content-secondary mb-2 uppercase tracking-wide">
                  {t('settings.fields.model')}
                </label>
                <select
                  className="w-full p-2.5 border border-slate-300 dark:border-edge-primary rounded-lg text-sm bg-slate-50 dark:bg-surface-tertiary text-slate-700 dark:text-content-primary focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  value={deepseek.selectedModel}
                  onChange={(e) => deepseek.setSelectedModel(e.target.value)}
                >
                  {deepseek.models.map(m => <option key={m.name} value={m.name}>{m.label || m.name}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
        )}

      </div>
    </div>
  );
}
