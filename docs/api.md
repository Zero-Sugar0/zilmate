# API Reference

ZilMate provides two primary interfaces: a Command Line Interface (CLI) and a Software Development Kit (SDK).

## CLI Reference

The CLI entrypoint is `index.js`.

### Primary Commands
-   **`talk`**: Persistent interactive chat session.
-   **`manager "<prompt>"`**: Run a one-shot task through the manager.
-   **`swarm "<goal>"`**: Initiate a swarm orchestration for a business objective.
-   **`jobs create "<task>"`**: Queue a background job.
-   **`doctor`**: Check system health and dependencies.
-   **`setup`**: Interactive configuration.

### Memory Commands
-   **`remember "<text>"`**: Save to long-term memory.
-   **`recall "<query>"`**: Search long-term memory.
-   **`memory list`**: List all saved memories.

### Automation Commands
-   **`triggers listen`**: Stream real-time events from Composio.
-   **`jobs worker`**: Start the local job processor.

## SDK Reference (`src/server.ts`)

The SDK allows embedding ZilMate into other Node.js applications.

### `createZilMate(options)`
Initializes a ZilMate instance.
-   **Options**:
    -   `sessionId`: (Optional) Persistence ID.
    -   `onProgress`: (Optional) Callback for real-time status updates.
    -   `confirm`: (Optional) Custom handler for action approvals.

### Instance Methods

#### `chat(input)`
Runs the manager in chat mode.
-   **Input**: `{ message: string }`
-   **Returns**: `Promise<{ text: string }>`

#### `manager(input)`
Runs a one-shot manager task.
-   **Input**: `{ prompt: string }`
-   **Returns**: `Promise<{ text: string }>`

#### `research(input)`
Specialized documentation and web research.
-   **Input**: `{ query: string }`
-   **Returns**: `Promise<{ text: string }>`

#### `createJob(input)`
Queues a background job.
-   **Input**: `{ task: string, schedule?: string, maxAttempts?: number }`
-   **Returns**: `Promise<ZilMateJob>`

#### `handleJobWebhook(input, secret)`
Processes incoming job triggers from QStash or external webhooks.

## Internal APIs

-   **Trigger Router (`src/jobs/trigger-router.ts`)**: Routes external events to specific workflow handlers.
-   **Storage Interface (`src/runtime/storage/interface.ts`)**: Standardized methods for persisting agent state.

## Error Codes & Responses

ZilMate uses standard JavaScript errors. CLI errors are formatted for readability via `src/cli/format.ts`.
-   **401 Unauthorized**: Missing AI Gateway or integration keys.
-   **408 Timeout**: Agent step limit or model timeout reached.
-   **422 Unprocessable**: Invalid tool parameters or schema mismatch.
