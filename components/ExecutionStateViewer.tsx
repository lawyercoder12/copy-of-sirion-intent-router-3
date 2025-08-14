

import React from 'react';
import { ExecutionState } from '../types';

interface ExecutionStateViewerProps {
  executionState: ExecutionState | null;
}

export const ExecutionStateViewer: React.FC<ExecutionStateViewerProps> = ({ executionState }) => {
  if (!executionState) {
    return <p className="text-slate-500 dark:text-slate-500 text-center mt-8">No execution state available. Generate and execute a plan.</p>;
  }

  return (
    <pre className="text-xs p-2 bg-slate-100 dark:bg-midnight rounded-md text-slate-700 dark:text-slate-300 whitespace-pre-wrap overflow-auto h-full">
      {JSON.stringify(executionState, null, 2)}
    </pre>
  );
};