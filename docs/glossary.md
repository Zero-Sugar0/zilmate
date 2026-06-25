# Glossary

Definitions of project-specific terms used throughout the ZilMate codebase.

-   **Agent**: An autonomous or semi-autonomous unit that uses an LLM to perform tasks and call tools.
-   **Manager (CEO)**: The primary orchestrator agent that handles top-level user requests.
-   **Swarm**: A collection of specialized agents working together on complex business objectives.
-   **Specialist**: A narrow-focused swarm agent (e.g., SEO Expert, Architect).
-   **Tool**: A function that an agent can call to interact with the system or external APIs.
-   **Toolkit**: A collection of related tools, usually from an external provider via Composio.
-   **Run**: A single execution turn of an agent.
-   **Job**: A background task that is queued and executed by the `JobWorker`.
-   **Worker**: The background process (`zilmate jobs worker`) that polls for and executes due jobs.
-   **Workspace**: The local directory where ZilMate stores memories, logs, and outputs.
-   **Notebook**: A persistent markdown file (`notebook.md`) used for project-specific context.
-   **Scratchpad**: Transient memory used by an agent during a single run to store intermediate notes.
-   **Composio**: The integration platform used by ZilMate to connect to external apps.
-   **AI Gateway**: A middleware service used to route LLM requests to various providers.
-   **Situation Brief**: A snapshot of the current environment (CWD, Git, workspace) provided to the agent at the start of a run.
-   **Handoff**: The process of saving state from one run to be resumed in another.
