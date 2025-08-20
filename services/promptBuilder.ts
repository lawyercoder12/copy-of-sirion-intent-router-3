import { AgentDefinition } from '../types';
import { PLANNER_SYSTEM_INSTRUCTION, MOCK_AGENT_SYSTEM_INSTRUCTION_ENHANCED } from '../constants';

export function buildPlannerSystemInstruction(agents: AgentDefinition[], overrides?: string): string {
    const enabled = agents.filter(a => a.enabled);
    const lines = enabled.map(a => `*   **${a.id}**: ${a.description}${a.whenToUse ? ` When to use: ${a.whenToUse}` : ''}.`);
    const available = lines.join('\n');

    const replaced = PLANNER_SYSTEM_INSTRUCTION.replace(
        /\*\*AVAILABLE AGENTS:[\s\S]*?Now, based on the user's request, generate the plan\./,
        `**AVAILABLE AGENTS:**\n${available}\n\n**AGENT ID CONTRACT:**\n- For each step of type "agent_call", the field "agent_id" MUST be a valid agent ID from the list above.\n- Do not append parentheses, labels, or aliases.\n- If you need a human-readable label, put it in the step's "id" or within parameters, NOT in "agent_id".\n- Never include '(' or ')' in the "agent_id" value.\n\n**CTX CONTRACT:**\n- You will receive a [CTX] JSON block containing previously derived facts (key–value).\n- Always check CTX first; if a required value exists, reuse it and reference it in parameters using {{ctx.KEY}}.\n- Do not re-run corpus/search steps to derive a value that already exists in CTX.\n- Prefer building on CTX to reduce latency and duplication across re-plans.\n\nNow, based on the user's request, generate the plan.`
    );

    return overrides ? `${replaced}\n\n${overrides}` : replaced;
}

export function buildMockInstruction(agents: AgentDefinition[]): string {
    const extras = agents
        .filter(a => a.enabled && a.type === 'mock' && a.mockBehavior && a.mockBehavior.trim().length > 0)
        .map(a => a.mockBehavior!.trim())
        .join('\n');

    return `${MOCK_AGENT_SYSTEM_INSTRUCTION_ENHANCED}\n${extras ? `${extras}\n` : ''}`;
}


