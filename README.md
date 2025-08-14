# Sirion Intent Router - Multi-Agent CLM Orchestration Simulator

## 1. Project Overview

This project is a sophisticated web application that simulates a multi-agent AI system for Contract Lifecycle Management (CLM). It serves as a powerful demonstration of the **Planner-Executor model**, where a central AI "Planner" receives a user's goal, generates a structured execution plan, and a "Executor" engine carries out that plan by orchestrating multiple, specialized mock "Agents".

The entire user experience is built around a conversational chat interface, allowing for complex, multi-turn interactions, dynamic plan generation, real-time execution visualization, and intelligent context handling.

**Core Technologies:**
*   **Frontend:** React with TypeScript (via import maps, no build step)
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
*   **Human-in-the-Loop (HITL):** For ambiguous requests, the planner is mandated to pause and ask the user for clarification via a dedicated UI prompt before proceeding.
*   **Contextual Memory:** The planner analyzes the conversation history to reuse data from previous successful turns, avoiding redundant work (e.g., not re-fetching a list of contracts if it was already retrieved).
*   **Transparent "Thinking":** After each step, the orchestrator "thinks out loud" by generating a thought bubble that explains its evaluation of the result and its decision to proceed, providing unparalleled transparency into the AI's reasoning.
*   **Natural Language Summarization:** Upon successful execution, the assistant synthesizes the results into a concise, easy-to-understand summary.
*   **Light & Dark Modes:** A fully implemented theme switcher for user preference.

---

## 3. Project Structure

The project is structured to be simple and modular, with a clear separation of concerns.

| File/Directory                  | Purpose                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`                    | The main HTML entry point. Sets up Tailwind CSS, Google Fonts, and the crucial **import map** for managing JavaScript dependencies without a build step.                |
| `index.tsx`                     | The main React entry point. Renders the `<App />` component and wraps it in the `ThemeProvider`.                                                                      |
| `App.tsx`                       | **The core of the application.** Manages the entire application state, including conversation history (`ChatTurn[]`), user input, and orchestrates all other components and services. |
| `types.ts`                      | **Central source of truth for data structures.** Contains all TypeScript type definitions for `Plan`, `Step`, `AgentId`, `ExecutionState`, etc.                     |
| `constants.tsx`                 | **The brain of the AI.** Contains agent definitions (name, description, icon) and, most importantly, the critical **system prompts** that instruct the Gemini AI on how to behave as a planner, summarizer, and thinker. |
| `services/geminiService.ts`     | Houses the `Planner` class. This service is the sole interface to the Google Gemini API, handling plan generation, summarization, thought generation, and mock agent calls. |
| `services/planExecutor.ts`      | The `PlanExecutor` class. This is the "dumb" engine that receives a plan and executes it step-by-step, managing state updates, resolving data flow, and handling sequential/parallel logic. |
| `components/`                   | Contains all UI components. Key components include `PlanVisualizer.tsx` (renders the plan tree), `PromptInput.tsx` (user input), and `HumanInteractionPrompt.tsx` (for HITL). |
| `hooks/useTheme.tsx`            | A custom React hook and Context provider for managing the light/dark mode theme and persisting the user's choice in local storage.                                     |
| `tailwind.config.js`            | Configuration file for Tailwind CSS, defining the custom color palette (Teal, Midnight, Cloud, etc.).                                                                  |
| `README.md`                     | This file.                                                                                                                                                          |

---

## 4. Key Architectural Concepts

### Planner-Executor Model

The application is built on this powerful AI pattern:
1.  **The Planner (`geminiService.ts`):** An intelligent but stateless module (Gemini) whose only job is to create a declarative plan (a JSON object) based on a set of rules and a goal. It does not execute anything. This is achieved by providing a very detailed system prompt (`PLANNER_SYSTEM_INSTRUCTION`) and a strict `responseSchema` to the Gemini API, forcing it to return valid JSON.
2.  **The Executor (`planExecutor.ts`):** A deterministic and less-intelligent engine that takes the JSON plan and executes it precisely as instructed. It is responsible for the "how" – managing loops, parallel calls, state updates, and error handling.

This separation makes the system robust and extensible. We can change the planner's logic (by updating its prompt) without touching the execution engine, and vice-versa.

### State Management (`App.tsx`)

The entire application state is managed within a single state variable in `App.tsx`: `history`, which is an array of `ChatTurn` objects.
`const [history, setHistory] = useState<ChatTurn[]>([]);`
Each `ChatTurn` represents a single back-and-forth between the user and the assistant, containing the prompt, the generated plan, the execution state, and various status flags.
To ensure safe and predictable state updates, all modifications are done immutably using the **`immer`** library.

---

## 5. Dependencies & Setup

This project is designed to run directly in the browser with no build step.

### Dependencies

Dependencies are managed via an **import map** in `index.html`.
*   `react` & `react-dom`: For building the user interface.
*   `@google/genai`: The official Google Gemini client SDK.
*   `immer`: For immutable state management.
*   `uuid`: For generating unique IDs for chat turns.

### Setup Instructions

1.  **API Key:** The application requires a valid Google Gemini API key. This key **must** be provided as an environment variable named `API_KEY`. The `geminiService.ts` file reads this key directly from `process.env.API_KEY`.
    *   *In a local development environment or a platform that supports it, you need to set this environment variable before launching the server.*

2.  **Running Locally:**
    *   Since there is no build process, you simply need to serve the project directory with a local web server. A common way to do this is with Python's built-in server or Node.js's `serve` package.
    *   **Example using Python:**
        ```bash
        # Navigate to the project's root directory
        cd /path/to/your/project

        # Start the server (for Python 3)
        python -m http.server
        ```
    *   Open your browser to the address provided by the server (e.g., `http://localhost:8000`).

---

## 6. How to Extend the Project

### Adding a New Agent

Adding a new agent is a straightforward process designed to be easy and modular.

**Example: Let's add a new agent called `risk_analyzer`.**

1.  **Update `types.ts`:** Add the new agent's ID to the `AgentId` union type.
    ```typescript
    // in types.ts
    export type AgentId =
      | 'talk_to_corpus'
      // ... other agents
      | 'risk_analyzer'; // <-- Add new agent here
    ```

2.  **Create an Icon (`components/icons/AgentIcon.tsx`):** Create a new React component for the agent's icon.
    ```tsx
    // in components/icons/AgentIcon.tsx
    export const RiskAnalyzerIcon = () => <svg>...</svg>;
    ```
    Then, add it to the main `AgentIcon` component's exports and definitions.

3.  **Define the Agent (`constants.tsx`):** Add the new agent to the `AGENT_DEFINITIONS` object. This tells the UI how to display it.
    ```tsx
    // in constants.tsx
    import { ..., RiskAnalyzerIcon } from './components/icons/AgentIcon';

    export const AGENT_DEFINITIONS: Record<AgentId, ...> = {
        // ... other agents
        risk_analyzer: { 
            name: 'Risk Analyzer', 
            description: 'Analyzes contract text for potential risks.', 
            icon: <RiskAnalyzerIcon /> 
        },
    };
    ```

4.  **Teach the Planner (`constants.tsx`):** This is the most critical step. Update the `PLANNER_SYSTEM_INSTRUCTION` to include the new agent in the `AVAILABLE_AGENTS` list and explain to the AI what it does and when to use it.
    ```
    // in PLANNER_SYSTEM_INSTRUCTION within constants.tsx
    **AVAILABLE AGENTS:**
    *   ...
    *   **risk_analyzer**: Analyzes contract text for risks based on a predefined playbook. Trigger when a user mentions "risk", "issues", or "problems" in a contract.
    *   ...
    ```

5.  **Teach the Mock Agent (`constants.tsx`):** Update the `MOCK_AGENT_SYSTEM_INSTRUCTION_ENHANCED` to instruct the mock API on how to generate a plausible response for this new agent.
    ```
    // in MOCK_AGENT_SYSTEM_INSTRUCTION_ENHANCED within constants.tsx
    ...
    When acting as 'risk_analyzer', return a list of found risks with a severity level and a brief description.
    ...
    ```

That's it. The system is now aware of the `risk_analyzer` agent, and the planner will start using it for relevant tasks.
