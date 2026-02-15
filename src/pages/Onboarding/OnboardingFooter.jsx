import React from 'react';
import { FaArrowLeft } from 'react-icons/fa';

const OnboardingFooter = ({ onBack, children }) => {
  return (
    <div className="bg-white border-t border-slate-200 px-8 md:px-16 py-6 flex justify-between items-center shrink-0">
      <button 
        onClick={onBack}
        className="bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 hover:bg-slate-50 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all"
      >
        <FaArrowLeft size={14} /> Back
      </button>

      {/* Right side content passed as children */}
      <div className="flex items-center justify-end">
        {children}
      </div>
    </div>
  );
};

export default OnboardingFooter;
