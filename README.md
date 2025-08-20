# Sirion Intent Router - Multi-Agent CLM Orchestration Simulator

## 1. Project Overview

This project is a sophisticated web application that simulates a multi-agent AI system for Contract Lifecycle Management (CLM). It serves as a powerful demonstration of the **Planner-Executor model**, where a central AI "Planner" receives a user's goal, generates a structured execution plan, and a "Executor" engine carries out that plan by orchestrating multiple, specialized mock "Agents".

The entire user experience is built around a conversational chat interface, allowing for complex, multi-turn interactions, dynamic plan generation, real-time execution visualization, and intelligent context handling.

**Core Technologies:**
*   **Frontend:** React + TypeScript, Vite dev server
*   **AI:** Google Gemini API (`gemini-2.5-flash`)
*   **Styling:** Tailwind CSS (via CDN)
*   **State Management:** `immer` for immutable state updates

---

## 2. Core Features

*   **Conversational Planner:** Users define complex goals in natural language through a chat interface.
*   **Dynamic Plan Generation:** A Gemini-powered planner analyzes the user's intent and conversation history to produce a detailed, step-by-step execution plan in a structured JSON format.
*   **Intelligent Orchestration:**
    *   **Parallel Execution:** The planner automatically identifies and parallelizes independent tasks for maximum efficiency.
    *   **Data Flow:** Seamlessly wires the output of one step to the input of another.
*   **Plan Visualization:** A clear, hierarchical, and interactive view of the generated plan, showing the status of each step in real-time (`pending`, `running`, `succeeded`, `failed`, `skipped`).
*   **Mock Agent Execution:** A robust executor engine simulates the plan, calling mock AI agents that return plausible CLM data.
*   **Conversational Human-in-the-Loop (HITL):** For ambiguous requests, the planner is mandated to ask for clarification. This process is seamlessly integrated into the chat: the assistant posts a question, pauses the plan, and the user can respond directly in the chat to continue the workflow.
*   **Conditional Logic & Re-planning:** The planner can handle complex conditional logic (if/then/else). It generates a plan to gather the necessary data, then uses a special `branch_orchestrator` agent to pause execution. The system then automatically re-plans, choosing the correct execution path based on the gathered data.
*   **Contextual Memory:** The planner analyzes the conversation history to reuse data from previous successful turns, avoiding redundant work (e.g., not re-fetching a list of contracts if it was already retrieved).
*   **Transparent "Thinking":** After each step, the orchestrator "thinks out loud" by generating a thought bubble that explains its evaluation of the result and its decision to proceed, providing unparalleled transparency into the AI's reasoning.
*   **Natural Language Summarization:** Upon successful execution, the assistant synthesizes the results into a concise, easy-to-understand summary.
*   **Light & Dark Modes:** A fully implemented theme switcher for user preference.

---

## 3. Project Structure

The project is structured to be simple and modular, with a clear separation of concerns.

| File/Directory                     | Purpose                                                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`                       | The main HTML entry point. Sets up Tailwind CSS and an import map for CDN deps used by the UI.                                                                     |
| `index.tsx`                        | The main React entry point. Renders the `<App />` component and wraps it in the `ThemeProvider`.                                                                   |
| `App.tsx`                          | **The core of the application.** Manages conversation history, user input, agent registry state, routing to the Config page, and orchestrates planner/executor.     |
| `types.ts`                         | **Central source of truth for data structures.** Contains `Plan`, `Step`, `ExecutionState`, etc. `AgentId` is now a `string` and agents are data-driven.           |
| `constants.tsx`                    | Core static prompts (planner/summarizer/thinking).                                                                                                                  |
| `services/geminiService.ts`        | `Planner` class: interface to Gemini API; now supports dynamic system-instructions set from the active agent profile.                                               |
| `services/planExecutor.ts`         | `PlanExecutor` engine that executes a plan, manages state updates, supports HITL and branching.                                                                    |
| `services/agentRegistry.ts`        | Loads/saves the active agent profile (JSON) from localStorage; provides default seeded agents.                                                                     |
| `services/promptBuilder.ts`        | Builds system-instructions for planner and mock-executor from the active agent registry.                                                                            |
| `components/ConfigPage.tsx`        | Config UI to create/edit/delete agents, enable/disable, import/export JSON, and restore defaults. Includes Mock/Real/System tabs.                                  |
| `components/`                      | UI components. Key: `PlanVisualizer.tsx` (renders plan), `PromptInput.tsx` (user input), telemetry/state views, icons, etc.                                         |
| `hooks/useTheme.tsx`               | Light/dark mode state and provider.                                                                                                                                 |
| `tailwind.config.js`               | Tailwind configuration.                                                                                                                                            |
| `README.md`                        | This file.                                                                                                                                                          |

---

## 4. Key Architectural Concepts

### Planner-Executor Model

The application is built on this powerful AI pattern:
1.  **The Planner (`geminiService.ts`):** An intelligent but stateless module (Gemini) whose only job is to create a declarative plan (a JSON object) based on a set of rules and a goal. It does not execute anything. This is achieved by providing a very detailed system prompt (`PLANNER_SYSTEM_INSTRUCTION`) and a strict `responseSchema` to the Gemini API, forcing it to return valid JSON.
2.  **The Executor (`planExecutor.ts`):** A deterministic and less-intelligent engine that takes the JSON plan and executes it precisely as instructed. It is responsible for the "how" – managing loops, parallel calls, state updates, and error handling.

This separation makes the system robust and extensible. We can change the planner's logic (by updating its prompt) without touching the execution engine, and vice-versa.

### State Management & Config (`App.tsx` + Config page)

The app manages chat `history` and a dynamic agent registry. Agents are editable from the Config page (`#/config`), saved as a JSON profile in localStorage, and used to build planner and mock-executor prompts. All state updates are immutable via **immer**.

### Dynamic Re-planning & Context Injection

A key feature is the system's ability to re-plan mid-execution. This is used for both Human-in-the-Loop and conditional branching.
1.  When the executor encounters a pause (`human_assistant` or `branch_orchestrator`), it stops.
2.  The `App.tsx` orchestrator then constructs a new prompt for the planner containing the original goal plus the new context (e.g., the user's answer or the result of a condition).
3.  This `[CONTINUATION CONTEXT]` tells the planner to create a *new* plan for only the **remaining tasks**, ensuring the system is adaptive and efficient without repeating work.

---

## 5. Dependencies & Setup

### Dependencies

Installed via npm and bundled by Vite:
* `react`, `react-dom`
* `@google/genai`
* `immer`
* `uuid`

### Setup Instructions

1. Install dependencies
   ```bash
   npm install
   ```
2. Create `.env.local` with your Gemini API key
   ```env
   GEMINI_API_KEY=YOUR_VALID_GEMINI_DEVELOPER_API_KEY
   ```
3. Start the dev server
   ```bash
   npm run dev
   ```
   Open the Local link (e.g., `http://localhost:5173` or `5174/5175` if ports are in use).

---

## 6. Configuration (Agents)

Open the Config page from the header or navigate to `#/config`.

Tabs:
* **Mock**: Create/edit/delete mock agents; set Name, Description, When to use, and optional Mock behavior. Enable/disable agents.
* **Real**: Define real agents (coming soon for execution). You can still prepare entries.
* **System**: Built-in orchestrator agents (`human_assistant`, `branch_orchestrator`). Listed for transparency; not editable.

Actions:
* **Save**: Persists the profile to localStorage and hot-swaps planner/executor prompts.
* **Import JSON / Export JSON**: Manage profiles as files.
* **Restore defaults**: Replaces the view with the baked-in default profile (click Save to persist).

Field meanings:
* **Name**: Display label in UI.
* **When to use**: One-line heuristic that helps the planner select the agent.
* **Description**: Longer capability description; appears in AVAILABLE AGENTS for the planner.
* **Mock behavior (optional)**: Appended to the base mock instruction to shape the agent's fabricated JSON output. If empty, a generic "return plausible JSON" rule is used.

Architecture notes:
* The planner sees enabled agents’ descriptions and “when to use” hints and chooses agents by capability (no bias for mock vs real).
* At runtime, the executor routes by agent type: mock → Gemini mock instruction; real → placeholder (webhooks/MCP coming soon).
