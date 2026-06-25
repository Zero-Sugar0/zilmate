# Integrations

ZilMate integrates with several external services to provide intelligence, connectivity, and automation.

## Core Integrations

### AI Gateway (Portkey/Custom)
-   **Purpose**: Centralized access to LLMs (MiniMax, Gemini, Qwen, etc.).
-   **Config**: `AI_GATEWAY_API_KEY`, `AI_GATEWAY_URL`.
-   **Usage**: All agent text generation and image generation requests.

### Tavily
-   **Purpose**: High-quality web search and research.
-   **Config**: `TAVILY_API_KEY`.
-   **Usage**: Used by `web-search.tool.ts` and `docs-research.agent.ts`.

### Composio
-   **Purpose**: Connectivity to 100+ business applications (Slack, GitHub, HubSpot, Stripe, etc.).
-   **Config**: `COMPOSIO_API_KEY`, `ZILMATE_USER_ID`.
-   **Usage**: Enables swarm specialists and the manager to perform real-world actions in external apps.

### Upstash (Redis & QStash)
-   **Purpose**: Distributed memory and webhook-based job scheduling.
-   **Config**: `UPSTASH_REDIS_REST_URL`, `UPSTASH_QSTASH_TOKEN`.
-   **Usage**: Persistence for jobs, logs, and long-term memory; remote job triggers.

### Deepgram
-   **Purpose**: Real-time speech-to-text and text-to-speech.
-   **Config**: `DEEPGRAM_API_KEY`.
-   **Usage**: Powers the `zilmate voice` CLI command and SDK voice sessions.

## Business App Integrations (via Composio)

The following apps are commonly used by the Digital Corporation specialists:

-   **Stripe**: Revenue tracking and payment management.
-   **HubSpot / Salesforce**: CRM and lead management.
-   **GitHub**: Repository management, PRs, and issue tracking.
-   **Slack / Discord**: Community management and notifications.
-   **Gmail / Outlook**: Communication and outreach.
-   **Shopify**: E-commerce and logistics management.
-   **Notion / Google Docs**: Documentation and project tracking.

## Custom MCP Servers

ZilMate supports the Model Context Protocol (MCP) for extending capabilities with custom tool servers. MCP tools are integrated through the tool registry and available to agents based on configuration.

## Failure Handling

Integrations are designed with resilience:
-   **Network Retries**: Handled at the SDK level for most providers.
-   **Auth Errors**: Triggers a request to the user to reconnect or update configuration via `zilmate setup`.
-   **Rate Limits**: Reported back to the agent to allow for backoff or alternative strategies.
