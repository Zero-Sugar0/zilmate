# ZilMate

ZilMate is a CLI-first general assistant with deep built-in ZiloShift expertise. It can chat, answer support questions, draft posts, research docs/web sources, generate image assets, and use Composio for external app tools such as GitHub, Gmail, Slack, Notion, Stripe, and Supabase.

ZilMate can also work with local files inside safe configured roots: search files/folders, read text files, write approved files, create folders, move/copy/rename, summarize documents, compare folder snapshots for changes, and find duplicate or large files. Sensitive files such as `.env`, keys, credentials, and token-looking paths are blocked.

It can also use approved desktop context: read/write clipboard text, take screenshots, open the laptop camera for a still photo, and analyze screenshots/photos with `google/gemini-3.1-flash-lite` by default. Screenshot analysis describes visible UI, extracts visible text when possible, identifies errors or unusual states, and can optionally search the web for troubleshooting context. Camera photo analysis describes visible objects, environments, documents, devices, or issues without identifying people or inferring sensitive traits.

The GitHub project can remain `zilo-manager`, but the installable npm package and command are both `zilmate`.

## Install ZilMate

### Published npm package

After the package is published to npm:

```powershell
npm install -g zilmate
zilmate setup
zilmate --help
```

Running `zilmate` with no arguments opens the status dashboard and then the guided launcher menu. If the AI Gateway key is missing, the launcher offers setup before starting chat.

When a new CLI/SDK release is published, users can update without remembering npm commands:

```powershell
zilmate update
zilmate version
```

### GitHub/private install

Before npm publishing, install directly from the GitHub repo:

```powershell
npm install -g github:zester4/zilo-manager
zilmate setup
zilmate --help
```

### Windows installer helper

From PowerShell, the helper can install from GitHub by default:

```powershell
iwr https://raw.githubusercontent.com/zester4/zilo-manager/main/install.ps1 | iex
```

The installer runs the full first-use flow:

1. Installs ZilMate globally.
2. Runs `zilmate setup` to collect `AI_GATEWAY_API_KEY`.
3. Lets users skip optional Composio, Tavily, Redis, background jobs, QStash, and trigger workflows.
4. Runs `zilmate ping` to verify the key.
5. Starts `zilmate talk`.

To install without setup:

```powershell
iex "& { $((iwr -UseBasicParsing https://raw.githubusercontent.com/zester4/zilo-manager/main/install.ps1).Content) } -NoSetup"
```

To skip ping or chat startup:

```powershell
iex "& { $((iwr -UseBasicParsing https://raw.githubusercontent.com/zester4/zilo-manager/main/install.ps1).Content) } -NoPing -NoTalk"
```

To install from npm after publishing:

```powershell
iex "& { $((iwr -UseBasicParsing https://raw.githubusercontent.com/zester4/zilo-manager/main/install.ps1).Content) } -Source npm"
```

The helper checks for Node/npm, runs `npm install -g`, prints `zilmate --help`, starts setup unless `-NoSetup` is passed, verifies auth unless `-NoPing` is passed, and starts chat unless `-NoTalk` is passed.

## Setup

1. Install dependencies:

```powershell
npm install
```

2. Create `.env` from `.env.example`:

The easiest path is:

```powershell
zilmate setup
```

Before asking for secrets, setup shows what to have ready:

- Required: AI Gateway key.
- Optional app tools: Composio key.
- Optional web research: Tavily key.
- Optional cloud memory/jobs: Upstash Redis URL and token.
- Optional hosted schedules: QStash token and public webhook URL.
- Optional realtime voice: Deepgram key.
- Optional camera capture: `ffmpeg` installed on PATH.

Then it asks for `AI_GATEWAY_API_KEY` and guides users through optional features:

- Composio external app tools.
- Tavily web research.
- Upstash Redis memory/job storage.
- Local background jobs and schedules.
- Upstash QStash hosted schedules.
- Composio trigger-to-job workflows.
- Deepgram realtime voice mode.
- Local file tool roots.
- Screenshot/photo vision model.
- Camera dependency and device setup.

Every optional feature can be skipped. If users only want chat, they only need the AI Gateway key.

Voice can be managed without opening `.env`:

```powershell
zilmate voice setup
zilmate voice enable
zilmate voice disable
zilmate voice doctor
zilmate voice devices
zilmate voice live
```

Inside `zilmate talk`, use `/voice` to start a live terminal voice session. Speak naturally, then press Enter to stop voice and return to typed chat:

```text
/voice
```

You can also create `.env` manually:

```env
AI_GATEWAY_API_KEY=your_vercel_ai_gateway_key
COMPOSIO_API_KEY=your_composio_key
ZILMATE_USER_ID=zilmate-generated-local-user-id
TAVILY_API_KEY=your_tavily_key
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
ZILMATE_JOBS_ENABLED=false
UPSTASH_QSTASH_TOKEN=
ZILMATE_PUBLIC_JOB_WEBHOOK_URL=
ZILMATE_JOB_WEBHOOK_SECRET=
ZILMATE_TRIGGER_WORKFLOWS_ENABLED=false
DEEPGRAM_API_KEY=
ZILMATE_VOICE_ENABLED=false
ZILMATE_VOICE_MODE=agent
ZILMATE_VOICE_LISTEN_MODEL=flux-general-en
ZILMATE_VOICE_LISTEN_VERSION=v2
ZILMATE_VOICE_TTS_MODEL=aura-2-thalia-en
ZILMATE_VOICE_LANGUAGE=en
ZILMATE_VOICE_LANGUAGE_HINTS=
ZILMATE_VOICE_BARGE_IN=true
ZILMATE_VOICE_INPUT_DEVICE=
ZILMATE_SCREENSHOT_MODEL=google/gemini-3.1-flash-lite
ZILMATE_CAMERA_DEVICE=
ZILMATE_FILE_ROOTS=
ZILO_MANAGER_MODEL=minimax/minimax-m3
ZILO_HELP_MODEL=alibaba/qwen3.7-plus
ZILO_POST_MODEL=alibaba/qwen3.7-plus
ZILO_IMAGE_DEFAULT_PROVIDER=openai
ZILO_IMAGE_OPENAI_MODEL=openai/gpt-image-2
ZILO_IMAGE_GEMINI_MODEL=google/gemini-3-pro-image
ZILO_IMAGE_MODEL=
```

Composio is optional. If `COMPOSIO_API_KEY` is set, ZilMate creates a stable local `ZILMATE_USER_ID`, reuses Composio sessions per chat session, and lets Composio manage app auth links and connected accounts.

Redis is optional. If `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, chat turns, scratchpads, and Composio session ids use Redis. If they are missing, ZilMate falls back to local files under `.zilo-manager/`.

Background jobs are optional. Setup explains the difference between local jobs and hosted schedules. Local jobs and local schedules run while `zilmate jobs worker` is running. They do not keep running after a laptop sleeps, shuts down, or loses internet. For hosted schedules that can fire while the local machine is closed, configure QStash plus a public job webhook URL.

Realtime voice is optional. If `DEEPGRAM_API_KEY` and `ZILMATE_VOICE_ENABLED=true` are set, ZilMate uses Deepgram Flux for listening/end-of-turn, routes transcripts through the ZilMate manager/tools/subagents, and speaks replies with Deepgram Aura-2 websocket TTS. The default listen model is `flux-general-en` with `v2`. The default spoken voice is `aura-2-thalia-en`. Terminal live voice uses `ffmpeg` for microphone capture and `ffplay` for spoken replies. If the default microphone is not detected, run `zilmate voice devices`, then set `ZILMATE_VOICE_INPUT_DEVICE`.

Use `zilmate voice setup` for a focused voice-only wizard. Use `zilmate voice enable` and `zilmate voice disable` to toggle voice later without editing config files.

Camera capture is optional. During `zilmate setup`, ZilMate checks for `ffmpeg`, asks before installing it, and then runs a camera readiness check. If the automatic installer is not available, setup keeps going and tells the user to run `zilmate camera doctor`.

Local file tools are optional. During setup, users can keep the default current-folder access or add comma-separated roots through `ZILMATE_FILE_ROOTS`.

For unattended setup or installers, pass the options directly:

```powershell
zilmate setup --yes --ai-gateway-key <key> --jobs-enabled true
zilmate setup --yes --ai-gateway-key <key> --composio-key <key> --trigger-workflows-enabled true
zilmate setup --yes --ai-gateway-key <key> --qstash-token <token> --job-webhook-url https://example.com/api/zilmate/jobs
zilmate setup --yes --ai-gateway-key <key> --voice-enabled true --deepgram-key <key>
zilmate setup --yes --ai-gateway-key <key> --voice-input-device "audio=Microphone Array"
zilmate setup --yes --ai-gateway-key <key> --install-camera-deps true
zilmate setup --yes --ai-gateway-key <key> --camera-device "video=Integrated Camera"
zilmate setup --yes --ai-gateway-key <key> --file-roots "C:\Users\me\Documents,C:\work"
zilmate setup --yes --ai-gateway-key <key> --screenshot-model google/gemini-3.1-flash-lite
```

## Development Commands

Use these while working inside the project folder:

```powershell
npm run build
npm run zilmate -- --help
npm run zilmate -- setup
npm run zilmate -- doctor
npm run zilmate -- config
npm run zilmate -- models
npm run zilmate -- apps status
npm run zilmate -- triggers listen
npm run zilmate -- triggers types github
npm run zilmate -- triggers list
npm run zilmate -- jobs create "Research today's priority updates and summarize them"
npm run zilmate -- jobs list
npm run zilmate -- jobs worker --once
npm run zilmate -- voice doctor
npm run zilmate -- voice setup
npm run zilmate -- voice disable
npm run zilmate -- voice enable
npm run zilmate -- voice turn "What should I focus on today?"
npm run zilmate -- remember "Prefers concise support replies"
npm run zilmate -- recall support
npm run zilmate -- memory list
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
npm run doctor
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
zilmate setup
zilmate doctor
zilmate update
zilmate version
zilmate env check
zilmate config
zilmate talk
zilmate ping
zilmate models
zilmate apps status
zilmate triggers listen
zilmate triggers types github
zilmate triggers create GITHUB_BRANCH_CREATED_TRIGGER --dry-run --owner zester4 --repo zilo-manager
zilmate triggers create GITHUB_COMMIT_EVENT --owner zester4 --repo zilo-manager
zilmate triggers list
zilmate jobs create "Research today's priority updates and summarize them"
zilmate jobs create "Prepare my weekday morning briefing" --schedule "daily"
zilmate jobs list
zilmate jobs status job_xxx
zilmate jobs logs job_xxx
zilmate jobs run job_xxx
zilmate jobs worker
zilmate jobs cancel job_xxx
zilmate voice doctor
zilmate voice config
zilmate voice setup
zilmate voice disable
zilmate voice enable
zilmate voice turn "Plan my next two hours"
zilmate voice devices
zilmate voice live
zilmate voice agent-probe
zilmate camera doctor
zilmate camera list
zilmate camera capture
zilmate camera capture --device "video=Integrated Camera"
zilmate remember "Use a warm but concise support tone"
zilmate recall support
zilmate memory list
zilmate help "worker cannot see shifts"
zilmate image --model openai --size 1024x1024 "ZiloShift launch poster"
```

## Server SDK

ZilMate can also be used as a server-side SDK inside apps, dashboards, API routes, and background jobs. The SDK is server-only because it uses API keys, local/Redis memory, Tavily, Composio, and AI Gateway credentials.

```ts
import { createZilMate } from 'zilmate/server';

const zilmate = createZilMate({
  sessionId: 'support-ticket-123',
});

const result = await zilmate.chat({
  message: 'Plan my day, then help me draft a ZiloShift worker update.',
});

console.log(result.text);
```

In Next.js, call ZilMate from an API route or server action, then connect your UI to that endpoint:

```ts
// app/api/zilmate/route.ts
import { createZilMate } from 'zilmate/server';

export async function POST(req: Request) {
  const { message, sessionId } = await req.json();
  const zilmate = createZilMate({ sessionId });
  const result = await zilmate.chat({ message });

  return Response.json(result);
}
```

Available SDK methods:

- `chat({ message })`: general personal assistant backed by the manager agent.
- `manager({ message | prompt })`: explicit manager orchestration.
- `help({ question | message })`: fast ZiloShift troubleshooting.
- `guide({ message })`: ZiloShift workflow conversation.
- `post({ prompt })`: WhatsApp/status/social copy.
- `research({ query | message })`: local docs and web research.
- `image({ prompt, provider, size, outputDir })`: image generation.
- `remember({ text, tags })`, `recall({ query, limit })`, `listMemories()`, `forget(id)`, `clearMemories()`: durable memory helpers.
- `createJob({ task, schedule, source, metadata })`, `listJobs({ status, limit })`, `getJob(id)`, `getJobLogs(id)`, `runJob(id)`, `runDueJobs()`, `handleJobWebhook({ jobId, secret }, expectedSecret)`, `cancelJob(id)`: background job and hosted webhook helpers.
- `getVoiceConfig()`, `startVoiceSession({ audio, onEvent, sessionId })`: Deepgram realtime voice configuration and Agent API session helpers.

For UI integrations, pass `onProgress` to render agent/tool progress and `confirm` to approve or block external write-like Composio actions.

## Command Shape

- `talk`: persistent interactive chat with the main manager agent. This is the best mode for normal use and renders rich terminal Markdown.
- `manager`: one-shot manager orchestration. It can delegate to subagents and use scratchpad tools.
- `doctor`: check local setup, required/optional keys, Node version, memory folder, Redis completeness, and optional live Gateway/Composio status with `--live`.
- `env check`: environment-readiness alias for `doctor`.
- `config`: sanitized config summary without secrets.
- `remember`: save durable long-term memory.
- `recall`: search durable long-term memory.
- `forget`: delete one memory by id, or use `--all`.
- `memory list`: list saved durable memories.
- `apps status`: show whether Composio is configured, the local `ZILMATE_USER_ID`, the current Composio session id, and connected/available toolkit status when the SDK can fetch it.
- `triggers listen`: stream Composio trigger events into the terminal until Ctrl+C.
- `triggers types [toolkit]`: list available trigger types, optionally for one toolkit.
- `triggers info <trigger>`: show trigger config and payload schemas.
- `triggers create <trigger> --flag value`: create a trigger instance; unknown flags become trigger config.
- `triggers list`: list trigger instances.
- `jobs create "<task>"`: queue a background job, optionally with `--schedule "daily"` or `--schedule "every 15 minutes"`.
- `jobs list`: list queued/running/completed jobs.
- `jobs status <id>`: inspect one job.
- `jobs logs <id>`: inspect job progress, output, and errors.
- `jobs run <id>`: run a queued job immediately.
- `jobs worker`: run the local job processor and local scheduler.
- `jobs cancel <id>`: cancel one job.
- `camera doctor`: check OS, ffmpeg availability, detected camera devices, and fallback candidates.
- `camera list`: list camera device names ZilMate can try.
- `camera capture`: capture one still image, with retry across common device names unless `--device` is provided.
- `help`: fast troubleshooting and app guidance.
- `chat`: one-shot natural dialogue about ZiloShift workflows.
- `post`: WhatsApp/status/social copy generation.
- `research`: local docs, allowlisted docs, Tavily search/extract/map/crawl/deep research, and sourced summaries.
- `image`: Gateway image generation that saves files under `outputs/images/`. Use `--model openai|chatgpt|gemini` and optionally `--size 1024x1024` for OpenAI.
- `models`: selected models, Gateway availability warnings, and active memory backend.
- `ping`: tiny Gateway text call to verify auth.
- `setup`: interactive `.env` setup for the required AI Gateway key, optional Composio external app tools, optional Tavily search, optional Redis memory, and model defaults.

## Agent Architecture

ZilMate uses a manager agent that delegates to focused subagents and external tools:

- Quick Help: short troubleshooting and app usage guidance.
- Chat: broader ZiloShift workflow conversation.
- Post: launch messages, WhatsApp statuses, captions, and outreach copy.
- Research: local Zilo docs first, then external docs/web research when needed.
- Image: image generation through Gateway image models.
- Automation Planner: background jobs, schedules, trigger workflows, QStash/webhook planning, monitoring, and follow-up automations.
- Personal Assistant: daily planning, reminders, briefings, prioritization, follow-ups, summaries, and memory-aware organization.
- Developer Helper: CLI/SDK usage, Next.js integration, publishing, QStash, Cloudflare tunnels, webhooks, Composio setup, and debugging.
- Composio: external app discovery, auth links, schemas, and execution, attached only to the manager.
- Memory: durable ZilMate facts and preferences saved locally or in Redis, available through CLI commands and manager tools.
- Jobs: background task creation, schedule setup, status checks, logs, and cancellation available through CLI, SDK, and manager tools.
- Files: local file search, safe reading, approved writes, folder creation, move/copy/rename, document summaries, folder-change snapshots, and duplicate/large-file audits.
- Desktop: approved clipboard access, screenshot capture, laptop camera still capture, and Gemini-powered screenshot/photo understanding. Ask naturally inside `zilmate talk`, such as "look at my screen and explain the error", "look through my camera and describe this device", "search this folder for billing docs", or "copy that command to my clipboard".

Camera capture requires `ffmpeg` on PATH. On Windows, install with `winget install Gyan.FFmpeg`; on macOS, use `brew install ffmpeg`; on Linux, install `ffmpeg` from your package manager. Run `zilmate camera doctor` to verify OS support and `zilmate camera list` to get exact device names. If Windows reports a custom camera name, set `ZILMATE_CAMERA_DEVICE=video=Your Camera Name` or pass `--device "video=Your Camera Name"`. Clipboard, screenshot, and camera access always ask for approval in agent mode, and can be approved for the current session with `s=session`.

Local ZiloShift docs live under `src/doc/`. ZilMate reads them on demand through dedicated tools instead of dumping all docs into every prompt. The manager prefers these local docs for ZiloShift support, worker, venue, payment, verification, SMS, and dispute questions.

## External Apps With Composio

Run setup and add a Composio key:

```powershell
zilmate setup
zilmate apps status
```

In `zilmate talk`, ask for the external task naturally. If an account is not connected yet, ZilMate uses Composio connection tools and prints the connect link returned by Composio. ZilMate does not implement custom OAuth flows.

Read/search/schema/auth-link tools can run without confirmation. Write-like external app actions such as create, update, delete, send, post, publish, invite, transfer, charge, refund, cancel, approve, revoke, workbench, or bash require `Proceed? (y/N)` in the terminal. In noninteractive mode, write-like actions are blocked.

## Trigger Events

For live terminal events, use Composio trigger listening:

```powershell
zilmate triggers types github
zilmate triggers create GITHUB_COMMIT_EVENT --owner zester4 --repo zilo-manager
zilmate triggers listen
```

`listen` streams matching trigger events until Ctrl+C. Use filters when needed:

```powershell
zilmate triggers listen --toolkit gmail
zilmate triggers listen --trigger ti_abc123
zilmate triggers listen --trigger-slug GMAIL_NEW_EMAIL_EVENT --once
```

This is terminal-local. When `ZILMATE_TRIGGER_WORKFLOWS_ENABLED=true`, trigger events handled by `zilmate triggers listen` also create background jobs. ZilMate includes generic workflow prompts for Gmail, GitHub, Slack, and calendar-style events, and falls back to a general external-app summary task for other toolkits.

The manager agent also has trigger tools. In `zilmate talk`, you can ask:

```text
show me GitHub trigger types
prepare a branch-created trigger for zester4/zilo-manager
create that trigger
```

ZilMate should discover current trigger slugs first, inspect the trigger schema, prefer a dry-run payload, and ask for confirmation before creating a real trigger.

## Background Jobs And Schedules

Use jobs when ZilMate should keep working after a chat turn ends:

```powershell
zilmate jobs create "Research AI assistant scheduling patterns and save a summary"
zilmate jobs create "Prepare my morning briefing" --schedule daily
zilmate jobs worker
```

Local job storage uses `.zilo-manager/jobs.json` and `.zilo-manager/job-logs.json` unless Redis is configured. With Redis, jobs and logs use the same Upstash REST connection as memory.

Schedules supported locally include `hourly`, `daily`, `every 15 minutes`, `every 2 hours`, `every 1 day`, and ISO date/time strings. QStash schedules can use `cron:<expression>` when `UPSTASH_QSTASH_TOKEN` and `ZILMATE_PUBLIC_JOB_WEBHOOK_URL` are configured.

Hosted apps can expose a webhook route and call:

```ts
import { createZilMate } from 'zilmate/server';

export async function POST(req: Request) {
  const body = await req.json();
  const zilmate = createZilMate();
  const result = await zilmate.handleJobWebhook(
    { jobId: body.jobId, secret: req.headers.get('ZilMate-Webhook-Secret') ?? undefined },
    process.env.ZILMATE_JOB_WEBHOOK_SECRET,
  );

  return Response.json(result);
}
```

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
- Long-term memory stores stable preferences and durable project facts. Use `zilmate remember`, `zilmate recall`, `zilmate forget`, and `zilmate memory list`.
- `zilmate talk` automatically recalls relevant long-term memories for each message.
- Redis is optional; local file memory is the fallback.
- `zilmate setup` creates or updates the local `.env` used by the CLI.

## Safety Notes

ZilMate can guide, research, draft, generate assets, and run approved external app actions through Composio. It should not claim that live external or ZiloShift data changed unless a tool result confirms it.

Before adding real actions around payments, identity, SMS, users, or admin operations, add stronger permission levels, confirmation gates, audit logs, and behavioral evals.
