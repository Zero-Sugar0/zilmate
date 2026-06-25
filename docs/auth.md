# Authentication

ZilMate manages authentication for several layers: the core AI services, internal state, and external business applications.

## Core AI Services Auth

-   **AI Gateway**: Authenticated via `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN`. This key is required for all model calls.
-   **Tavily**: Authenticated via `TAVILY_API_KEY` for web search.

## External App Auth (Composio)

ZilMate does not handle OAuth credentials directly. Instead, it delegates this to **Composio**.

1.  **Toolkit Auth**: When an agent attempts to use a tool (e.g., Google Calendar) that requires auth, the Composio SDK checks for an existing connection for the `ZILMATE_USER_ID`.
2.  **Connection Links**: If no connection exists, ZilMate prints a secure connection URL in the terminal for the user to complete the OAuth flow.
3.  **Token Storage**: Tokens are securely stored by Composio, not in the local ZilMate environment.

## Job & Webhook Security

-   **QStash Auth**: Authenticated via `UPSTASH_QSTASH_TOKEN`.
-   **Webhook Secrets**: The `ZILMATE_JOB_WEBHOOK_SECRET` is used to verify that incoming job requests are legitimate.
-   **Verification**: The `handleJobWebhook` method in `src/server.ts` compares the `secret` header against the environment variable.

## Local Persistence & Workspace

-   **Workspace Security**: Access to the local workspace is restricted by the OS user permissions.
-   **No Secrets in Memory**: Agents are instructed **not** to save secrets, API keys, or tokens into long-term memory or notebooks.

## Authorization (RBAC & Approvals)

ZilMate implements a safety-first authorization model:
-   **Read-Only**: Tools that only read data (search, file read, listing) are typically pre-authorized.
-   **Write Actions**: Actions that modify state (file write, shell execution, external app create/update/delete) require manual approval.
-   **Approval Scoping**: Approvals can be granted for a single action (`y`) or for the entire session (`s`).
-   **Confirmation Handler**: In the SDK, the `confirm` callback allows developers to implement custom approval logic (e.g., Slack buttons or UI toggles).

## Files Involved
-   `src/config/env.ts`: Centralized check for required auth keys.
-   `src/runtime/confirm.ts`: Core approval logic.
-   `src/tools/composio.tool.ts`: Integration with Composio auth.
