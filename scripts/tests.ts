import { PlanExecutor } from '../services/planExecutor';
import { ExecutionState, Plan, Step, AgentCallStep, SequentialStep } from '../types';
import { buildPlannerSystemInstruction } from '../services/promptBuilder';

function assert(condition: any, message: string) {
  if (!condition) throw new Error(message);
}

async function testSanitizer() {
  const step: AgentCallStep = { id: 's1', type: 'agent_call', agent_id: 'ai_redlining(apply_redlines)', parameters: {} };
  const plan: Plan = { plan_id: 'p1', name: 't', description: 't', root: step };
  const initial: ExecutionState = { metadata: { doc_type: null, review_status: null, assumptions: [], mediator: { summary: null }, obligations: [] }, steps: { s1: { status: 'pending', started_at: null, ended_at: null, parameters: null, output: null, error: null, emissions: [] } }, trace: [] };

  const exec = new PlanExecutor(
    plan,
    initial,
    () => {},
    async (agentId) => {
      assert(agentId === 'ai_redlining', `Sanitization failed. Expected 'ai_redlining', got '${agentId}'`);
      return { ok: true };
    },
    () => {},
    async () => {}
  );

  const { finalState } = await exec.execute();
  assert(finalState.steps['s1'].status === 'succeeded', 'Step should succeed');
}

async function testPlannerContractPrompt() {
  const agents = [
    { id: 'ai_redlining', name: 'AI Redlining', description: 'Apply playbook redlines.', whenToUse: 'When redlining a draft.', type: 'mock', enabled: true },
    { id: 'share_with_counterparty', name: 'Share With Counterparty', description: 'Share document securely.', whenToUse: 'When sending a draft out.', type: 'mock', enabled: true },
    { id: 'esignature_orchestrator', name: 'E-Signature Orchestrator', description: 'Route for DocuSign.', whenToUse: 'When getting signatures.', type: 'mock', enabled: true },
  ] as any;
  const instr = buildPlannerSystemInstruction(agents);
  if (!instr.includes('AGENT ID CONTRACT')) throw new Error('Planner instruction missing AGENT ID CONTRACT');
  if (!instr.includes("Never include '(' or ')'")) throw new Error('Planner instruction missing parentheses prohibition');
}

async function testEndToEndFlow() {
  const s1: AgentCallStep = { id: 'apply_redlines', type: 'agent_call', agent_id: 'ai_redlining', parameters: { documentId: 'd1', playbookId: 'p1' } };
  const s2: AgentCallStep = { id: 'share_document', type: 'agent_call', agent_id: 'share_with_counterparty', parameters: { documentId: '{{steps.apply_redlines.output.documentId}}', recipient: 'counterparty@example.com' } };
  const s3: AgentCallStep = { id: 'pause_for_branch', type: 'agent_call', agent_id: 'branch_orchestrator', parameters: { inputValue: '{{steps.share_document.output.status}}', conditionsPrompt: 'If accepted, proceed to e-signature; otherwise, stop.' } };
  const parent: SequentialStep = { id: 'main', type: 'sequential', tasks: [s1, s2, s3] };
  const plan: Plan = { plan_id: 'e2e1', name: 'E2E', description: 'E2E simulated', root: parent };
  const initial: ExecutionState = { metadata: { doc_type: null, review_status: null, assumptions: [], mediator: { summary: null }, obligations: [] }, steps: { main: { status: 'pending', started_at: null, ended_at: null, parameters: null, output: null, error: null, emissions: [] }, apply_redlines: { status: 'pending', started_at: null, ended_at: null, parameters: null, output: null, error: null, emissions: [] }, share_document: { status: 'pending', started_at: null, ended_at: null, parameters: null, output: null, error: null, emissions: [] }, pause_for_branch: { status: 'pending', started_at: null, ended_at: null, parameters: null, output: null, error: null, emissions: [] } }, trace: [] };

  const seen: string[] = [];
  const exec = new PlanExecutor(
    plan,
    initial,
    () => {},
    async (agentId, parameters) => {
      seen.push(agentId);
      if (agentId === 'ai_redlining') return { documentId: 'd1', changes: 3 };
      if (agentId === 'share_with_counterparty') return { status: 'accepted' };
      if (agentId === 'branch_orchestrator') return { result: 'Paused for continuation' };
      return {};
    },
    () => {},
    async () => {}
  );

  const { wasPaused, finalState } = await exec.execute();
  assert(finalState.steps['pause_for_branch'].status === 'awaiting_continuation', 'Flow should mark branch step as awaiting_continuation');
  assert(seen.join(' -> ') === 'ai_redlining -> share_with_counterparty', 'Unexpected agent sequence');
}

async function run() {
  await testSanitizer();
  await testPlannerContractPrompt();
  await testEndToEndFlow();
  console.log('All tests passed');
}

run().catch(e => { console.error(e); process.exit(1); });


