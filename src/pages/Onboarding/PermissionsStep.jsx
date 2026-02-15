import React from 'react';
import { FaMicrophone, FaVolumeUp, FaBell, FaCheck, FaArrowRight, FaArrowLeft } from 'react-icons/fa';
import OnboardingFooter from './OnboardingFooter';

const PermissionsStep = ({
  micStatus,
  systemAudioStatus,
  notificationStatus,
  onRequestMic,
  onRequestSystemAudio,
  onToggleNotifications,
  onBack,
  onNext,
  StepProgressComponent
}) => {
  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-y-auto">
      <div className="flex-1 max-w-4xl mx-auto w-full px-8 py-8 flex flex-col">
        {/* Step Progress passed from parent to maintain consistency */}
        {StepProgressComponent && <div className="mb-8">{StepProgressComponent}</div>}

        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-slate-900 mb-3">Enable Permissions</h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto leading-relaxed">
            To record and transcribe your audio accurately, AIRecorder needs access to your system devices. We value your privacy and only record when you tell us to.
          </p>
        </div>

        <div className="flex flex-col gap-4 max-w-3xl mx-auto w-full">
          
          {/* Microphone Card */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 flex items-center gap-5 transition-all hover:shadow-sm">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-xl flex-shrink-0">
              <FaMicrophone />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="font-bold text-slate-900 text-lg">Microphone Access</h3>
                {micStatus === 'granted' && (
                  <span className="bg-emerald-200/50 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">Granted</span>
                )}
              </div>
              <p className="text-slate-500 text-sm">Required to record your voice during meetings.</p>
            </div>
            <div className="flex-shrink-0">
              {micStatus === 'granted' ? (
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white text-lg shadow-sm">
                  <FaCheck />
                </div>
              ) : (
                <button 
                  onClick={onRequestMic}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-full font-semibold text-sm flex items-center gap-2 transition-colors shadow-sm"
                >
                  Grant <FaArrowRight size={12} />
                </button>
              )}
            </div>
          </div>

          {/* System Audio Card */}
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 flex items-center gap-5 transition-all hover:shadow-sm">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-500 text-xl flex-shrink-0">
              <FaVolumeUp />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="font-bold text-slate-900 text-lg">System Audio</h3>
                {systemAudioStatus === 'granted' ? (
                   <span className="bg-emerald-200/50 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">Granted</span>
                ) : (
                   <span className="bg-red-200/50 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full">Required</span>
                )}
              </div>
              <p className="text-slate-500 text-sm">Required to capture audio from remote participants.</p>
            </div>
            <div className="flex-shrink-0">
              {systemAudioStatus === 'granted' ? (
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white text-lg shadow-sm">
                  <FaCheck />
                </div>
              ) : (
                <button 
                  onClick={onRequestSystemAudio}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-full font-semibold text-sm flex items-center gap-2 transition-colors shadow-sm"
                >
                  Grant <FaArrowRight size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Notifications Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-center gap-5 transition-all hover:shadow-sm bg-white">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 text-xl flex-shrink-0">
              <FaBell />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="font-bold text-slate-900 text-lg">Notifications</h3>
                <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">Optional</span>
              </div>
              <p className="text-slate-500 text-sm">Get alerts when transcription is ready.</p>
            </div>
            <div className="flex-shrink-0">
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={notificationStatus === 'granted'}
                  onChange={onToggleNotifications}
                />
                <div className="w-14 h-8 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <OnboardingFooter onBack={onBack}>
        <div className="flex flex-col items-end">
          <button 
            onClick={onNext}
            disabled={micStatus !== 'granted'}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all shadow-md hover:shadow-lg
              ${micStatus === 'granted' 
                ? 'bg-blue-600 hover:bg-blue-700 transform hover:-translate-y-0.5' 
                : 'bg-slate-300 cursor-not-allowed shadow-none'}
            `}
          >
            Finish Setup <FaArrowRight />
          </button>
          {micStatus !== 'granted' && (
            <span className="text-red-500 text-xs font-medium mt-2">Please grant required permissions</span>
          )}
        </div>
      </OnboardingFooter>
    </div>
  );
};

export default PermissionsStep;
