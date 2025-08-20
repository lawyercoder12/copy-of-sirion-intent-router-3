

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { produce } from 'immer';
import { Plan, ExecutionState, TelemetryEvent, Step, ChatTurn, AgentId, StepStatus, AgentDefinition } from './types';
import { planner } from './services/geminiService';
import { PlanExecutor } from './services/planExecutor';
import { PromptInput } from './components/PromptInput';
import { PlanVisualizer } from './components/PlanVisualizer';
import { ExecutionStateViewer } from './components/ExecutionStateViewer';
import { TelemetryLog } from './components/TelemetryLog';
import { PlayIcon } from './components/icons/PlayIcon';
import { SpinnerIcon } from './components/icons/SpinnerIcon';
import { FileTextIcon } from './components/icons/FileTextIcon';
import { CodeIcon } from './components/icons/CodeIcon';
import { DotIcon } from './components/icons/DotIcon';
import { SirionLogo } from './components/icons/SirionLogo';
import { ThemeToggle } from './components/ThemeToggle';
import { v4 as uuidv4 } from 'uuid';
import { ConfigPage } from './components/ConfigPage';
import { loadProfile, mergeDefaults, saveProfile } from './services/agentRegistry';
import { buildPlannerSystemInstruction, buildMockInstruction } from './services/promptBuilder';


const UserMessage: React.FC<{prompt: string}> = ({ prompt }) => {
    return (
        <div className="flex justify-end">
            <div className="bg-teal text-white p-3 rounded-lg max-w-2xl font-medium shadow-md">
                <p>{prompt}</p>
            </div>
        </div>
    );
};

const AssistantMessage: React.FC<{ turn: ChatTurn, onExecute: () => void, agents?: AgentDefinition[] }> = ({ turn, onExecute, agents }) => {
    const [activeTab, setActiveTab] = useState<'plan'|'state' | 'telemetry'>('plan');
    const { plan, executionState, isExecuting, error } = turn;

    const TabButton: React.FC<{
        label: string;
        icon: React.ReactNode;
        isActive: boolean;
        onClick: () => void;
    }> = ({ label, icon, isActive, onClick }) => (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                isActive
                ? 'border-teal text-teal'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
        >
            {icon}
            <span>{label}</span>
        </button>
    );

    if (error && !plan) { // Only show full-page error if planning failed
        return (
            <div className="bg-red-100 dark:bg-red-500/20 border border-red-300 dark:border-red-500/50 rounded-lg p-4">
                <p className="font-bold text-red-700 dark:text-red-300">Error</p>
                <p className="text-red-600 dark:text-red-200">{error}</p>
            </div>
        );
    }
    
    if (!plan || !executionState) return null;

    const isAwaitingContinuation = Object.values(executionState.steps).some(s => s.status === 'awaiting_continuation');

    return (
        <div className="bg-white dark:bg-midnight-accent rounded-lg shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex-grow text-sm">
                        <p className="font-bold text-slate-800 dark:text-cloud">Plan Generated: <span className="font-semibold">{plan.name}</span></p>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">{plan.description}</p>
                    </div>
                    <button
                        onClick={onExecute}
                        disabled={isExecuting || !!turn.isAwaitingInputOnStep || isAwaitingContinuation || turn.isSummarizing}
                        className="px-4 py-2 bg-teal text-white rounded-md hover:bg-teal-dark disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center transition-colors flex-shrink-0 font-semibold shadow-sm"
                    >
                        {isExecuting ? <SpinnerIcon /> : <PlayIcon />}
                        <span className="ml-2">{isExecuting ? 'Executing...' : 'Execute Plan'}</span>
                    </button>
                </div>
            </div>

            <div className="border-b border-slate-200 dark:border-slate-800">
                <nav className="flex">
                    <TabButton label="Execution Plan" icon={<FileTextIcon />} isActive={activeTab === 'plan'} onClick={() => setActiveTab('plan')} />
                    <TabButton label="Execution State" icon={<CodeIcon />} isActive={activeTab === 'state'} onClick={() => setActiveTab('state')} />
                    <TabButton label="Telemetry" icon={<DotIcon />} isActive={activeTab === 'telemetry'} onClick={() => setActiveTab('telemetry')} />
                </nav>
            </div>

            <div className="bg-slate-50 dark:bg-midnight p-4 max-h-[60vh] overflow-auto">
                 {activeTab === 'plan' && <PlanVisualizer plan={plan} executionState={executionState} agents={agents} />}
                 {activeTab === 'state' && <ExecutionStateViewer executionState={executionState} />}
                 {activeTab === 'telemetry' && <TelemetryLog telemetryEvents={executionState?.trace ?? []} />}
            </div>
        </div>
    );
}

const OrchestratorThoughtBubble: React.FC<{thought: string}> = ({ thought }) => (
    <div className="flex justify-start">
        <div className="flex items-center gap-3 max-w-2xl w-full">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center ring-2 ring-slate-300 dark:ring-slate-600">
                <SirionLogo className="w-5 h-5 text-teal" />
            </div>
            <div className="bg-white dark:bg-midnight-accent p-3 rounded-lg max-w-2xl shadow-md font-medium text-sm text-slate-600 dark:text-slate-300 italic ring-1 ring-slate-200 dark:ring-slate-700/50">
                <p>{thought}</p>
            </div>
        </div>
    </div>
);

const SystemMessage: React.FC<{ message: string }> = ({ message }) => (
     <div className="text-center my-4">
        <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold bg-slate-200 dark:bg-slate-700 rounded-full px-3 py-1">
            {message}
        </span>
    </div>
)

const AssistantQuestionMessage: React.FC<{ question: string }> = ({ question }) => (
    <div className="flex justify-start">
        <div className="flex items-start gap-3 max-w-2xl w-full">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center ring-2 ring-slate-300 dark:ring-slate-600">
                <SirionLogo className="w-5 h-5 text-teal" />
            </div>
            <div className="bg-white dark:bg-midnight-accent p-4 rounded-lg shadow-md ring-1 ring-slate-200 dark:ring-slate-700/50">
                <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200 mb-2">Human Assistance Required</h3>
                <p className="text-slate-700 dark:text-slate-300">{question}</p>
            </div>
        </div>
    </div>
);


const App: React.FC = () => {
    const [prompt, setPrompt] = useState<string>('');
    const [history, setHistory] = useState<ChatTurn[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const plannerService = useRef(planner);
    const endOfMessagesRef = useRef<HTMLDivElement>(null);
    const historyRef = useRef(history);
    historyRef.current = history;
    const loaded = loadProfile();
    const merged = mergeDefaults(loaded);
    if (merged.changed) {
        try { saveProfile(merged.profile); } catch {}
    }
    const [agents, setAgents] = useState<AgentDefinition[]>(merged.profile.agents);
    const [profileName, setProfileName] = useState<string>(merged.profile.name);
    const [route, setRoute] = useState<'home' | 'config'>(location.hash === '#/config' ? 'config' : 'home');
    
    // Create a stable ref for handleSend to avoid dependency cycles in useCallbacks
    const handleSendRef = useRef<((userPrompt: string, plannerPromptOverride?: string) => Promise<void>) | null>(null);

    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history, isLoading]);

    useEffect(() => {
        const handler = () => setRoute(location.hash === '#/config' ? 'config' : 'home');
        window.addEventListener('hashchange', handler);
        return () => window.removeEventListener('hashchange', handler);
    }, []);

    useEffect(() => {
        const plannerInstr = buildPlannerSystemInstruction(agents);
        const mockInstr = buildMockInstruction(agents);
        plannerService.current.setSystemInstructions(plannerInstr, mockInstr);
        const enabledIds = agents.filter(a => a.enabled).map(a => a.id);
        plannerService.current.setAvailableAgentIds(enabledIds);
    }, [agents]);

    // Surface a clear profile integrity error as a chat turn if required agents are missing
    useEffect(() => {
        const required = ['ai_redlining', 'share_with_counterparty', 'esignature_orchestrator'];
        const enabledSet = new Set(agents.filter(a => a.enabled).map(a => a.id));
        const missing = required.filter(r => !enabledSet.has(r));
        if (missing.length > 0 && historyRef.current.length === 0) {
            const turnId = uuidv4();
            setHistory(prev => [...prev, {
                id: turnId,
                prompt: '[SYSTEM]',
                plan: null,
                executionState: null,
                isExecuting: false,
                isAwaitingInputOnStep: null,
                error: `Unknown agent(s): ${missing.join(', ')}. Choose from: ${Array.from(enabledSet).join(', ')} or import the correct profile.`,
                finalSummary: null,
                isSummarizing: false,
                thinkingLog: [],
            }]);
        }
    }, [agents]);


    const createInitialExecutionState = (plan: Plan, seedContext?: Record<string, any>): ExecutionState => {
        const steps: Record<string, any> = {};
        const collectSteps = (step: Step) => {
            steps[step.id] = { status: 'pending', started_at: null, ended_at: null, output: null, error: null, parameters: null, emissions: [] };
            if (step.type === 'sequential' || step.type === 'parallel') {
                step.tasks.forEach(collectSteps);
            }
        };
        collectSteps(plan.root);
        return {
            metadata: { doc_type: null, review_status: null, assumptions: [], mediator: { summary: null }, obligations: [] },
            context: seedContext ? { ...seedContext } : {},
            steps,
            trace: [{ event: 'plan_created', ts: new Date().toISOString(), plan_id: plan.plan_id, step_id: null, preview: { message: `Plan "${plan.name}" created.` } }],
        };
    };

    const handleExecutePlan = useCallback(async (turnId: string) => {
        const turn = historyRef.current.find(t => t.id === turnId);
        if (!turn || !turn.plan || !turn.executionState) {
            console.error("Attempted to execute a turn without a plan or state.", turnId);
            return;
        }

        setHistory(prev => produce(prev, draft => {
            const dTurn = draft.find(t => t.id === turnId);
            if (dTurn) {
                dTurn.isExecuting = true;
                dTurn.thinkingLog = [];
            }
        }));

        try {
            const originalUserPrompt = turn.prompt.replace('[CONTINUATION]', '').replace('[RE-PLANNING]', '');

            const onStepSuccess = async (step: Step, state: ExecutionState) => {
                const thought = await plannerService.current.generateThought(originalUserPrompt, turn.plan!, step, state);
                setHistory(prev => produce(prev, draft => {
                    const currentTurn = draft.find(t => t.id === turnId);
                    if(currentTurn) {
                        currentTurn.thinkingLog.push({ id: step.id, thought });
                    }
                }));
            };

            const executor = new PlanExecutor(
                turn.plan,
                turn.executionState,
                (updater) => {
                    setHistory(prev => produce(prev, draft => {
                        const turnToUpdate = draft.find(t => t.id === turnId);
                        if (turnToUpdate && turnToUpdate.executionState) {
                            updater(turnToUpdate.executionState);
                        }
                    }))
                },
                async (agentId, parameters) => {
                    const def = agents.find(a => a.id === agentId);
                    if (!def || !def.enabled) {
                        const enabledIds = agents.filter(a => a.enabled).map(a => a.id).join(', ');
                        throw new Error(`Unknown agent id: ${agentId}. Choose from: ${enabledIds} or import the correct profile.`);
                    }
                    if (def.type === 'real') {
                        return { info: 'Real agent execution coming soon.' };
                    }
                    return plannerService.current.mockAgentExecution(agentId, parameters);
                },
                (stepId) => {
                     setHistory(prev => produce(prev, draft => {
                        const turnToUpdate = draft.find(t => t.id === turnId);
                        if (turnToUpdate) {
                            turnToUpdate.isAwaitingInputOnStep = stepId;
                        }
                    }));
                },
                onStepSuccess
            );

            const { finalState, wasPaused } = await executor.execute();
            
            if (wasPaused) return;

            const continuationStepEntry = Object.entries(finalState.steps).find(([,result]) => result.status === 'awaiting_continuation');
            if (continuationStepEntry) {
                const [stepId, stepResult] = continuationStepEntry;

                setHistory(prev => produce(prev, draft => {
                    const currentTurn = draft.find(t => t.id === turnId);
                    if (currentTurn?.executionState?.steps[stepId]) {
                        currentTurn.executionState.steps[stepId].status = 'succeeded';
                        currentTurn.executionState.steps[stepId].output = { "action": "continuation_triggered" };
                    }
                }));
                
                const { inputValue, conditionsPrompt } = stepResult.parameters || {};
                const continuationUserPrompt = `[CONTINUATION]${originalUserPrompt}`;
                const ctxBlock = JSON.stringify(finalState.context || {});
                const continuationPlannerPrompt = `[CTX]
${ctxBlock}

[CONTINUATION CONTEXT]
The user's original goal was: "${originalUserPrompt}"
A previous step gathered data for a condition. The result is: ${JSON.stringify(inputValue)}
The condition to evaluate is: "${conditionsPrompt}"

Based on this result and condition, generate the plan for the *next* set of actions. Do not repeat the steps that were already executed.
`;
                if (handleSendRef.current) {
                   await handleSendRef.current(continuationUserPrompt, continuationPlannerPrompt);
                }
                return;
            }

            setHistory(prev => produce(prev, draft => {
                const turnToUpdate = draft.find(t => t.id === turnId);
                if (turnToUpdate) {
                    turnToUpdate.isSummarizing = true;
                }
            }));

            await plannerService.current.summarizeStream(originalUserPrompt, finalState, (chunk) => {
                setHistory(prev => produce(prev, draft => {
                    const turnToUpdate = draft.find(t => t.id === turnId);
                    if (turnToUpdate) {
                        turnToUpdate.finalSummary = (turnToUpdate.finalSummary || '') + chunk;
                    }
                }));
            });

        } catch (error) {
            console.error(`Execution failed for turn ${turnId}:`, error);
            setHistory(prev => produce(prev, draft => {
                const turnToUpdate = draft.find(t => t.id === turnId);
                if (turnToUpdate) {
                    turnToUpdate.error = `Execution failed: ${error instanceof Error ? error.message : String(error)}`;
                }
            }));
        } finally {
            setHistory(prev => produce(prev, draft => {
                const turnToUpdate = draft.find(t => t.id === turnId);
                if (turnToUpdate) {
                    // Only turn off executing if we are not paused waiting for input
                    if (!turnToUpdate.isAwaitingInputOnStep) {
                        turnToUpdate.isExecuting = false;
                    }
                    turnToUpdate.isSummarizing = false;
                }
            }));
        }
    }, []);

    const handleSend = useCallback(async (userPrompt: string, plannerPromptOverride?: string) => {
        const turnAwaitingInput = historyRef.current.find(t => t.isAwaitingInputOnStep);
    
        if (turnAwaitingInput && !plannerPromptOverride) { // This is a response to a HITL question
            setPrompt(''); // Clear input box
    
            const originalTurnId = turnAwaitingInput.id;
            const originalStepId = turnAwaitingInput.isAwaitingInputOnStep!;
            const originalUserPrompt = turnAwaitingInput.prompt;
            const questionAsked = turnAwaitingInput.executionState?.steps[originalStepId].parameters?.prompt || "clarification";
            
            // 1. Update history: show user's response and complete the old turn
            setHistory(prev => produce(prev, draft => {
                // Complete the old turn that was awaiting input
                const turn = draft.find(t => t.id === originalTurnId);
                if (turn && turn.executionState) {
                    turn.isAwaitingInputOnStep = null;
                    turn.isExecuting = false; // The plan is now finished
                    const step = turn.executionState.steps[originalStepId];
                    if(step) {
                        step.status = 'succeeded';
                        step.output = { human_response: userPrompt };
                        step.ended_at = new Date().toISOString();
                    }
                    turn.executionState.trace.push({
                        event: 'hitl_response_received',
                        ts: new Date().toISOString(),
                        plan_id: turn.plan!.plan_id,
                        step_id: originalStepId,
                        preview: { output: userPrompt }
                    });
                }
                // Add user's new message to the chat
                draft.push({
                    id: uuidv4(),
                    prompt: userPrompt,
                    plan: null, executionState: null, isExecuting: false, isAwaitingInputOnStep: null,
                    error: null, finalSummary: null, isSummarizing: false, thinkingLog: [],
                });
            }));
            
            // 2. Formulate a new prompt for re-planning
            const replanPrompt = `[CONTINUATION CONTEXT]
The user's original goal was: "${originalUserPrompt}"
A previous step required human input. The question asked was: "${questionAsked}"
The user's response was: "${userPrompt}"
Based on the user's response, generate a new plan to achieve the original goal. Do not repeat the human_assistant step.`;
            
            // 3. Trigger re-planning
            const replanUserMessage = `[RE-PLANNING]${originalUserPrompt}`;
            if (handleSendRef.current) {
                // Use a timeout to allow React to process the state update from step 1
                setTimeout(() => handleSendRef.current!(replanUserMessage, replanPrompt), 100);
            }
            return;
        }

        // --- Start of normal planning or re-planning initiated by HITL/continuation ---
        setIsLoading(true);
        setPrompt('');
        const currentTurnId = uuidv4();
        const plannerPrompt = plannerPromptOverride || userPrompt;
        
        const previousTurnsContext = historyRef.current
            .filter(turn => turn.plan && !turn.error)
            .map(turn => {
                const finalState = turn.executionState;
                const successfulSteps = Object.entries(finalState?.steps ?? {})
                    .filter(([, result]) => result.status === 'succeeded' && result.output)
                    .map(([id, result]) => `Step "${id}" output: ${JSON.stringify(result.output)}`)
                    .join('\n');
                return `PREVIOUS TURN:
User goal: "${turn.prompt.replace('[CONTINUATION]', '').replace('[RE-PLANNING]', '')}"
Plan name: "${turn.plan?.name}"
Successful step outputs:\n${successfulSteps || 'None'}`;
            }).join('\n\n---\n\n');

        const carryContext = historyRef.current
            .map(t => t.executionState?.context || {})
            .reduce((acc, cur) => ({ ...acc, ...cur }), {} as Record<string, any>);
        const ctxBlock = Object.keys(carryContext).length ? `[CTX]\n${JSON.stringify(carryContext)}\n\n` : '';

        const fullPlannerPrompt = plannerPromptOverride // This is for HITL and Branching
            ? plannerPrompt 
            : (previousTurnsContext 
                ? `${ctxBlock}[PREVIOUS TURN CONTEXT]\n${previousTurnsContext}\n\n[CURRENT GOAL]\n${plannerPrompt}`
                : `${ctxBlock}${plannerPrompt}`);
        
        // Create the new turn object to be added to history
        const newTurn: ChatTurn = {
            id: currentTurnId,
            prompt: userPrompt, // Keep the marker for UI logic
            plan: null,
            executionState: null,
            isExecuting: false,
            isAwaitingInputOnStep: null,
            error: null,
            finalSummary: null,
            isSummarizing: false,
            thinkingLog: [],
        };
        setHistory(prev => [...prev, newTurn]);


        try {
            const plan = await plannerService.current.generate(fullPlannerPrompt);
            // Profile integrity check for commonly used orchestrators
            const required = ['ai_redlining', 'share_with_counterparty', 'esignature_orchestrator'];
            const enabledSet = new Set(agents.filter(a => a.enabled).map(a => a.id));
            const missing = required.filter(r => !enabledSet.has(r));
            if (missing.length > 0) {
                throw new Error(`Unknown agent(s): ${missing.join(', ')}. Choose from: ${Array.from(enabledSet).join(', ')} or import the correct profile.`);
            }
            const executionState = createInitialExecutionState(plan, carryContext);

            setHistory(prev => produce(prev, draft => {
                const turn = draft.find(t => t.id === currentTurnId);
                if (turn) {
                    turn.plan = plan;
                    turn.executionState = executionState;
                    turn.error = null;
                }
            }));
        } catch (error) {
            console.error(error);
            setHistory(prev => produce(prev, draft => {
                const turn = draft.find(t => t.id === currentTurnId);
                if (turn) {
                    turn.error = error instanceof Error ? error.message : String(error);
                }
            }));
        } finally {
            setIsLoading(false);
        }
    }, []);
    
    // Update the ref on every render so that other callbacks can call the latest version
    handleSendRef.current = handleSend;

    const turnAwaitingInput = history.find(t => t.isAwaitingInputOnStep);
    const isAnyTurnExecuting = history.some(t => t.isExecuting);
    const isAnyTurnSummarizing = history.some(t => t.isSummarizing);

    // The app is busy if it's generating a plan, or any turn is executing/summarizing.
    const isAppBusy = isLoading || isAnyTurnExecuting || isAnyTurnSummarizing;

    // The input should be disabled if the app is busy, UNLESS it's specifically waiting for user input.
    const isInputDisabled = isAppBusy && !turnAwaitingInput;


    return (
        <div className="flex h-full bg-cloud dark:bg-midnight">
            <main className="flex-1 flex flex-col h-full">
                <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-midnight-accent shadow-sm">
                    <div className="flex items-center gap-3">
                        <SirionLogo className="w-8 h-8 text-teal" />
                        <h1 className="text-xl font-bold text-slate-800 dark:text-cloud">Sirion Intent Router</h1>
                        <span className="ml-3 text-xs px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">Config: {profileName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <a className="px-3 py-2 border rounded text-sm" href="#/config">Config</a>
                        <ThemeToggle />
                    </div>
                </header>

                {route === 'config' ? (
                    <ConfigPage
                        onClose={() => { location.hash = '#/'; }}
                        onSavePrompts={(newAgents, newProfileName) => { setAgents(newAgents); setProfileName(newProfileName); }}
                    />
                ) : (
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {history.length === 0 && !isLoading && (
                         <div className="text-center mt-16">
                            <h2 className="text-2xl font-semibold text-slate-700 dark:text-slate-300">Welcome to the CLM Orchestrator</h2>
                            <p className="text-slate-500 dark:text-slate-400 mt-2">Enter a goal below to generate an execution plan.</p>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mt-8">Example: "Find all MSAs with Acme Corp, check for auto-renewal clauses, and if any are renewing in 90 days, send a notification to legal@sirion.com via Teams."</p>
                         </div>
                    )}
                    {history.map((turn) => (
                        <React.Fragment key={turn.id}>
                            {turn.prompt.startsWith('[CONTINUATION]') ? (
                                 <SystemMessage message="Okay, I have the data. Now planning the next steps based on the outcome..." />
                            ) : turn.prompt.startsWith('[RE-PLANNING]') ? (
                                <SystemMessage message="Okay, I've received your input. Re-planning..." />
                            ) : (
                                <UserMessage prompt={turn.prompt} />
                            )}
                            
                           {(turn.plan || turn.error) && (
                                <AssistantMessage
                                    turn={turn}
                                    onExecute={() => handleExecutePlan(turn.id)}
                                    agents={agents}
                                />
                           )}
                           
                           {turn.isAwaitingInputOnStep && turn.executionState && (
                                <AssistantQuestionMessage
                                    question={turn.executionState.steps[turn.isAwaitingInputOnStep!].parameters?.prompt ?? 'The system requires your input.'}
                                />
                            )}

                            {turn.thinkingLog.map(log => <OrchestratorThoughtBubble key={`${turn.id}-${log.id}`} thought={log.thought} />)}

                            {turn.isSummarizing && <SpinnerIcon className="animate-spin h-6 w-6 text-teal" />}

                            {turn.finalSummary && (
                                <div className="flex justify-start">
                                    <div className="flex items-start gap-3 max-w-2xl w-full">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center ring-2 ring-slate-300 dark:ring-slate-600">
                                            <SirionLogo className="w-5 h-5 text-teal" />
                                        </div>
                                         <div className="prose prose-sm dark:prose-invert bg-white dark:bg-midnight-accent p-4 rounded-lg shadow-md ring-1 ring-slate-200 dark:ring-slate-700/50 max-w-none">
                                            <div dangerouslySetInnerHTML={{ __html: turn.finalSummary.replace(/\n/g, '<br />') }}></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </React.Fragment>
                    ))}
                    
                    {isLoading && !history.some(h => h.isExecuting) && (
                        <div className="flex justify-start">
                            <div className="flex items-center gap-3">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center ring-2 ring-slate-300 dark:ring-slate-600">
                                    <SpinnerIcon className="animate-spin h-5 w-5 text-teal" />
                                </div>
                                <div className="bg-white dark:bg-midnight-accent p-3 rounded-lg shadow-md font-medium text-sm text-slate-500 dark:text-slate-400 italic ring-1 ring-slate-200 dark:ring-slate-700/50">
                                    <p>Generating plan...</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={endOfMessagesRef} />
                </div>
                )}
                
                {route === 'home' && (
                <div className="flex-shrink-0 p-4 bg-white dark:bg-midnight-accent border-t border-slate-200 dark:border-slate-800">
                    <PromptInput
                        value={prompt}
                        onChange={setPrompt}
                        onSubmit={() => handleSend(prompt)}
                        isLoading={isInputDisabled}
                    />
                </div>
                )}
            </main>
        </div>
    );
};

export default App;