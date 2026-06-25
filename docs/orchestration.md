# Orchestration

Orchestration in ZilMate refers to the process of planning, dispatching, and executing complex tasks across multiple agents and tools.

## Task Initiation

Tasks can be initiated through:
1.  **CLI**: Commands like `zilmate talk`, `zilmate swarm`, or `zilmate jobs create`.
2.  **SDK**: Calls to `createZilMate().manager()` or `createZilMate().chat()`.
3.  **Triggers**: Automatic job creation from external events (e.g., GitHub webhooks).

## Planning vs. Execution

The system typically follows a two-phase cycle:
1.  **Planning**: The Manager or Orchestrator analyzes the prompt, checks memory (`recall`), and builds a mental model using the scratchpad.
2.  **Execution**: The agent enters a tool loop, calling internal or external tools until the goal is met.

## Swarm Orchestration

When a task is sent to the swarm:
-   **Classification**: The `SwarmOrchestrator` (`src/runtime/swarm.ts`) uses a model to determine the target department and subagent.
-   **Message Formatting**: The task is wrapped in a `SwarmMessage` containing priority and sender metadata.
-   **Routing**: The task is dispatched to the `SwarmAgent.run()` method of the selected specialist.

## Tool Loop Logic

Managed by `ToolLoopAgent` (from the Vercel AI SDK wrapper in ZilMate):
-   **Step Limits**: Capped by `limits.managerSteps` or `limits.subagentSteps`.
-   **Confirmation**: Destructive or outbound actions (e.g., `shell.execute`, `composio.write`) trigger a terminal confirmation prompt.
-   **Self-Healing**: If a tool call fails, the agent receives the error as feedback and can attempt to correct its parameters or try a different approach.

## Concurrency & State

-   **Session Isolation**: Each run has a unique `runId`. Memory and scratchpads are scoped by `sessionId` to prevent context leakage.
-   **Background Jobs**: Executed asynchronously by the `JobRunner`. Only one worker runs by default to ensure sequential execution of dependent tasks unless configured otherwise.

## Retries & Timeouts

-   **Jobs**: Automatically retried up to `maxAttempts` (default 3) with exponential backoff.
-   **Models**: Handled by the AI provider; ZilMate implements basic abort signal propagation.
