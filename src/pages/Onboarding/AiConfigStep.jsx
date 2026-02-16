import React from 'react';
import { FaRobot, FaServer, FaCheckCircle, FaExclamationTriangle, FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import OnboardingFooter from './OnboardingFooter';

const AiConfigStep = ({
  aiProvider,
  setAiProvider,
  ollamaHost,
  setOllamaHost,
  checkOllama,
  ollamaStatus,
  ollamaModels,
  selectedOllamaModel,
  setSelectedOllamaModel,
  geminiKey,
  setGeminiKey,
  onBack,
  onNext,
  StepProgressComponent
}) => {
  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <div className="flex-1 max-w-6xl mx-auto w-full px-8 py-8 flex flex-col overflow-y-auto">
        {/* Step Progress */}
        {StepProgressComponent && <div className="mb-8">{StepProgressComponent}</div>}

        {/* Header */}
        <div className="text-center mb-5">
          <h1 className="text-3xl font-extrabold text-slate-900 mb-3">Configure your AI Intelligence</h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto leading-relaxed">
            Choose how AIRecorder processes your audio. You can change this later in settings.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start mb-4">
          
          {/* Option 1: Local AI (Ollama) */}
          <div 
            className={`
              relative bg-white border-2 rounded-2xl p-8 cursor-pointer transition-all flex flex-col h-full min-h-[480px] overflow-hidden group
              ${aiProvider === 'ollama' 
                ? 'border-blue-500 bg-blue-50/20 shadow-none ring-1 ring-blue-500/20' 
                : 'border-slate-200 hover:border-blue-400 hover:shadow-lg'}
            `}
            onClick={() => setAiProvider('ollama')}
          >
            <div className="absolute top-0 right-0 bg-blue-500/10 text-blue-600 text-xs font-bold px-4 py-2 rounded-bl-2xl tracking-wider">
              RECOMMENDED
            </div>

            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center text-2xl">
                  <FaRobot />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 leading-tight">Ollama (Local)</h3>
                  <p className="text-slate-500 text-sm">Self-hosted processing</p>
                </div>
              </div>
              <div className={`
                w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                ${aiProvider === 'ollama' ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}
              `}>
                <div className={`w-2.5 h-2.5 rounded-full bg-white transition-transform ${aiProvider === 'ollama' ? 'scale-100' : 'scale-0'}`}></div>
              </div>
            </div>

            <p className="text-slate-600 mb-6 leading-relaxed">
              Run AI entirely on your machine. Ideal for total privacy and offline workflows, but requires powerful hardware.
            </p>

            <ul className="flex flex-col gap-3 mb-8">
              <li className="flex items-center gap-3 text-slate-600 text-sm">
                <FaCheckCircle className="text-blue-500 text-lg flex-shrink-0" />
                <span>100% Private & Offline</span>
              </li>
              <li className="flex items-center gap-3 text-slate-600 text-sm">
                <FaCheckCircle className="text-blue-500 text-lg flex-shrink-0" />
                <span>No subscription fees</span>
              </li>
              <li className="flex items-center gap-3 text-slate-600 text-sm">
                <FaExclamationTriangle className="text-orange-500 text-lg flex-shrink-0" />
                <span>Requires 16GB+ RAM & GPU</span>
              </li>
            </ul>

            {/* Interactive Module for Ollama */}
            <div 
              className="mt-auto pt-6 border-t border-slate-100" 
              onClick={(e) => e.stopPropagation()}
            >
              <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">API Endpoint URL</label>
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
                  className={`
                    px-4 py-2 rounded-lg font-medium text-sm transition-colors border
                    ${ollamaStatus === 'checking' 
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                      : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-500 hover:text-white hover:border-blue-500'}
                  `}
                  onClick={checkOllama}
                  disabled={ollamaStatus === 'checking'}
                >
                  {ollamaStatus === 'checking' ? 'Checking...' : 'Test'}
                </button>
              </div>
              
              {ollamaStatus === 'success' && (
                <div className="text-emerald-600 text-xs flex items-center gap-2 mb-2 font-medium">
                  <FaCheckCircle /> Connected: {ollamaModels.length > 0 ? (ollamaModels[0]?.name || ollamaModels[0]) : 'Ollama'}
                </div>
              )}
              
              {ollamaStatus === 'error' && (
                <div className="text-red-500 text-xs flex items-center gap-2 mb-2 font-medium">
                  <FaExclamationTriangle /> Connection failed
                </div>
              )}

              {ollamaModels.length > 0 && (
                <div className="mt-3">
                  <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Model</label>
                  <select 
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={selectedOllamaModel}
                    onChange={(e) => setSelectedOllamaModel(e.target.value)}
                  >
                    {ollamaModels.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Option 2: Cloud AI (Gemini) */}
          <div 
            className={`
              relative bg-white border-2 rounded-2xl p-8 cursor-pointer transition-all flex flex-col h-full min-h-[480px] overflow-hidden group
              ${aiProvider === 'gemini' 
                ? 'border-blue-500 bg-blue-50/20 shadow-none ring-1 ring-blue-500/20' 
                : 'border-slate-200 hover:border-blue-400 hover:shadow-lg'}
            `}
            onClick={() => setAiProvider('gemini')}
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center text-2xl">
                  <FaServer />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 leading-tight">Google Gemini (Cloud)</h3>
                  <p className="text-slate-500 text-sm">Managed processing</p>
                </div>
              </div>
              <div className={`
                w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                ${aiProvider === 'gemini' ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}
              `}>
                <div className={`w-2.5 h-2.5 rounded-full bg-white transition-transform ${aiProvider === 'gemini' ? 'scale-100' : 'scale-0'}`}></div>
              </div>
            </div>

            <p className="text-slate-600 mb-6 leading-relaxed">
              Perfect for getting started immediately. We handle the heavy lifting using Google's powerful Gemini models.
            </p>

            <ul className="flex flex-col gap-3 mb-8">
              <li className="flex items-center gap-3 text-slate-600 text-sm">
                <FaCheckCircle className="text-blue-500 text-lg flex-shrink-0" />
                <span>Zero configuration required</span>
              </li>
              <li className="flex items-center gap-3 text-slate-600 text-sm">
                <FaCheckCircle className="text-blue-500 text-lg flex-shrink-0" />
                <span>Highest transcription accuracy</span>
              </li>
              <li className="flex items-center gap-3 text-slate-600 text-sm">
                <FaCheckCircle className="text-blue-500 text-lg flex-shrink-0" />
                <span>Access from any device</span>
              </li>
            </ul>

            <div 
              className="mt-auto pt-6 border-t border-slate-100" 
              onClick={(e) => e.stopPropagation()}
            >
               <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Gemini API Key</label>
               <input 
                  type="password" 
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-mono bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="Paste your API key here"
                />
            </div>

            <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500">
              <div className="flex items-center gap-2 font-bold text-slate-700 mb-1">
                <FaCheckCircle className="text-emerald-500" /> Data Privacy
              </div>
              Your data is encrypted at rest and in transit. We do not use your data to train our models.
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <OnboardingFooter onBack={onBack}>
        <div className="flex items-center gap-6">
          <span className="text-sm text-slate-400 font-medium hidden sm:inline-block">You can change this anytime</span>
          <button 
            onClick={onNext}
            disabled={aiProvider === 'ollama' && ollamaStatus !== 'success'}
            className={`
              flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white transition-all shadow-md hover:shadow-lg
              ${(aiProvider === 'ollama' && ollamaStatus !== 'success')
                ? 'bg-slate-300 cursor-not-allowed shadow-none' 
                : 'bg-blue-600 hover:bg-blue-700 transform hover:-translate-y-0.5'}
            `}
          >
            Next Step <FaArrowRight />
          </button>
        </div>
      </OnboardingFooter>
    </div>
  );
};

export default AiConfigStep;
