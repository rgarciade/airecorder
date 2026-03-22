import React from 'react';
import { FaFolder, FaDatabase, FaArrowRight, FaPalette } from 'react-icons/fa';
import { MdLightMode, MdDarkMode, MdBrightness6 } from 'react-icons/md';
import OnboardingFooter from './OnboardingFooter';

const THEME_OPTIONS = [
  { value: 'system', Icon: MdBrightness6, labelKey: 'themeSystem' },
  { value: 'light',  Icon: MdLightMode,   labelKey: 'themeLight' },
  { value: 'dark',   Icon: MdDarkMode,    labelKey: 'themeDark' },
];

const PreferencesStep = ({
  t,
  outputDirectory,
  setOutputDirectory,
  databaseDirectory,
  setDatabaseDirectory,
  selectedTheme = 'system',
  onThemeChange,
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
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-surface-primary overflow-hidden">
      <div className="flex-1 max-w-3xl mx-auto w-full px-8 py-8 flex flex-col overflow-y-auto">
        {StepProgressComponent && (
          <div className="mb-6 w-full">{StepProgressComponent}</div>
        )}

        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-content-primary mb-2">
            {t('onboarding.storage.title')}
          </h1>
          <p className="text-slate-500 dark:text-content-secondary text-base leading-relaxed">
            {t('onboarding.storage.subtitle')}
          </p>
        </div>

        <div className="flex flex-col gap-5 flex-1">

          {/* Directorio de Grabaciones */}
          <div className="bg-white dark:bg-surface-secondary border border-slate-200 dark:border-edge-primary rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
                <FaFolder size={18} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-content-primary text-base leading-tight">
                  {t('onboarding.storage.recordingsLabel')}
                </h3>
                <span className="text-xs text-slate-400 dark:text-content-secondary font-medium uppercase tracking-wide">
                  {t('onboarding.storage.optional')}
                </span>
              </div>
            </div>

            <div className="flex gap-3 items-center">
              <div className="flex-1 bg-slate-50 dark:bg-surface-tertiary border border-slate-200 dark:border-edge-primary rounded-lg px-4 py-2.5 text-sm text-slate-500 dark:text-content-secondary truncate">
                {outputDirectory || t('onboarding.storage.recordingsDefault')}
              </div>
              <button
                onClick={handleSelectOutputDirectory}
                className="px-4 py-2.5 border border-slate-200 dark:border-edge-primary rounded-lg bg-white dark:bg-surface-secondary text-slate-600 dark:text-content-secondary text-sm font-medium hover:bg-slate-50 dark:hover:bg-surface-tertiary hover:border-slate-300 dark:hover:border-edge-primary transition-colors whitespace-nowrap"
              >
                {t('onboarding.storage.changeBtn')}
              </button>
            </div>
          </div>

          {/* Directorio de Base de Datos */}
          <div className="bg-white dark:bg-surface-secondary border border-slate-200 dark:border-edge-primary rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
                <FaDatabase size={16} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-content-primary text-base leading-tight">
                  {t('onboarding.storage.dbLabel')}
                </h3>
                <span className="text-xs text-slate-400 dark:text-content-secondary font-medium uppercase tracking-wide">
                  {t('onboarding.storage.optional')}
                </span>
              </div>
            </div>

            <div className="flex gap-3 items-center">
              <div className="flex-1 bg-slate-50 dark:bg-surface-tertiary border border-slate-200 dark:border-edge-primary rounded-lg px-4 py-2.5 text-sm text-slate-500 dark:text-content-secondary truncate">
                {databaseDirectory
                  ? `${databaseDirectory}/recordings.db`
                  : t('onboarding.storage.dbDefault')}
              </div>
              <button
                onClick={handleSelectDatabaseDirectory}
                className="px-4 py-2.5 border border-slate-200 dark:border-edge-primary rounded-lg bg-white dark:bg-surface-secondary text-slate-600 dark:text-content-secondary text-sm font-medium hover:bg-slate-50 dark:hover:bg-surface-tertiary hover:border-slate-300 dark:hover:border-edge-primary transition-colors whitespace-nowrap"
              >
                {t('onboarding.storage.changeBtn')}
              </button>
            </div>
          </div>

          {/* Apariencia */}
          <div className="bg-white dark:bg-surface-secondary border border-slate-200 dark:border-edge-primary rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-violet-50 dark:bg-violet-900/30 rounded-xl flex items-center justify-center text-violet-500 dark:text-violet-400">
                <FaPalette size={16} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-content-primary text-base leading-tight">
                  {t('onboarding.permissions.theme')}
                </h3>
                <p className="text-slate-400 dark:text-content-secondary text-xs mt-0.5">
                  {t('onboarding.permissions.themeDesc')}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {THEME_OPTIONS.map(({ value, Icon, labelKey }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onThemeChange && onThemeChange(value)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border-2 text-sm font-semibold transition-all
                    ${selectedTheme === value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'border-slate-200 dark:border-edge-primary bg-slate-50 dark:bg-surface-tertiary text-slate-500 dark:text-content-secondary hover:border-blue-300'
                    }`}
                >
                  <Icon size={15} />
                  {t(`onboarding.permissions.${labelKey}`)}
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>

      <OnboardingFooter onBack={onBack} t={t}>
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
          {t('onboarding.storage.nextBtn')}
          <FaArrowRight size={14} />
        </button>
      </OnboardingFooter>
    </div>
  );
};

export default PreferencesStep;
