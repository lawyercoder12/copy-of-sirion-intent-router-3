import React from 'react';
export const UserQuestionIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6 text-teal' }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"></path>
    <path d="M14 2h4a2 2 0 0 1 2 2v2M15 10a3 3 0 0 1-3-3V2.5"></path>
    <path d="M12.5 6.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"></path>
    <path d="M18 15h.01"></path>
  </svg>
);