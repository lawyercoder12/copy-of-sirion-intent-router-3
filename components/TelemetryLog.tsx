import React from 'react';
import { TelemetryEvent, TelemetryEventType } from '../types';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { XCircleIcon } from './icons/XCircleIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { DotIcon } from './icons/DotIcon';

interface TelemetryLogProps {
  telemetryEvents: TelemetryEvent[];
}

const getEventIcon = (type: TelemetryEventType) => {
    switch(type) {
        case 'plan_created':
        case 'plan_execution_finished':
        case 'step_succeeded':
            return <CheckCircleIcon className="text-green-500"/>
        case 'step_failed':
            return <XCircleIcon className="text-red-500" />
        case 'hitl_requested':
             return <XCircleIcon className="text-amber-500" />
        case 'plan_execution_started':
        case 'step_started':
             return <SpinnerIcon className="text-yellow-500" />
        default:
            return <DotIcon className="text-teal" />;
    }
}


export const TelemetryLog: React.FC<TelemetryLogProps> = ({ telemetryEvents }) => {
  if (telemetryEvents.length === 0) {
    return <p className="text-slate-500 dark:text-slate-500 text-center mt-8">No telemetry events yet.</p>;
  }

  return (
    <div className="space-y-3 font-mono text-xs">
      {telemetryEvents.map((event, index) => (
        <div key={index} className="flex items-start gap-3 p-2 bg-slate-100 dark:bg-slate-800/50 rounded-md">
          <div className="flex-shrink-0 mt-0.5">{getEventIcon(event.event)}</div>
          <div className="flex-grow">
            <div className="flex justify-between items-baseline">
                <p className="font-bold text-slate-700 dark:text-slate-300">{event.event}</p>
                <p className="text-slate-500 dark:text-slate-500">{new Date(event.ts).toLocaleTimeString()}</p>
            </div>
            {event.step_id && <p className="text-slate-600 dark:text-slate-400">Step: <span className="text-slate-800 dark:text-slate-200">{event.step_id}</span></p>}
            {event.agent_id && <p className="text-slate-600 dark:text-slate-400">Agent: <span className="text-slate-800 dark:text-slate-200">{event.agent_id}</span></p>}
            {event.preview?.message && <p className="text-slate-700 dark:text-slate-300 mt-1">{event.preview.message}</p>}
          </div>
        </div>
      ))}
    </div>
  );
};