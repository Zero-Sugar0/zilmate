# Observability & Debugging

ZilMate provides several tools for monitoring execution and diagnosing issues.

## Logging

-   **CLI Progress**: Real-time status updates are printed to the terminal using the `ProgressEvent` system.
-   **Job Logs**: Every background job records its steps, results, and errors.
    -   View logs via CLI: `zilmate jobs logs <id>`.
    -   File location: `.zilo-manager/job-logs.json`.
-   **Usage Tracking**: Token usage and cost estimations are tracked per session in `src/observability/usage.ts`.

## Health Diagnostics

The `doctor` command is the first step for troubleshooting:
```bash
zilmate doctor
```
It checks:
-   Environment variables.
-   Local setup (workspace, Node version).
-   Critical dependencies (ffmpeg, playwright).
-   Connectivity to AI Gateway and external integrations.

## Debugging Common Issues

### "Missing AI Gateway auth"
-   **Cause**: `AI_GATEWAY_API_KEY` is missing from `.env`.
-   **Fix**: Run `zilmate setup` or manually add the key.

### Tool Loop Timeouts
-   **Cause**: Agent is stuck in a loop or the task is too complex.
-   **Fix**: Increase `ZILMATE_MAX_STEPS` in `.env` or break the task into smaller sub-tasks.

### Integration Failures (Composio)
-   **Cause**: Expired connection or invalid toolkit name.
-   **Fix**: Run `zilmate apps status` to check connection state. Ask the agent to "reconnect [app]".

### Job Worker Not Picking Up Jobs
-   **Cause**: Worker not running or `runAt` time is in the future.
-   **Fix**: Ensure `zilmate jobs worker` is active. Check job status with `zilmate jobs status <id>`.

## Operational Commands

-   **`zilmate config`**: View active configuration (secrets redacted).
-   **`zilmate memory list`**: Inspect saved durable memories.
-   **`zilmate apps status`**: Check external application connectivity.

## Tracing (Advanced)

For deep inspection of agent reasoning:
1.  Check the `scratch/` folder in the workspace for intermediate notes.
2.  Enable verbose logging (if implemented) or inspect the raw tool call responses in the `ToolLoopAgent` execution logs.
