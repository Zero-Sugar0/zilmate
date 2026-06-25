# Execution Lifecycle

Understanding the lifecycle of a request in ZilMate is crucial for debugging and extending the system.

## Lifecycle of a Manager Run

A "run" occurs whenever the Manager agent is invoked (via `zilmate talk`, `zilmate manager`, or the SDK).

1.  **Initialization**:
    -   Generate a unique `runId`.
    -   Apply stored model selections.
    -   Initialize subagent factories (Coding, Research, etc.).
    -   Load internal and Composio tools.
2.  **Context Building**:
    -   Fetch relevant long-term memories based on the prompt.
    -   Load personal context and situational awareness (CWD, Git status, workspace info).
    -   Append system prompts from the `SystemPromptBuilder`.
3.  **The Tool Loop**:
    -   **Step N**: The model generates a response (text or tool calls).
    -   **Tool Call**: If tool calls are present, ZilMate:
        -   Checks for required confirmations.
        -   Executes the tool logic.
        -   Captures the result.
    -   **Feedback**: The result is appended to the message history.
    -   **Loop**: Repeat until the model provides a final text response or hits the `limits.managerSteps`.
4.  **Completion**:
    -   Track final token usage.
    -   Emit a `done` progress event.
    -   Return the text to the caller.

## Lifecycle of a Background Job

1.  **Creation**: Job is instantiated and saved with `queued` status.
2.  **Pickup**: The `JobWorker` identifies a job whose `runAt` is in the past.
3.  **Transition to Running**: Status set to `running`, `attempts` incremented.
4.  **Execution**: The `JobRunner` starts a Manager run for the job task.
5.  **Finalization**:
    -   **Success**: Status set to `succeeded`. `result` saved.
    -   **Failure**: Status set to `failed` (if max retries hit) or `queued` (for retry). `error` saved.
    -   **Reschedule**: If recurring, calculate `nextRunAt` and set status to `queued`.

## State Transitions

| From | To | Trigger |
| :--- | :--- | :--- |
| `null` | `queued` | Job Creation |
| `queued` | `running` | Worker Start |
| `running` | `succeeded` | Successful Manager Run |
| `running` | `queued` | Retryable Failure |
| `running` | `failed` | Terminal Failure |
| `queued` | `cancelled` | User Cancel Command |

## Interruptions & Cancellations

-   **Abort Signals**: Abort signals are propagated through the agent and tool execution layers.
-   **Timeouts**: If a job exceeds the internal execution limits, it is marked as failed.
-   **Graceful Shutdown**: The CLI listener for `SIGINT` (Ctrl+C) attempts to stop active tool calls before exiting.
