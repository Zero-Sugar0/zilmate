# Tools

ZilMate's capabilities are extended through a robust tool system categorized into internal utilities and external application integrations.

## Internal Tool System

Internal tools are implemented in `src/tools/`. They follow the Vercel AI SDK `tool` pattern.

### Core Utilities
-   **Filesystem (`filesystem.tool.ts`)**: Read/write files, list directories, search content.
-   **Shell (`shell.tool.ts`)**: Execute bash/PowerShell commands with safety guards.
-   **Time (`time.tool.ts`)**: Get current time, format dates, calculate offsets.
-   **Knowledge (`knowledge.tool.ts`)**: Access the ZiloShift internal documentation.

### Intelligence & Research
-   **Web Search (`web-search.tool.ts`)**: Powered by Tavily for real-time web information.
-   **Web Intelligence (`web-intelligence.tool.ts`)**: Mapping, crawling, and deep research via Firecrawl/Tavily.
-   **Visual Audit (`visual-audit.tool.ts`)**: Vision-based analysis of screenshots and UI/UX patterns.
-   **Image Intelligence (`image-intelligence.tool.ts`)**: Background removal and image analysis using `rembg`.

### Management & Memory
-   **Notebook (`notebook.tool.ts`)**: Persistent project-specific notes and decisions.
-   **Memory (`memory.tool.ts`)**: CRUD operations for long-term agent memory.
-   **Jobs (`jobs.tool.ts`)**: Create, list, and manage background tasks.
-   **Scratchpad (`scratchpad.tool.ts`)**: Temporary storage for a single run's context.

### Specialized Tools
-   **Finance (`finance.tool.ts`)**: Yahoo Finance integration for market data.
-   **Security (`pentest.tool.ts`, `osint.tool.ts`)**: Vulnerability scanning and open-source intelligence.
-   **Browser (`browser.tool.ts`)**: Playwright-based web automation and content extraction.

## External Tools (Composio)

ZilMate uses **Composio** (`src/tools/composio.tool.ts`) to connect to 100+ external apps.

-   **Discovery**: Agents can search for available toolkits based on the task.
-   **Auth**: Auth links are generated automatically if a connection is missing.
-   **Execution**: Tool parameters are derived from app schemas and executed via the Composio SDK.

## Tool Registration & Authorization

-   **Registration**: Tools are grouped and added to agents during initialization (e.g., `src/agents/manager.ts`).
-   **Authorization**: "Write" actions (e.g., deleting a file, sending an email) require explicit user approval via `runtime/confirm.ts`.
-   **Normalization**: Tool outputs are stringified or structured as JSON and returned to the agent's context for the next turn.

## Adding a New Tool

To add a new internal tool:
1.  Create a new file in `src/tools/`.
2.  Define the tool using the `tool()` function from `ai`.
3.  Specify the `description`, `inputSchema` (Zod), and `execute` function.
4.  Register the tool in the relevant agent factory (e.g., `src/agents/manager.ts`).
