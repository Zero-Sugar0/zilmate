# Data Model

ZilMate's persistence layer is designed to be lightweight and portable, supporting both local filesystem and cloud-based Redis storage.

## Core Entities

### Long-Term Memory (`LongTermMemory`)
Durable facts and preferences about the user or projects.
-   `id`: UUID.
-   `text`: The content of the memory.
-   `tags`: Array of strings for categorization.
-   `createdAt`: ISO timestamp.

### ZilMate Job (`ZilMateJob`)
Represents a background task or scheduled operation.
-   `id`: UUID.
-   `task`: The prompt to be executed.
-   `status`: `queued` | `running` | `succeeded` | `failed` | `cancelled`.
-   `schedule`: (Optional) Cron or relative schedule.
-   `attempts`: Number of times the job has run.
-   `maxAttempts`: Max retries.
-   `result`: Final output text.
-   `error`: Error message if failed.
-   `runAt`: Next scheduled run time.

### Job Log (`JobLog`)
Audit trail for job execution.
-   `id`: UUID.
-   `jobId`: Reference to the job.
-   `level`: `info` | `progress` | `result` | `error`.
-   `message`: Log message.
-   `data`: Structured JSON payload.

## Persistence Backends

### Local Store (`src/memory/local-store.ts`)
Stores data as JSON files in the `.zilo-manager/` directory within the workspace.
-   `jobs.json`: List of all background jobs.
-   `job-logs.json`: Logs keyed by job ID.
-   `memory.json`: Long-term memories.

### Redis Store (`src/memory/redis.ts`)
Used when `UPSTASH_REDIS_REST_URL` is configured. Provides a distributed store for multi-instance deployments.
-   Keys use the prefix `zilo-manager:`.

## Workspace Data

-   **Notebook**: `notebook.md` - Free-form markdown for project context.
-   **Knowledge Graph**: `knowledge-graph.json` - Relationships between entities (people, goals, projects).
-   **Scratchpad**: `scratch/*.json` - Temporary state for active runs.

## Lifecycle Fields

Most entities include:
-   `createdAt`: When the record was first created.
-   `updatedAt`: When the record was last modified.
