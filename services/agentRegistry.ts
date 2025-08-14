import { AgentDefinition } from '../types';

export interface AgentProfile {
    name: string;
    agents: AgentDefinition[];
    version: number;
}

const STORAGE_KEY = 'sirion.agent.profile.v1';

export function loadProfile(): AgentProfile {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return defaultProfile();
    try {
        const parsed = JSON.parse(raw) as AgentProfile;
        if (!parsed || !Array.isArray(parsed.agents)) return defaultProfile();
        return parsed;
    } catch {
        return defaultProfile();
    }
}

export function saveProfile(profile: AgentProfile) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function defaultProfile(): AgentProfile {
    return {
        name: 'Default',
        version: 1,
        agents: seedDefaultAgents(),
    };
}

function seedDefaultAgents(): AgentDefinition[] {
    return [
        { id: 'talk_to_corpus', name: 'Talk To Corpus', description: 'Search across a full contract repository.', whenToUse: 'Repository-wide queries and analytics.', type: 'mock', enabled: true, icon: 'talk_to_corpus' },
        { id: 'talk_to_document', name: 'Talk To Document', description: 'Ask detailed questions about a single contract.', whenToUse: 'Single-document Q&A.', type: 'mock', enabled: true, icon: 'talk_to_document' },
        { id: 'obligation_frequency_setup_recommender', name: 'Obligation Recommender', description: 'Structures recurring obligation schedules.', whenToUse: 'When deriving recurring obligation schedules from clause text.', type: 'mock', enabled: true, icon: 'obligation_frequency_setup_recommender' },
        { id: 'service_level_fulfillment_agent', name: 'SLA Fulfillment Agent', description: 'Evaluates if SLA commitments are met.', whenToUse: 'When checking SLA compliance across documents.', type: 'mock', enabled: true, icon: 'service_level_fulfillment_agent' },
        { id: 'template_harmonization', name: 'Template Harmonization', description: 'Creates standardized templates from multiple agreements.', whenToUse: 'When homogenizing multiple contract templates.', type: 'mock', enabled: true, icon: 'template_harmonization' },
        { id: 'convo_create', name: 'ConvoCreate', description: 'Guides users through interactive contract drafting.', whenToUse: 'When assisting interactive drafting.', type: 'mock', enabled: true, icon: 'convo_create' },
        { id: 'cross_reference_check', name: 'Cross-Reference Check', description: 'Detects and fixes broken clause references.', whenToUse: 'When validating cross-references.', type: 'mock', enabled: true, icon: 'cross_reference_check' },
        { id: 'numbering_check', name: 'Numbering Check', description: 'Validates and auto-fixes document numbering.', whenToUse: 'When validating numbering consistency.', type: 'mock', enabled: true, icon: 'numbering_check' },
        { id: 'definitions_check', name: 'Definitions Check', description: 'Flags undefined or inconsistent defined terms.', whenToUse: 'When checking defined term usage.', type: 'mock', enabled: true, icon: 'definitions_check' },
        { id: 'teams_integration', name: 'Teams Integration', description: 'Connects with MS Teams for updates and workflows. This is for ONE-WAY notifications only; it cannot receive replies.', whenToUse: 'When sending one-way notifications to MS Teams.', type: 'mock', enabled: true, icon: 'teams_integration' },
        { id: 'ask_tim', name: 'AskTim', description: 'Legal research assistant for interpretation and guidance.', whenToUse: 'When asking for legal interpretation.', type: 'mock', enabled: true, icon: 'ask_tim' },
        { id: 'playbook_generator_builder', name: 'Playbook Builder', description: 'Builds redlining playbooks from past contracts.', whenToUse: 'When generating playbooks.', type: 'mock', enabled: true, icon: 'playbook_generator_builder' },
        { id: 'supplier_onboarding_copilot', name: 'Supplier Onboarding Copilot', description: 'Automates supplier onboarding workflows.', whenToUse: 'When orchestrating onboarding workflows.', type: 'mock', enabled: true, icon: 'supplier_onboarding_copilot' },
        { id: 'human_assistant', name: 'Human Assistant', description: 'Asks the user for clarification.', whenToUse: 'Mandatory when request is ambiguous or needs human input.', type: 'mock', enabled: true, icon: 'human_assistant', system: true },
        { id: 'branch_orchestrator', name: 'Branch Orchestrator', description: 'Pauses execution to decide on the next steps based on data.', whenToUse: 'End of Phase 1 for conditional plans.', type: 'mock', enabled: true, icon: 'branch_orchestrator', system: true },
    ];
}


