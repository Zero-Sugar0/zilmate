# Zilo Manager

CLI-first multi-agent manager for ZiloShift.

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
ZILO_HELP_MODEL=openai/gpt-5.4-mini
ZILO_POST_MODEL=openai/gpt-5.4-mini
ZILO_IMAGE_DEFAULT_PROVIDER=openai
ZILO_IMAGE_OPENAI_MODEL=openai/gpt-image-2
ZILO_IMAGE_GEMINI_MODEL=google/gemini-3-pro-image
ZILO_IMAGE_MODEL=
```

Redis is optional. If `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, chat turns and scratchpads use Redis. If they are missing, the CLI falls back to local files under `.zilo-manager/`.

## Commands

```powershell
npm run build
npm run cli -- models
npm run cli -- talk
npm run cli -- talk --session launch
npm run cli -- help "why can't a worker apply?"
npm run cli -- post "WhatsApp status for workers in Accra"
npm run cli -- research "Vercel AI SDK ToolLoopAgent"
npm run cli -- image --model openai --size 1024x1024 "ZiloShift launch poster for Ghana workers"
npm run cli -- image --model gemini "ZiloShift launch poster for Ghana workers"
npm run cli -- manager "Create a plan for helping venues post shifts"
```

## Command Shape

- `talk`: persistent interactive chat with the main manager agent. This is the best mode for normal use and renders rich terminal Markdown.
- `manager`: one-shot manager orchestration. It can delegate to subagents and use scratchpad tools.
- `help`, `chat`, `post`, `research`: direct one-shot subagent commands.
- `image`: Gateway image generation that saves files under `outputs/images/`. Use `--model openai|chatgpt|gemini` and optionally `--size 1024x1024` for OpenAI.
- `models`: shows selected models, model availability warnings, and the active memory backend.

## Notes

- Renders agent Markdown with terminal styling for H1/H2/H3 headings, clean bullets, links, emphasis, and code blocks.
- Shows live progress events when the manager thinks, delegates to subagents, searches docs/web, fetches sources, generates assets, or completes a response.
- Uses Vercel AI SDK v6 `ToolLoopAgent` patterns.
- Uses Vercel AI Gateway model strings.
- Uses MiniMax M3 as the manager/orchestration model by default.
- Uses `openai/gpt-5.4-mini` for cheap help/post generation by default.
- Uses OpenAI GPT Image 2 via `openai/gpt-image-2` with AI SDK `generateImage` for the default image path.
- Keeps Gemini 3 Pro Image via `google/gemini-3-pro-image` with `generateText` and `result.files` as an alternate image path.
- Does not use GPT-2 for images.
- Tavily powers broad web research; docs fetch is allowlisted and cached locally.
