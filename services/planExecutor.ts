import { Plan, ExecutionState, Step, AgentCallStep, SequentialStep, ParallelStep, TelemetryEvent, AgentId, StepStatus } from '../types';
import { produce, Draft } from 'immer';

type StateUpdater = (fn: (draft: Draft<ExecutionState>) => void) => void;
type AgentExecutor = (agentId: AgentId, parameters: Record<string, any>) => Promise<any>;
type HumanInputCallback = (stepId: string) => void;
type StepSuccessCallback = (step: Step, state: ExecutionState) => Promise<void>;


export class PlanExecutor {
  private plan: Plan;
  private state: ExecutionState;
  private updateStateInReact: StateUpdater
  private executeAgent: AgentExecutor;
  private onHumanInputRequired: HumanInputCallback;
  private onStepSuccess: StepSuccessCallback;
  private wasPausedForInput: boolean = false;

  constructor(
      plan: Plan, 
      initialState: ExecutionState, 
      stateUpdater: StateUpdater, 
      agentExecutor: AgentExecutor, 
      onHumanInputRequired: HumanInputCallback,
      onStepSuccess: StepSuccessCallback
    ) {
    this.plan = plan;
    this.state = initialState;
    this.updateStateInReact = stateUpdater;
    this.executeAgent = agentExecutor;
    this.onHumanInputRequired = onHumanInputRequired;
    this.onStepSuccess = onStepSuccess;
  }

  private sanitizeAgentId(raw: string): string {
    if (!raw) return raw;
    // Remove any trailing parenthesized label and trim whitespace
    return raw.replace(/\s*\(.*\)\s*$/, '').trim();
  }

  private produceNewState(fn: (draft: Draft<ExecutionState>) => void) {
      // This function now just updates the internal state.
      // The React state update is handled by the passed-in `stateUpdater`.
      this.state = produce(this.state, fn);
      this.updateStateInReact(fn);
  }

  private addTelemetry(eventData: Omit<TelemetryEvent, 'ts' | 'plan_id'>) {
    this.produceNewState(draft => {
      draft.trace.push({
        ...eventData,
        ts: new Date().toISOString(),
        plan_id: this.plan.plan_id,
      });
    });
  }

  private resolveParameters(params: Record<string, any>): Record<string, any> {
    const resolved: Record<string, any> = {};
    for (const key in params) {
      let value = params[key];
      if (typeof value === 'string') {
        const match = value.match(/^{{steps\.([^}]+)}}$/);
        if (match) {
          const path = match[1].split('.');
          const stepId = path.shift();
          if (stepId && this.state.steps[stepId]?.status === 'succeeded') {
            let data = this.state.steps[stepId].output;
            try {
                for (const p of path) { data = data[p]; }
                value = data;
            } catch {
                // Keep original template if path is invalid
            }
          }
        } else {
            // Handle inline templates
            value = value.replace(/{{steps\.([^}]+)}}/g, (match: string, pathStr: string): string => {
                const path = pathStr.split('.');
                const stepId = path.shift();
                 if (stepId && this.state.steps[stepId]?.status === 'succeeded') {
                    let data = this.state.steps[stepId].output;
                    try {
                        for (const p of path) { data = data[p]; }
                        return String(data);
                    } catch {
                        return match; // Return original if path fails
                    }
                }
                return match;
            });
        }
      }
      resolved[key] = value;
    }
    return resolved;
  }
  
  private skipFollowingSteps(steps: Step[]) {
      steps.forEach(step => {
           this.produceNewState(draft => {
               draft.steps[step.id].status = 'skipped';
           });
           if('tasks' in step && step.tasks) {
               this.skipFollowingSteps(step.tasks);
           }
      });
  }

  public async execute(): Promise<{ finalState: ExecutionState; wasPaused: boolean; }> {
    this.addTelemetry({ event: 'plan_execution_started', step_id: null, preview: { message: "Starting execution." } });
    try {
      await this.executeStep(this.plan.root);
      this.addTelemetry({ event: 'plan_execution_finished', step_id: null, preview: { message: "Execution completed." } });
    } catch (error) {
      if (error instanceof Error && error.message === 'HUMAN_INPUT_REQUIRED') {
        // This is an expected pause, not a failure.
        this.addTelemetry({ event: 'plan_execution_finished', step_id: null, preview: { message: `Execution paused for user input.` } });
      } else {
        console.error("Execution failed:", error);
        this.addTelemetry({ event: 'plan_execution_finished', step_id: null, preview: { message: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}` } });
        throw error;
      }
    }
    return { finalState: this.state, wasPaused: this.wasPausedForInput };
  }

  private async executeStep(step: Step): Promise<any> {
    const currentStepStatus = this.state.steps[step.id]?.status;

    // Guard clause to prevent re-running completed steps.
    if (currentStepStatus === 'succeeded') {
      return this.state.steps[step.id].output;
    }
    if (currentStepStatus === 'failed') {
      throw new Error(this.state.steps[step.id].error || `Step ${step.id} previously failed.`);
    }
    if (currentStepStatus === 'skipped') {
      return; // Do nothing, allowing sequential execution to proceed.
    }

    const startTime = new Date().toISOString();
    this.produceNewState(draft => {
      draft.steps[step.id].status = 'running';
      draft.steps[step.id].started_at = startTime;
    });
    this.addTelemetry({ event: 'step_started', step_id: step.id, agent_id: step.type === 'agent_call' ? step.agent_id : null });

    try {
      let output: any;
      switch (step.type) {
        case 'agent_call':
          output = await this.executeAgentCall(step);
          break;
        case 'sequential':
          output = await this.executeSequential(step);
          break;
        case 'parallel':
          output = await this.executeParallel(step);
          break;
      }

      const endTime = new Date().toISOString();
      this.produceNewState(draft => {
        if(draft.steps[step.id].status === 'running') { // Avoid overwriting 'awaiting_input' or 'awaiting_continuation'
            draft.steps[step.id].status = 'succeeded';
            draft.steps[step.id].output = output;
            draft.steps[step.id].ended_at = endTime;
        }
      });
      this.addTelemetry({ event: 'step_succeeded', step_id: step.id, agent_id: step.type === 'agent_call' ? step.agent_id : null, preview: { output: JSON.stringify(output)?.substring(0, 100) + '...' } });
      
      // "Thinking" step after success
      await this.onStepSuccess(step, this.state);

      return output;
    } catch (error) {
      const endTime = new Date().toISOString();
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage !== 'HUMAN_INPUT_REQUIRED') {
        this.produceNewState(draft => {
            draft.steps[step.id].status = 'failed';
            draft.steps[step.id].error = errorMessage;
            draft.steps[step.id].ended_at = endTime;
        });
        this.addTelemetry({ event: 'step_failed', step_id: step.id, agent_id: step.type === 'agent_call' ? step.agent_id : null, preview: { error: errorMessage } });
      }
      throw error; // Propagate error up for sequential/parallel handling
    }
  }

  private async executeAgentCall(step: AgentCallStep): Promise<any> {
    const parameters = this.resolveParameters(step.parameters);
    this.produceNewState(draft => {
      draft.steps[step.id].parameters = parameters;
    });

    const rawAgentId = step.agent_id;
    const resolvedAgentId = this.sanitizeAgentId(rawAgentId);
    if (resolvedAgentId !== rawAgentId) {
      this.addTelemetry({ event: 'dependency_analysis', step_id: step.id, agent_id: resolvedAgentId, preview: { message: `Sanitized agent_id from "${rawAgentId}" to "${resolvedAgentId}"` } });
    }

    if (resolvedAgentId === 'human_assistant') {
      this.wasPausedForInput = true; // Set the flag
      this.produceNewState(draft => {
        draft.steps[step.id].status = 'awaiting_input';
      });
      this.addTelemetry({ event: 'hitl_requested', step_id: step.id, agent_id: resolvedAgentId, preview: { message: `Awaiting user input for: "${parameters.prompt}"` } });
      this.onHumanInputRequired(step.id);
      throw new Error("HUMAN_INPUT_REQUIRED");
    }

    if (resolvedAgentId === 'branch_orchestrator') {
        this.produceNewState(draft => {
            draft.steps[step.id].status = 'awaiting_continuation';
        });
        this.addTelemetry({ event: 'continuation_required', step_id: step.id, agent_id: resolvedAgentId, preview: { message: `Plan paused for conditional execution. Condition: "${parameters.conditionsPrompt}"` } });
        return { result: "Paused for continuation. The App will re-plan." }; // Return a success-like object
    }

    await new Promise(res => setTimeout(res, 500 + Math.random() * 1000));
    const output = await this.executeAgent(resolvedAgentId, parameters);
    
    if (output.error) {
        throw new Error(typeof output.details === 'string' ? output.details : JSON.stringify(output.error));
    }
    return output;
  }

  private async executeSequential(step: SequentialStep): Promise<any> {
    let lastOutput: any = null;
    for (const [index, task] of step.tasks.entries()) {
      try {
        lastOutput = await this.executeStep(task);
      } catch(e) {
        // If a step fails or needs input, skip the rest in the sequence
        const followingTasks = step.tasks.slice(index + 1);
        this.skipFollowingSteps(followingTasks);
        throw e; // re-throw to stop execution of parent
      }
    }
    return lastOutput;
  }

  private async executeParallel(step: ParallelStep): Promise<any> {
    const promises = step.tasks.map(task => this.executeStep(task).catch(e => e)); // Catch errors to not fail Promise.all
    const results = await Promise.all(promises);
    
    // Check if any promise resulted in an error and re-throw if needed
    const failedResult = results.find(r => r instanceof Error);
    if(failedResult) {
        throw failedResult;
    }
    
    this.addTelemetry({ event: 'parallel_joined', step_id: step.id });
    
    return step.tasks.reduce((acc, task, index) => {
      acc[task.id] = results[index];
      return acc;
    }, {} as Record<string, any>);
  }
}