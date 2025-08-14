import React from 'react';
export const DotIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5 text-[#0D5E68]' }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12.1" cy="12.1" r="1"></circle>
  </svg>
);