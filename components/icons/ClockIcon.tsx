

import React from 'react';
export const ClockIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6 text-slate-500 dark:text-slate-400' }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);