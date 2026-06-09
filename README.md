# ZilMate

ZilMate is the CLI-first multi-agent assistant for ZiloShift workflows. It can chat, answer support questions, draft posts, research docs/web sources, and generate image assets while delegating work to specialized subagents.

The GitHub project can remain `zilo-manager`, but the installable npm package and command are `@zilo/zilmate` and `zilmate`.

## Install ZilMate

### Published npm package

After the package is published to npm:

```powershell
npm install -g @zilo/zilmate
zilmate --help
```

### GitHub/private install

Before npm publishing, install directly from the GitHub repo:

```powershell
npm install -g github:zester4/zilo-manager
zilmate --help
```

### Windows installer helper

From PowerShell, the helper can install from GitHub by default:

```powershell
iwr https://raw.githubusercontent.com/zester4/zilo-manager/main/install.ps1 | iex
```

To install from npm after publishing:

```powershell
iex "& { $((iwr -UseBasicParsing https://raw.githubusercontent.com/zester4/zilo-manager/main/install.ps1).Content) } -Source npm"
```

The helper only checks for Node/npm, runs `npm install -g`, and prints `zilmate --help`.

## Setup

1. Install dependencies:

```powershell
npm install
```

2. Create `.env` from `.env.example`:

```env
AI_GATEWAY_API_KEY=your_vercel_ai_gateway_key
TAVILY_API_KEY=your_tavily_key
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
ZILO_MANAGER_MODEL=minimax/minimax-m3
ZILO_HELP_MODEL=alibaba/qwen3.7-plus
ZILO_POST_MODEL=alibaba/qwen3.7-plus
ZILO_IMAGE_DEFAULT_PROVIDER=openai
ZILO_IMAGE_OPENAI_MODEL=openai/gpt-image-2
ZILO_IMAGE_GEMINI_MODEL=google/gemini-3-pro-image
ZILO_IMAGE_MODEL=
```

Redis is optional. If `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, chat turns and scratchpads use Redis. If they are missing, ZilMate falls back to local files under `.zilo-manager/`.

## Development Commands

Use these while working inside the project folder:

```powershell
npm run build
npm run zilmate -- --help
npm run zilmate -- models
npm run zilmate -- talk
npm run zilmate -- talk --session launch
npm run zilmate -- help "why can't a worker apply?"
npm run zilmate -- post "WhatsApp status for workers in Accra"
npm run zilmate -- research "Vercel AI SDK ToolLoopAgent"
npm run zilmate -- image --model openai --size 1024x1024 "ZiloShift launch poster for Ghana workers"
npm run zilmate -- image --model gemini "ZiloShift launch poster for Ghana workers"
npm run zilmate -- manager "Create a plan for helping venues post shifts"
```

Shortcut:

```powershell
npm run talk
```

## Global CLI

For local development, link the command from this folder:

```powershell
npm run build
npm link
```

Then use ZilMate directly:

```powershell
zilmate --help
zilmate talk
zilmate ping
zilmate models
zilmate help "worker cannot see shifts"
zilmate image --model openai --size 1024x1024 "ZiloShift launch poster"
```

## Command Shape

- `talk`: persistent interactive chat with the main manager agent. This is the best mode for normal use and renders rich terminal Markdown.
- `manager`: one-shot manager orchestration. It can delegate to subagents and use scratchpad tools.
- `help`: fast troubleshooting and app guidance.
- `chat`: one-shot natural dialogue about ZiloShift workflows.
- `post`: WhatsApp/status/social copy generation.
- `research`: local docs, allowlisted docs, Tavily search/extract/map/crawl/deep research, and sourced summaries.
- `image`: Gateway image generation that saves files under `outputs/images/`. Use `--model openai|chatgpt|gemini` and optionally `--size 1024x1024` for OpenAI.
- `models`: selected models, Gateway availability warnings, and active memory backend.
- `ping`: tiny Gateway text call to verify auth.

## Agent Architecture

ZilMate uses a manager agent that delegates to focused subagents:

- Quick Help: short troubleshooting and app usage guidance.
- Chat: broader ZiloShift workflow conversation.
- Post: launch messages, WhatsApp statuses, captions, and outreach copy.
- Research: local Zilo docs first, then external docs/web research when needed.
- Image: image generation through Gateway image models.

Local ZiloShift docs live under `src/doc/`. ZilMate reads them on demand through dedicated tools instead of dumping all docs into every prompt.

## Model Notes

- Manager/orchestration default: `minimax/minimax-m3`.
- Recommended help/post override: `alibaba/qwen3.7-plus` in `.env`.
- If help/post env vars are blank, ZilMate falls back to the internal cheap-model list in `src/config/models.ts`.
- Default image provider: OpenAI GPT Image 2 via `openai/gpt-image-2` and AI SDK `generateImage`.
- Alternate image provider: Gemini 3 Pro Image via `google/gemini-3-pro-image` and `generateText` file outputs.
- GPT-2 is not used for images.

## Research And Memory

- Zilo docs are searched/read locally first for product behavior.
- Tavily powers web search, URL extraction, site mapping, small capped crawls, and deep research.
- Web crawling and deep research are intentionally heavier tools and should be used only when local docs/search are not enough.
- Scratchpads keep intermediate notes outside the main prompt context.
- Redis is optional; local file memory is the fallback.

## Safety Notes

ZilMate is currently designed as a read-only assistant/scaffold. It can guide, research, draft, and generate assets, but it should not mutate production systems or claim that it changed live ZiloShift data.

Before adding real actions around payments, identity, SMS, users, or admin operations, add stronger permission levels, confirmation gates, audit logs, and behavioral evals.