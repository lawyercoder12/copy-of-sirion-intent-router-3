import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Plan, Step, AgentCallStep, SequentialStep, ParallelStep, ExecutionState, StepStatus, AgentId, AgentDefinition } from '../types';
import { AGENT_DEFINITIONS, STEP_TYPE_DEFINITIONS } from '../constants';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { XCircleIcon } from './icons/XCircleIcon';
import { ClockIcon } from './icons/ClockIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { SkipIcon } from './icons/SkipIcon';
import { UserQuestionIcon } from './icons/UserQuestionIcon';
import { QuestionMarkCircleIcon } from './icons/QuestionMarkCircleIcon';
import { BranchOrchestratorIcon } from './icons/AgentIcon';
import { CodeIcon } from './icons/CodeIcon';

interface PlanVisualizerProps {
  plan: Plan;
  executionState: ExecutionState | null;
  agents?: AgentDefinition[];
}

const toAgentMap = (agents?: AgentDefinition[]) => {
  const map: Record<string, { name: string; description: string; icon: React.ReactNode | null }> = {};
  (agents || []).forEach(a => {
    map[a.id] = { name: a.name, description: a.description, icon: null };
  });
  return map;
};

const getStatusIcon = (status: StepStatus) => {
  switch (status) {
    case 'running': return <SpinnerIcon />;
    case 'succeeded': return <CheckCircleIcon />;
    case 'failed': return <XCircleIcon />;
    case 'skipped': return <SkipIcon />;
    case 'awaiting_input': return <UserQuestionIcon />;
    case 'awaiting_continuation': return <BranchOrchestratorIcon />;
    case 'pending':
    default:
      return <ClockIcon />;
  }
};

const getStatusColor = (status: StepStatus): string => {
    // This is not used anymore for border, but can be for text or other elements
    switch (status) {
        case 'running': return 'text-yellow-500';
        case 'succeeded': return 'text-green-500';
        case 'failed': return 'text-red-500';
        case 'awaiting_input': return 'text-teal';
        case 'awaiting_continuation': return 'text-purple-500 dark:text-purple-400';
        case 'skipped': return 'text-slate-400 dark:text-slate-500';
        case 'pending':
        default: return 'text-slate-500 dark:text-slate-400';
    }
}

const DataFlowArrow: React.FC<{source: string}> = ({source}) => (
    <span className="relative group inline-block ml-2 cursor-help">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-teal-dark dark:text-teal"><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"></path><path d="m21 3-9 9"></path><path d="M15 3h6v6"></path></svg>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs px-2 py-1 bg-midnight text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-slate-700">
            Resolved from: {source}
        </div>
    </span>
)

const StepNode: React.FC<{ step: Step; executionState: ExecutionState | null; level: number; agentMap?: Record<string, { name: string; description: string; icon: React.ReactNode | null }> }> = ({ step, executionState, level, agentMap }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const stepResult = executionState?.steps[step.id];
  const status = stepResult?.status ?? 'pending';
  
  let stepInfo;
  if (step.type === 'agent_call') {
    const normalizedAgentId = (step.agent_id || '')
      .toLowerCase()
      .split('(')[0]
      .trim();
    stepInfo = agentMap?.[normalizedAgentId] || AGENT_DEFINITIONS[normalizedAgentId as AgentId];
  } else {
    stepInfo = STEP_TYPE_DEFINITIONS[step.type as keyof typeof STEP_TYPE_DEFINITIONS];
  }
  
  if (!stepInfo) {
    if (step.type === 'agent_call') {
      const normalizedAgentId = (step.agent_id || '').toLowerCase().split('(')[0].trim();
      stepInfo = {
        name: normalizedAgentId || 'Agent',
        description: 'Agent from plan (not present in current profile).',
        icon: null,
      };
    } else {
      stepInfo = {
        name: `Unknown: ${step.type}`,
        description: 'This step type is not recognized by the application.',
        icon: <QuestionMarkCircleIcon />
      };
    }
  }

  const iconNode = stepInfo?.icon ?? <CodeIcon className="w-6 h-6" />;

  const hasChildren = 'tasks' in step && step.tasks.length > 0;
  
  const originalParams = step.type === 'agent_call' ? step.parameters : {};
  const resolvedParams = stepResult?.parameters ?? {};
  
  const renderParameters = () => {
      const allKeys = Object.keys(resolvedParams);
      if (allKeys.length === 0) return null;

      return (
          <details className="mt-2 text-xs" open>
             <summary className="cursor-pointer text-slate-500 dark:text-slate-400 font-medium">Parameters</summary>
             <div className="p-2 mt-1 bg-slate-100 dark:bg-midnight/70 rounded-md text-slate-700 dark:text-slate-300 overflow-auto">
                <pre className="whitespace-pre-wrap">{`{
${allKeys.map(key => {
    const originalValue = originalParams[key];
    const resolvedValue = resolvedParams[key];
    const isResolved = typeof originalValue === 'string' && originalValue.includes('{{') && JSON.stringify(originalValue) !== JSON.stringify(resolvedValue);
    const match = typeof originalValue === 'string' ? originalValue.match(/{{(.*?)}}/) : null;

    return `  "${key}": ${JSON.stringify(resolvedValue, null, 2)}${isResolved && match ? ` ` : ''}${isResolved && match ? `<DataFlowArrow source="${match[1]}" />` : ''}`;
}).join(',\n')}
}`.replace(/<DataFlowArrow source="([^"]+)" \/>/g, (match, source) => {
    // This is a bit of a hack to render a React component inside a string
    // In a real app, you'd structure this differently to avoid string replacement of components.
    // But for this self-contained component, it demonstrates the idea.
    // The proper way would be to map over keys and return JSX elements directly.
    return `</span><span class="inline-block align-middle" data-source="${source}"></span>`;
})}
                </pre>
             </div>
           </details>
      )
  }
  
  // Post-render step to replace placeholders with React components
  // This is a workaround for embedding JSX in a string.
  const paramRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (paramRef.current) {
        const placeholders = paramRef.current.querySelectorAll('span[data-source]');
        placeholders.forEach(placeholder => {
            const source = placeholder.getAttribute('data-source');
            if (source && placeholder.innerHTML === '') {
                 const root = ReactDOM.createRoot(placeholder);
                 root.render(<DataFlowArrow source={source} />);
            }
        });
    }
  }, [resolvedParams]);


  return (
    <div className="ml-4 my-1">
      <div className={`bg-white dark:bg-slate-800 rounded-lg p-3 transition-all ring-1 ring-slate-200 dark:ring-slate-700/50`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-700 ${getStatusColor(status)}`}>
                <div className="w-5 h-5">{getStatusIcon(status)}</div>
             </div>
             <div className="flex-shrink-0 w-6 h-6 text-midnight dark:text-cloud">{iconNode}</div>
             <div>
                <span className="font-semibold text-midnight dark:text-cloud">{stepInfo.name}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">({step.id})</span>
                <p className="text-sm text-slate-500 dark:text-slate-400">{stepInfo.description}</p>
             </div>
          </div>
          {hasChildren && (
            <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 rounded-full hover:bg-slate-300 dark:hover:bg-slate-600">
              <ChevronDownIcon className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
        
        <div ref={paramRef}>
            {renderParameters()}
        </div>

         {stepResult?.output && (
           <details className="mt-2 text-xs" open>
             <summary className="cursor-pointer text-slate-500 dark:text-slate-400 font-medium">Output</summary>
             <pre className="p-2 mt-1 bg-slate-100 dark:bg-midnight/70 rounded-md text-slate-700 dark:text-slate-300 overflow-auto">{JSON.stringify(stepResult.output, null, 2)}</pre>
           </details>
        )}
        {stepResult?.error && (
            <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                <p className="font-bold">Error:</p>
                <pre className="p-2 mt-1 bg-red-100/50 dark:bg-red-500/10 rounded-md whitespace-pre-wrap">{stepResult.error}</pre>
            </div>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="relative pl-6 mt-1 border-l-2 border-slate-300 dark:border-slate-700 border-dashed">
          {(step as SequentialStep | ParallelStep).tasks.map((task, index) => (
            <StepNode key={task.id} step={task} executionState={executionState} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};


export const PlanVisualizer: React.FC<PlanVisualizerProps> = ({ plan, executionState, agents }) => {
  const agentMap = React.useMemo(() => toAgentMap(agents), [agents]);
  return (
    <div>
      <StepNode step={plan.root} executionState={executionState} level={0} agentMap={agentMap} />
    </div>
  );
};