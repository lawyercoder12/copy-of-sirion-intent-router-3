import React, { useState } from 'react';
import { AgentDefinition, SYSTEM_AGENT_IDS } from '../types';
import { loadProfile, saveProfile, AgentProfile, defaultProfile } from '../services/agentRegistry';

interface ConfigPageProps {
    onClose: () => void;
    onSavePrompts: (agents: AgentDefinition[], profileName: string) => void;
}

export const ConfigPage: React.FC<ConfigPageProps> = ({ onClose, onSavePrompts }) => {
    const [profile, setProfile] = useState<AgentProfile>(loadProfile());
    const [tab, setTab] = useState<'mock' | 'real' | 'system'>('mock');

    const visibleAgents = tab === 'system'
        ? profile.agents.filter(a => a.system)
        : profile.agents.filter(a => !a.system && a.type === tab);
    const comingSoon = tab === 'real';

    const addAgent = () => {
        const id = prompt('New agent id (slug):');
        if (!id) return;
        if (profile.agents.some(a => a.id === id)) { alert('ID already exists'); return; }
        const a: AgentDefinition = { id, name: id, description: '', whenToUse: '', type: tab, enabled: true, icon: id };
        setProfile({ ...profile, agents: [...profile.agents, a] });
    };

    const saveAll = () => {
        saveProfile(profile);
        onSavePrompts(profile.agents, profile.name);
        onClose();
    };

    const importJson = async (file: File) => {
        const text = await file.text();
        try {
            const parsed = JSON.parse(text) as AgentProfile;
            if (!parsed || !Array.isArray(parsed.agents)) throw new Error('Invalid profile JSON');
            setProfile(parsed);
        } catch (e) {
            alert('Failed to import JSON');
        }
    };

    const exportJson = () => {
        const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${profile.name || 'agents'}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const restoreDefaults = () => {
        if (confirm('Restore default agent profile? This will overwrite any unsaved edits in this view. Click Save to persist the defaults.')) {
            setProfile(defaultProfile());
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold">Configuration</h2>
                    <div className="mt-1 text-sm text-slate-600">Profile: <input className="border rounded px-2 py-1" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} /></div>
                </div>
                <div className="flex items-center gap-2">
                    <label className="px-3 py-2 border rounded text-sm cursor-pointer">
                        Import JSON
                        <input type="file" accept="application/json" className="hidden" onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) importJson(f);
                        }} />
                    </label>
                    <button className="px-3 py-2 border rounded text-sm" onClick={exportJson}>Export JSON</button>
                    <button className="px-3 py-2 border rounded text-sm" onClick={restoreDefaults}>Restore defaults</button>
                    <button className="px-3 py-2 bg-teal text-white rounded text-sm" onClick={saveAll}>Save</button>
                    <button className="px-3 py-2 border rounded text-sm" onClick={onClose}>Close</button>
                </div>
            </div>

            {/* Quick legend / guidance */}
            <div className="p-3 border rounded bg-slate-50 dark:bg-midnight-accent text-sm text-slate-600 space-y-2">
                <div className="font-semibold">How configuration drives the system</div>
                <ul className="list-disc list-inside space-y-1">
                    <li><span className="font-semibold">Planner (selection)</span>: The planner sees the <span className="font-semibold">Description</span> and <span className="font-semibold">When to use</span> of all <span className="font-semibold">enabled</span> non-system agents and chooses which ones to include in plans.</li>
                    <li><span className="font-semibold">Executor (runtime)</span>: When a step runs, the executor looks up the agent type:
                        <ul className="list-disc list-inside ml-4">
                            <li><span className="font-semibold">Mock</span>: Calls Gemini with a base mock instruction. If the agent has <span className="font-semibold">Mock behavior</span>, it is <span className="font-semibold">appended</span> to the base instruction to shape the JSON output. It does <span className="font-semibold">not replace</span> the planner prompt.</li>
                            <li><span className="font-semibold">Real</span>: Reserved for future webhook/MCP execution (coming soon). Not used yet.</li>
                        </ul>
                    </li>
                    <li><span className="font-semibold">System agents</span> (<code>human_assistant</code>, <code>branch_orchestrator</code>): Shown under the System tab, non-editable. Used by the planner for ambiguity and conditional branching.</li>
                    <li><span className="font-semibold">Save</span>: Rebuilds prompts from your profile and hot-swaps the planner configuration. Profiles are stored locally and can be <span className="font-semibold">Imported/Exported</span> as JSON.</li>
                </ul>
                <div className="mt-1">Field definitions:</div>
                <div><span className="font-semibold">Name</span>: Display label shown in the UI.</div>
                <div><span className="font-semibold">When to use</span>: One-line hint that guides the planner to pick this agent.</div>
                <div><span className="font-semibold">Description</span>: Longer text listed in AVAILABLE AGENTS; influences planner selection.</div>
                <div><span className="font-semibold">Mock behavior (optional)</span>: Extra instruction for the mock executor to shape JSON output. If empty, a generic "return plausible JSON" rule is used.</div>
            </div>

            <div className="flex items-center gap-2">
                <button className={`px-3 py-2 rounded text-sm ${tab === 'mock' ? 'bg-slate-200 dark:bg-slate-700' : 'border'}`} onClick={() => setTab('mock')}>Mock</button>
                <button className={`px-3 py-2 rounded text-sm ${tab === 'real' ? 'bg-slate-200 dark:bg-slate-700' : 'border'}`} onClick={() => setTab('real')}>Real</button>
                <button className={`px-3 py-2 rounded text-sm ${tab === 'system' ? 'bg-slate-200 dark:bg-slate-700' : 'border'}`} onClick={() => setTab('system')}>System</button>
            </div>

            {comingSoon && (
                <div className="p-3 border rounded bg-slate-50 dark:bg-midnight-accent text-slate-600">
                    Real agent configuration is coming soon. You can still mark agents as real now for future wiring.
                </div>
            )}
            {tab === 'system' && (
                <div className="p-3 border rounded bg-slate-50 dark:bg-midnight-accent text-slate-600">
                    These are system agents managed by the orchestrator. They are required for planning logic (e.g., human-in-the-loop, branching) and are not editable.
                </div>
            )}

            <div>
                <div className="mb-3">
                    <button className="px-3 py-2 border rounded" onClick={addAgent} disabled={comingSoon || tab === 'system'}>Add {tab} agent</button>
                </div>
                <ul className="space-y-2">
                    {visibleAgents.map(a => (
                        <li key={a.id} className="p-3 border rounded">
                            <div className="flex items-center justify-between">
                                <div className="font-semibold">{a.name} <span className="text-xs text-slate-500">({a.id})</span></div>
                                <div className="flex items-center gap-3">
                                    <label className="text-sm">Enabled <input type="checkbox" checked={a.enabled} disabled={!!a.system} onChange={e => { a.enabled = e.target.checked; setProfile({ ...profile, agents: [...profile.agents] }); }} /></label>
                                    {(!a.system && !SYSTEM_AGENT_IDS.has(a.id)) && (
                                        <button className="px-2 py-1 text-red-600" onClick={() => setProfile({ ...profile, agents: profile.agents.filter(x => x.id !== a.id) })}>Delete</button>
                                    )}
                                </div>
                            </div>
                            <div className="mt-2 grid grid-cols-1 gap-3">
                                <label className="text-sm text-slate-600">
                                    Name
                                    <span title="Display label shown in the UI." className="ml-1 text-slate-400 cursor-help">ℹ</span>
                                    <input className="mt-1 w-full border rounded p-2" placeholder="Name" value={a.name} disabled={!!a.system} onChange={e => { a.name = e.target.value; setProfile({ ...profile, agents: [...profile.agents] }); }} />
                                </label>
                                <label className="text-sm text-slate-600">
                                    When to use
                                    <span title="One-line hint that guides the planner when to pick this agent." className="ml-1 text-slate-400 cursor-help">ℹ</span>
                                    <input className="mt-1 w-full border rounded p-2" placeholder="When to use" value={a.whenToUse} disabled={!!a.system} onChange={e => { a.whenToUse = e.target.value; setProfile({ ...profile, agents: [...profile.agents] }); }} />
                                </label>
                                <label className="text-sm text-slate-600">
                                    Description
                                    <span title="Longer text listed in AVAILABLE AGENTS; influences planner selection." className="ml-1 text-slate-400 cursor-help">ℹ</span>
                                    <textarea className="mt-1 w-full border rounded p-2" placeholder="Description" value={a.description} disabled={!!a.system} onChange={e => { a.description = e.target.value; setProfile({ ...profile, agents: [...profile.agents] }); }} />
                                </label>
                                {a.type === 'mock' && !a.system && (
                                  <label className="text-sm text-slate-600">
                                    Mock behavior (optional)
                                    <span title="Extra instruction for the mock executor. If empty, a generic 'return plausible JSON' rule is used." className="ml-1 text-slate-400 cursor-help">ℹ</span>
                                    <textarea className="mt-1 w-full border rounded p-2" placeholder="Mock behavior (optional)" value={a.mockBehavior || ''} onChange={e => { a.mockBehavior = e.target.value; setProfile({ ...profile, agents: [...profile.agents] }); }} />
                                  </label>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};


