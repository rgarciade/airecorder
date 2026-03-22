import React from 'react';
import { FaArrowLeft } from 'react-icons/fa';

const OnboardingFooter = ({ onBack, children, t }) => {
  return (
    <div className="bg-white dark:bg-surface-secondary border-t border-slate-200 dark:border-edge-primary px-8 md:px-16 py-3 flex justify-between items-center shrink-0">
      <button
        onClick={onBack}
        className="bg-white dark:bg-surface-tertiary border border-slate-200 dark:border-edge-primary text-slate-500 dark:text-content-secondary hover:text-slate-700 dark:hover:text-content-primary hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-surface-primary px-6 py-2 rounded-xl font-semibold flex items-center gap-2 transition-all"
      >
        <FaArrowLeft size={14} /> {t ? t('onboarding.footer.back') : 'Back'}
      </button>

      <div className="flex items-center justify-end">
        {children}
      </div>
    </div>
  );
};

export default OnboardingFooter;
