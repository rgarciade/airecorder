import React from 'react';
import { FaFolder, FaDatabase, FaArrowRight, FaArrowLeft } from 'react-icons/fa';

const StorageStep = ({
  t,
  outputDirectory,
  setOutputDirectory,
  databaseDirectory,
  setDatabaseDirectory,
  onBack,
  onNext,
  StepProgressComponent
}) => {

  const handleSelectOutputDirectory = async () => {
    if (window.electronAPI?.selectDirectory) {
      const dir = await window.electronAPI.selectDirectory();
      if (dir) setOutputDirectory(dir);
    }
  };

  const handleSelectDatabaseDirectory = async () => {
    if (window.electronAPI?.selectDirectory) {
      const dir = await window.electronAPI.selectDirectory();
      if (dir) setDatabaseDirectory(dir);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-y-auto">
      <div className="flex-1 max-w-3xl mx-auto w-full px-8 py-8 flex flex-col">
        {StepProgressComponent && (
          <div className="mb-6 w-full">{StepProgressComponent}</div>
        )}

        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">
            {t('onboarding.storage.title')}
          </h1>
          <p className="text-slate-500 text-base leading-relaxed">
            {t('onboarding.storage.subtitle')}
          </p>
        </div>

        <div className="flex flex-col gap-5 flex-1">

          {/* Directorio de Grabaciones */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
                <FaFolder size={18} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base leading-tight">
                  {t('onboarding.storage.recordingsLabel')}
                </h3>
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                  {t('onboarding.storage.optional')}
                </span>
              </div>
            </div>

            <div className="flex gap-3 items-center">
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-500 truncate">
                {outputDirectory || t('onboarding.storage.recordingsDefault')}
              </div>
              <button
                onClick={handleSelectOutputDirectory}
                className="px-4 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-colors whitespace-nowrap"
              >
                {t('onboarding.storage.changeBtn')}
              </button>
            </div>
          </div>

          {/* Directorio de Base de Datos */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
                <FaDatabase size={16} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base leading-tight">
                  {t('onboarding.storage.dbLabel')}
                </h3>
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                  {t('onboarding.storage.optional')}
                </span>
              </div>
            </div>

            <div className="flex gap-3 items-center">
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-500 truncate">
                {databaseDirectory
                  ? `${databaseDirectory}/recordings.db`
                  : t('onboarding.storage.dbDefault')}
              </div>
              <button
                onClick={handleSelectDatabaseDirectory}
                className="px-4 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-colors whitespace-nowrap"
              >
                {t('onboarding.storage.changeBtn')}
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-100">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-5 py-3 text-slate-500 font-medium rounded-xl hover:bg-slate-100 transition-colors"
          >
            <FaArrowLeft size={14} />
            {t('onboarding.back')}
          </button>

          <button
            onClick={onNext}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            {t('onboarding.storage.nextBtn')}
            <FaArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default StorageStep;
