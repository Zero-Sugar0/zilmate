# Configuration & Environment

ZilMate is configured primarily through environment variables and a local setup command.

## Environment Variables

All variables are managed in `src/config/env.ts`.

### Core Auth
| Variable | Required | Purpose |
| :--- | :---: | :--- |
| `AI_GATEWAY_API_KEY` | Yes | API key for the AI provider gateway. |
| `AI_GATEWAY_URL` | No | Custom endpoint for the AI gateway. |
| `TAVILY_API_KEY` | No | Required for web research tools. |
| `COMPOSIO_API_KEY` | No | Required for external app integrations. |

### Persistence (Redis)
| Variable | Required | Purpose |
| :--- | :---: | :--- |
| `UPSTASH_REDIS_REST_URL` | No | REST URL for Upstash Redis. |
| `UPSTASH_REDIS_REST_TOKEN` | No | Auth token for Upstash Redis. |

### Jobs & Webhooks
| Variable | Required | Purpose |
| :--- | :---: | :--- |
| `UPSTASH_QSTASH_TOKEN` | No | Required for remote job scheduling. |
| `ZILMATE_PUBLIC_JOB_WEBHOOK_URL`| No | Public URL for receiving job triggers. |
| `ZILMATE_JOB_WEBHOOK_SECRET` | No | Shared secret for verifying webhook requests. |

### Model Overrides
| Variable | Required | Purpose |
| :--- | :---: | :--- |
| `ZILO_MANAGER_MODEL` | No | Override default manager model. |
| `ZILO_HELP_MODEL` | No | Override default help model. |
| `ZILO_POST_MODEL` | No | Override default post model. |
| `ZILO_CODING_MODEL` | No | Override default coding model. |

### System & Safety
| Variable | Required | Purpose |
| :--- | :---: | :--- |
| `ZILMATE_WORKSPACE` | No | Custom path for the ZilMate workspace. |
| `ZILMATE_TRUST_LEVEL` | No | Set `high` to reduce confirmation prompts. |
| `ZILMATE_MAX_STEPS` | No | Global override for agent step limits. |

## Model Selection (`src/config/models.ts`)

ZilMate maps internal roles to specific models:
-   **Strategy**: `deptStrategy` (Default: MiniMax M3)
-   **Engineering**: `deptEngineering` (Default: MiniMax M3)
-   **Growth**: `deptGrowth` (Default: MiniMax M3)
-   **Coding**: `coding` (Default: MiniMax M3)
-   **Vision**: `screenshotVisionModel` (Default: Gemini 3.1 Flash Lite)

## Setup Command

Use the interactive setup for easy configuration:
```bash
./index.js setup
```
This command:
1.  Validates existing keys.
2.  Prompts for missing required/optional keys.
3.  Writes settings to the local `.env` file.
4.  Initializes the workspace.

## Feature Flags

-   `ZILMATE_TRIGGER_WORKFLOWS_ENABLED`: Enable automatic job creation from Composio triggers.
-   `ZILMATE_VOICE_ENABLED`: Enable real-time voice interaction.
