import { GoogleGenAI, Type, Chat, GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { Plan, AgentId, Step, ExecutionState } from '../types';
import { PLANNER_SYSTEM_INSTRUCTION, MOCK_AGENT_SYSTEM_INSTRUCTION_ENHANCED, SUMMARIZER_SYSTEM_INSTRUCTION, ORCHESTRATOR_THINKING_SYSTEM_INSTRUCTION } from '../constants';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });
const model = "gemini-2.5-flash";

const stepSchemaDefinition = (depth = 0, agentIdEnum?: string[]): any => {
    if (depth > 4) {
      return {
        type: Type.OBJECT,
        description: "A terminal agent call step. No further nesting is allowed.",
        properties: {
          id: { type: Type.STRING, description: "A unique identifier for the step." },
          type: { type: Type.STRING, enum: ["agent_call"], description: "Must be 'agent_call' at this depth." },
          agent_id: agentIdEnum && agentIdEnum.length > 0 
            ? { type: Type.STRING, enum: agentIdEnum, description: "The agent ID to be called (must be one of AVAILABLE_AGENTS IDs)." }
            : { type: Type.STRING, description: "The agent ID to be called." },
          parameters: { type: Type.STRING, description: "A minified JSON string of parameters for the agent call." },
          branch_key: { type: Type.STRING },
          loop_key: { type: Type.STRING },
        },
        required: ["id", "type", "agent_id"],
      };
    }
  
    const recursiveStep = stepSchemaDefinition(depth + 1, agentIdEnum);
  
    return {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: "A unique identifier for the step." },
        type: { type: Type.STRING, enum: ["agent_call", "sequential", "parallel"] },
        agent_id: agentIdEnum && agentIdEnum.length > 0 
            ? { type: Type.STRING, enum: agentIdEnum, description: "The agent ID (for 'agent_call' type only)." }
            : { type: Type.STRING, description: "The agent ID (for 'agent_call' type only)." },
        parameters: { type: Type.STRING, description: "A minified JSON string of parameters (for 'agent_call' type only). Example: '{\"document_id\":\"doc-123\"}'" },
        tasks: { type: Type.ARRAY, description: "A list of sub-steps (for 'sequential' or 'parallel' types only).", items: recursiveStep },
        branch_key: { type: Type.STRING },
        loop_key: { type: Type.STRING },
      },
      required: ["id", "type"],
    };
  };

const planSchemaTemplate = (agentIdEnum?: string[]) => ({
    type: Type.OBJECT,
    properties: {
        plan_id: { type: Type.STRING, description: "A unique identifier (UUID or ULID) for the plan." },
        name: { type: Type.STRING, description: "A short, descriptive title for the plan." },
        description: { type: Type.STRING, description: "A one or two sentence summary of the plan's goal." },
        root: stepSchemaDefinition(0, agentIdEnum)
    },
    required: ["plan_id", "name", "description", "root"]
});


class Planner {
    private chat: Chat | null = null;
    private plannerSystemInstruction: string = PLANNER_SYSTEM_INSTRUCTION;
    private mockInstruction: string = MOCK_AGENT_SYSTEM_INSTRUCTION_ENHANCED;
    private agentIdEnum: string[] | undefined = undefined;
    
    constructor() {
        if (!API_KEY) {
            throw new Error("API_KEY is not configured.");
        }
        this.resetChat();
    }
    
    public setSystemInstructions(plannerInstruction: string, mockInstruction: string) {
        this.plannerSystemInstruction = plannerInstruction;
        this.mockInstruction = mockInstruction;
        this.resetChat();
    }

    public setAvailableAgentIds(ids: string[]) {
        this.agentIdEnum = ids;
        this.resetChat();
    }

    public resetChat() {
        const planSchema = planSchemaTemplate(this.agentIdEnum);
        this.chat = ai.chats.create({
            model: model,
            config: {
                systemInstruction: this.plannerSystemInstruction,
                responseMimeType: "application/json",
                responseSchema: planSchema,
            }
        });
    }

    private parseParametersRecursive(step: any) {
        if (step.type === 'agent_call' && typeof step.parameters === 'string') {
            try {
                step.parameters = JSON.parse(step.parameters);
            } catch (e) {
                console.error('Failed to parse parameters string for step:', step.id, e);
                step.parameters = { error: 'Failed to parse parameters JSON string', original: step.parameters };
            }
        }
        if (step.tasks && Array.isArray(step.tasks)) {
            step.tasks.forEach(s => this.parseParametersRecursive(s));
        }
    }

    public async generate(prompt: string): Promise<Plan> {
         if (!this.chat) {
            throw new Error("Chat is not initialized.");
         }
         try {
            const response: GenerateContentResponse = await this.chat.sendMessage({ message: prompt });
            
            const jsonText = response.text.trim();
            if (!jsonText) {
                throw new Error("API returned an empty response. The prompt might be too complex or blocked.");
            }
            
            const plan = JSON.parse(jsonText);
            this.parseParametersRecursive(plan.root);

            return plan as Plan;
        } catch(error) {
            console.error("Error generating plan:", error);
            if (error instanceof Error) {
                const message = (error as any)?.cause?.error?.message || error.message;
                if (message.includes("400") || message.includes("INVALID_ARGUMENT")) {
                    throw new Error(`The request was invalid. This can happen if the prompt violates safety policies. (Original error: ${message})`);
                }
            }
            throw new Error(`Failed to generate a valid plan from the AI model. ${error instanceof Error ? error.message : ''}`);
        }
    }

    public async generateThought(originalPrompt: string, plan: Plan, completedStep: Step, currentState: ExecutionState): Promise<string> {
        const thinkingPrompt = `
            The user's original goal was: "${originalPrompt}"
            The overall plan is: ${JSON.stringify(plan, null, 2)}
            The step that just finished is: ${JSON.stringify(completedStep, null, 2)}
            The current state of execution (including the output from the finished step) is: ${JSON.stringify(currentState, null, 2)}
            
            Now, provide a brief, one-sentence thought bubble.
        `;

        try {
            const response = await ai.models.generateContent({
                model,
                contents: thinkingPrompt,
                config: {
                    systemInstruction: ORCHESTRATOR_THINKING_SYSTEM_INSTRUCTION,
                    thinkingConfig: { thinkingBudget: 0 }
                }
            });
            return response.text.trim();
        } catch (error) {
            console.error("Error generating thought:", error);
            return "Failed to generate thought.";
        }
    }


    public async summarizeStream(prompt: string, finalState: ExecutionState, onChunk: (chunk: string) => void): Promise<void> {
        const summarizationPrompt = `
            The user's original request was: "${prompt}"

            Here is the final execution state of the plan that was run to address the request:
            ${JSON.stringify(finalState, null, 2)}

            Now, please provide the summary.
        `;

        try {
            const response = await ai.models.generateContentStream({
                model,
                contents: summarizationPrompt,
                config: {
                    systemInstruction: SUMMARIZER_SYSTEM_INSTRUCTION
                }
            });

            for await (const chunk of response) {
                onChunk(chunk.text);
            }

        } catch (error) {
            console.error("Error during summarization:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            onChunk(`\n\n[**Error during summarization:** ${errorMessage}]`);
        }
    }

    public async mockAgentExecution(agentId: AgentId, parameters: Record<string, any>): Promise<any> {
        if (!API_KEY) throw new Error("API_KEY is not configured.");

        const prompt = `
          Agent ID: ${agentId}
          Parameters: ${JSON.stringify(parameters, null, 2)}

          Generate the JSON output for this agent call. Be realistic and concise.
        `;

        try {
            const response = await ai.models.generateContent({
                model,
                contents: prompt,
                config: {
                    systemInstruction: this.mockInstruction,
                    responseMimeType: "application/json",
                    thinkingConfig: { thinkingBudget: 0 } 
                }
            });

            const jsonText = response.text.trim();
            if (!jsonText) {
                return { status: "No output from mock agent." };
            }

            return JSON.parse(jsonText);
        } catch(error) {
            console.error(`Error in mock execution for ${agentId}:`, error);
            return { error: `Mock agent ${agentId} failed.`, details: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
}

export const planner = new Planner();