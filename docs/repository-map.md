# Repository Map

A guide to the ZilMate codebase structure and key file locations.

## Directory Structure

| Folder | Description |
| :--- | :--- |
| `src/agents/` | Agent definitions, including the Manager and Swarm Specialists. |
| `src/cli/` | Command-line interface implementation and command handlers. |
| `src/config/` | Configuration logic and environment variable management. |
| `src/doc/` | Internal ZiloShift knowledge base and playbooks. |
| `src/jobs/` | Background job system, scheduling, and execution logic. |
| `src/memory/` | Persistence layer for history, long-term memory, and notebooks. |
| `src/runtime/` | Orchestration core, tool loop logic, and agent runtimes. |
| `src/tools/` | Implementation of internal tools (filesystem, search, finance, etc.). |
| `src/voice/` | Deepgram integration for real-time voice sessions. |
| `src/workspace/` | Logic for initializing and managing the local workspace filesystem. |

## Key Entrypoints

-   **CLI Entrypoint**: `src/index.ts` (compiled to `index.js`).
-   **SDK Entrypoint**: `src/server.ts`.
-   **Manager Agent**: `src/agents/manager.ts`.
-   **Swarm Registry**: `src/agents/swarm/registry.ts`.
-   **Swarm Runtime**: `src/runtime/swarm.ts`.

## Configuration & Schemas

-   **Env Vars**: `src/config/env.ts`.
-   **Model Definitions**: `src/config/models.ts`.
-   **Job Types**: `src/jobs/types.ts`.
-   **Prompt Builder**: `src/runtime/prompts/builder.ts`.

## Tools & Skills

-   **Internal Tools**: Located in `src/tools/`.
-   **External Skills**: Managed via `src/skills/`.

## Workspaces & Data

-   **Local Workspace**: Default is `~/Downloads/ZilMate` or as defined by `ZILMATE_WORKSPACE`.
-   **Data Storage**: `.zilo-manager/` within the workspace (managed by `src/memory/local-store.ts`).
-   **Outputs**: `outputs/` folder for images, reports, and logs.
