import React from 'react';
import { SpinnerIcon } from './icons/SpinnerIcon';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export const PromptInput: React.FC<PromptInputProps> = ({ value, onChange, onSubmit, isLoading }) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div>
      <label htmlFor="prompt" className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
        Enter your CLM goal (Ctrl+Enter to submit)
      </label>
      <div className="relative">
        <textarea
            id="prompt"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="w-full h-24 p-2 pr-32 bg-white dark:bg-midnight border border-slate-300 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-teal dark:focus:border-teal transition text-midnight dark:text-cloud"
            placeholder="e.g., Analyze contract CTR-123 for risks and report on recent SLA performance..."
        />
        <div className="absolute bottom-2 right-2">
            <button
            onClick={onSubmit}
            disabled={isLoading || !value.trim()}
            className="px-4 py-2 bg-teal text-white font-semibold rounded-md hover:bg-teal-dark disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:text-slate-200 dark:disabled:text-slate-400 disabled:cursor-not-allowed flex items-center transition-colors"
            >
            {isLoading && <SpinnerIcon className="animate-spin h-5 w-5 text-white" />}
            <span className={isLoading ? 'ml-2' : ''}>{isLoading ? 'Generating...' : 'Send'}</span>
            </button>
        </div>
      </div>
    </div>
  );
};