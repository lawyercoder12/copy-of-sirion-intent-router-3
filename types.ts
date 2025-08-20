export type AgentId = string;

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  whenToUse: string;
  type: 'mock' | 'real';
  enabled: boolean;
  icon?: string;
  mockBehavior?: string;
  system?: boolean;
}

export const SYSTEM_AGENT_IDS = new Set<AgentId>(['human_assistant', 'branch_orchestrator']);

export type StepType = 'agent_call' | 'sequential' | 'parallel';

export interface BaseStep {
  id: string;
  type: StepType;
  phase?: string;
  branch_key?: string;
  loop_key?: string;
}

export interface AgentCallStep extends BaseStep {
  type: 'agent_call';
  agent_id: AgentId;
  parameters: Record<string, any>;
}

export interface SequentialStep extends BaseStep {
  type: 'sequential';
  tasks: Step[];
}

export interface ParallelStep extends BaseStep {
  type: 'parallel';
  tasks: Step[];
}

export type Step = AgentCallStep | SequentialStep | ParallelStep;

export interface Plan {
  plan_id: string;
  name: string;
  description: string;
  root: Step;
  simulation?: {
    mode: 'deterministic' | 'stochastic';
    seed?: number;
  };
}

export type StepStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'awaiting_input' | 'awaiting_continuation';

export interface StepResult {
  status: StepStatus;
  started_at: string | null;
  ended_at: string | null;
  agent_id?: AgentId;
  parameters: Record<string, any> | null;
  output: any;
  error: string | null;
  emissions: any[];
}

export interface ExecutionState {
  metadata: {
    doc_type: string | null;
    review_status: string | null;
    assumptions: string[];
    mediator: { summary: string | null };
    obligations: any[];
  };
  context?: Record<string, any>;
  steps: Record<string, StepResult>;
  trace: TelemetryEvent[];
}

export type TelemetryEventType =
  | 'plan_created'
  | 'plan_execution_started'
  | 'plan_execution_finished'
  | 'dependency_analysis'
  | 'step_started'
  | 'step_succeeded'
  | 'step_failed'
  | 'parallel_joined'
  | 'loop_iteration'
  | 'hitl_requested'
  | 'hitl_response_received'
  | 'continuation_required'
  | 'context_updated'
  | 'duplicate_elided';

export interface TelemetryEvent {
  event: TelemetryEventType;
  ts: string;
  plan_id: string;
  step_id: string | null;
  agent_id?: AgentId | null;
  preview?: {
    message?: string;
    parameters?: string;
    output?: string;
    error?: string;
    dependencies_checked?: boolean;
  };
}

// Represents a single turn in the conversation
export interface ChatTurn {
    id: string;
    prompt: string;
    plan: Plan | null;
    executionState: ExecutionState | null;
    isExecuting: boolean;
    isAwaitingInputOnStep: string | null; // ID of the step awaiting input
    error: string | null;
    finalSummary: string | null;
    isSummarizing: boolean;
    thinkingLog: { id: string, thought: string }[];
}