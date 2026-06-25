# Deployment

ZilMate can be deployed as a local CLI tool or as a server-side SDK.

## Local Deployment (CLI)

The most common way to use ZilMate is locally.

1.  **Environment**: Ensure Node.js 18+ is installed.
2.  **Installation**: Clone the repo and run `npm install && npm run build`.
3.  **Persistence**: Data is stored in `~/Downloads/ZilMate/.zilo-manager/` by default.
4.  **Worker**: To run background jobs, keep a terminal open with `zilmate jobs worker`.

## Cloud Deployment (SDK / Webhook Server)

ZilMate can be deployed to cloud platforms (Vercel, AWS, Fly.io) to act as an automation backend.

### Requirements
-   **Redis**: Upstash Redis is recommended for distributed memory and job persistence.
-   **QStash**: Required for reliable webhook delivery and scheduling.

### Setup
1.  **Environment Variables**: Set all required `AI_GATEWAY`, `UPSTASH`, and `ZILMATE` keys in your cloud provider's dashboard.
2.  **SDK Integration**:
    ```ts
    import { createZilMate } from 'zilmate/server';
    const zilmate = createZilMate();
    // Use zilmate instance in your API routes
    ```
3.  **Webhook Endpoint**: Expose a POST route that calls `zilmate.handleJobWebhook`.

### Build & Runtime
-   **Build Command**: `npm run build` (runs `tsc`).
-   **Runtime**: `node dist/index.js` or your application entrypoint.

## Infrastructure Considerations

-   **Memory**: ZilMate is relatively low-memory, but high-step agent runs can consume more resources.
-   **Compute**: Model calls are external, so the primary compute load is agent orchestration and tool execution (especially shell or browser tools).
-   **Storage**: Ensure the process has write access to the workspace directory if not using Redis.

## Rollback & Updates

-   **Updates**: Run `git pull && npm install && npm run build`.
-   **Rollback**: Standard git checkout to the previous stable commit.
-   **Migrations**: ZilMate uses JSON/Redis for storage; schema changes are typically handled with graceful fallbacks in the code.
