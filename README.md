# <p align="center">🦊 ZilMate</p>

<p align="center">
  <img src="public/zilmate.png" alt="ZilMate Logo" width="180">
</p>

<p align="center">
  <b>Production-Grade Multi-Agent AI Swarm, Real-Time Voice Controller, and Webhook Job Scheduler</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.9.1-blue.svg?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/node-%3E%3D20.0.0-green.svg?style=flat-square" alt="Node Engine">
  <img src="https://img.shields.io/badge/platform-windows%20%7C%20macos%20%7C%20linux-lightgrey.svg?style=flat-square" alt="Platform Support">
  <img src="https://img.shields.io/badge/license-ISC-orange.svg?style=flat-square" alt="License">
</p>

---

ZilMate is a CLI-first general assistant with deep built-in ZiloShift expertise. It can chat, answer support questions, draft posts, research docs/web sources, generate image assets, and use Composio for external app tools such as GitHub, Gmail, Slack, Notion, Stripe, and Supabase.

ZilMate can also work with local files inside safe configured roots: search files/folders, read text files, write approved files, create folders, move/copy/rename, summarize documents, compare folder snapshots for changes, and find duplicate or large files. Sensitive files such as `.env`, keys, credentials, and token-looking paths are blocked.

It can also use approved desktop context: read/write clipboard text, take screenshots, open the laptop camera for a still photo, and analyze screenshots/photos with `google/gemini-3.1-flash-lite` by default. Screenshot analysis describes visible UI, extracts visible text when possible, identifies errors or unusual states, and can optionally search the web for troubleshooting context. Camera photo analysis describes visible objects, environments, documents, devices, or issues without identifying people or inferring sensitive traits.

The GitHub project and repository name is now `zilmate`, matching the installable npm package and command.

---

## 🚀 Key Features & Capabilities

- **Hierarchical Swarm Architecture** — Powered by a Manager Agent (CEO) that delegates to a Digital Corporation (COO), coordinating 30+ specialized subagents across 6 key business departments on a horizontal peer-to-peer messaging fabric. See the complete [SWARM.md](file:///c:/Users/mseyy/Downloads/zilo-manager/SWARM.md) blueprint.
- **Zero-Config Webhook Tunneling** — Automates background webhook listeners using **Upstash QStash**. Features a built-in automated **Cloudflare Tunnel** binary (`cloudflared`) downloader for platform-specific runtimes (`windows`, `macOS`, `linux`).
- **Interactive Safety Checklists** — Replaced basic text prompts with a premium interactive terminal UI (in TTY). Navigate via arrow keys and toggle checkboxes to filter and approve critical system and write-like app actions.
- **Bottom-Pinned Thinking Status Card** — High-feedback console loaders and elapsed timers remain perfectly pinned to the bottom of the console whileSpecialist logs scroll smoothly above them.
- **High-Fidelity Document Generation** — In-house layout engine producing styled corporate reports with hanging list indents, stable alternating row tables, and character boundaries spacing.

---

## 📦 Installation & Getting Started

### 1. Published NPM Package

After the package is published to npm, install globally:

```powershell
npm install -g zilmate
zilmate setup
zilmate --help
```

> [!NOTE]
> Running `zilmate` with no arguments opens the status dashboard and then the guided launcher menu. If the AI Gateway key is missing, the launcher offers setup before starting chat.

When a new CLI/SDK release is published, update easily using:

```powershell
zilmate update
zilmate version
```

### 2. Private GitHub Install

Before npm publishing, install directly from the GitHub repository:

```powershell
npm install -g github:zester4/zilmate
zilmate setup
zilmate --help
```

### 3. Windows PowerShell Installer Wizard

From PowerShell, run the automatic installer helper to trigger the complete first-use pipeline:

```powershell
iwr https://raw.githubusercontent.com/zester4/zilmate/main/install.ps1 | iex
```

The installer performs the following flow:
1. Installs ZilMate globally on your machine.
2. Runs `zilmate setup` to collect `AI_GATEWAY_API_KEY`.
3. Offers a guided workflow to configure Composio, Tavily, Redis, background jobs, QStash, and trigger workflows.
4. Runs `zilmate ping` to verify the key.
5. Automatically starts `zilmate talk`.

**Custom Installer Parameters:**

* Install without launching the guided setup:
  ```powershell
  iex "& { $((iwr -UseBasicParsing https://raw.githubusercontent.com/zester4/zilmate/main/install.ps1).Content) } -NoSetup"
  ```
* Skip Gateway ping verification or instant chat launch:
  ```powershell
  iex "& { $((iwr -UseBasicParsing https://raw.githubusercontent.com/zester4/zilmate/main/install.ps1).Content) } -NoPing -NoTalk"
  ```
* Force install from NPM instead of GitHub:
  ```powershell
  iex "& { $((iwr -UseBasicParsing https://raw.githubusercontent.com/zester4/zilmate/main/install.ps1).Content) } -Source npm"
  ```

---

## 🛠️ Configuration & Setup

### 1. Automated Setup Wizard

Install project workspace dependencies and run the guided installer:

```powershell
npm install
zilmate setup
```

The wizard prompts you for critical credentials. Have these keys ready:
* **Required**: AI Gateway API Key (`AI_GATEWAY_API_KEY`).
* **External Apps**: Composio API Key (`COMPOSIO_API_KEY`).
* **Web Research**: Tavily API Key (`TAVILY_API_KEY`).
* **Cloud Memory & Schedulers**: Upstash Redis REST URL and Token.
* **Hosted Background Webhooks**: Upstash QStash Token and Public Job Webhook URL.
* **Realtime Voice**: Deepgram API Key (`DEEPGRAM_API_KEY`).
* **Camera Capture**: `ffmpeg` installed on system path (setup can install this for you).

> [!TIP]
> Every optional feature can be skipped. If you only want basic chat, you only need the AI Gateway Key.

### 2. Real-Time Voice Configuration

ZilMate supports hands-free natural voice dialog. Manage voice features directly:

```powershell
zilmate voice setup
zilmate voice enable
zilmate voice disable
zilmate voice doctor
zilmate voice devices
zilmate voice live
```

Inside typed chat (`zilmate talk`), enter `/voice` to launch a hands-free microphone cycle:
```text
/voice
```

### 3. Manual `.env` Template

Create a `.env` file at your workspace root with the following configuration:

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

- **Composio** is optional. If set, ZilMate registers a stable local user session and generates app OAuth auth links automatically.
- **Redis** is optional. If configured, chat sessions, scratchpads, and Composio state use Upstash Redis. Otherwise, they fallback locally under `.zilo-manager/`.
- **Background Jobs** can run locally or via QStash. Local scheduler workers (`zilmate jobs worker`) run while your terminal is active. For serverless background triggers that execute even when your local machine is asleep, configure QStash plus a public job webhook.
- **Camera capture** requires `ffmpeg` on your `PATH`. On Windows, install using `winget install Gyan.FFmpeg`; on macOS, use `brew install ffmpeg`. Run `zilmate camera doctor` to verify system support.

### 4. Non-Interactive CLI Setup Flags

For automation pipelines, pass arguments directly:

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

---

## 📂 Command Matrix & Reference

### Local Development Commands

Use these scripts when working directly inside the cloned repository directory:

```bash
npm run build                                                       # Compile TypeScript to dist/
npm run zilmate -- --help                                           # Show global help usage
npm run zilmate -- setup                                            # Launch interactive setup
npm run zilmate -- doctor                                           # Run local environment check
npm run zilmate -- config                                           # View active configs (sanitized)
npm run zilmate -- models                                           # Query active AI model routing
npm run zilmate -- apps status                                      # List connected Composio tools
npm run zilmate -- triggers listen                                  # Start local event stream
npm run zilmate -- triggers types github                            # List webhook trigger events
npm run zilmate -- jobs create "Summary update"                    # Create background automation
npm run zilmate -- jobs list                                        # Show active background jobs
npm run zilmate -- jobs worker --once                               # Execute outstanding schedules
npm run zilmate -- voice doctor                                     # Check Deepgram and microphone audio
npm run zilmate -- voice setup                                      # Setup voice parameters
npm run zilmate -- voice turn "What's my status?"                  # Run one-shot voice query
npm run zilmate -- remember "Prefers concise replies"              # Add durable vector memory
npm run zilmate -- recall support                                   # Search durable vector memories
npm run zilmate -- talk                                             # Open the main interactive chat
```

### Global CLI Commands

If globally linked (`npm link`), execute the `zilmate` CLI directly:

```powershell
zilmate --help
zilmate setup
zilmate doctor
zilmate update
zilmate version
zilmate config
zilmate talk
zilmate ping
zilmate models
zilmate apps status
zilmate triggers listen
zilmate triggers types github
zilmate triggers create GITHUB_BRANCH_CREATED_TRIGGER --dry-run --owner zester4 --repo zilmate
zilmate triggers create GITHUB_COMMIT_EVENT --owner zester4 --repo zilmate
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

---

## 💻 Server-Side SDK

ZilMate can be integrated as a backend SDK inside Next.js, Node servers, or dashboard API routes.

```typescript
import { createZilMate } from 'zilmate/server';

const zilmate = createZilMate({
  sessionId: 'user-session-123',
});

// Execute structured chat
const result = await zilmate.chat({
  message: 'Draft a project roadmap based on the current workspace context.',
});

console.log(result.text);
```

### Next.js API Route Integration

```typescript
// app/api/zilmate/route.ts
import { createZilMate } from 'zilmate/server';

export async function POST(req: Request) {
  const { message, sessionId } = await req.json();
  const zilmate = createZilMate({ sessionId });
  const result = await zilmate.chat({ message });

  return Response.json(result);
}
```

### SDK Public Methods Reference

- `chat({ message })` — Primary interactive assistant backed by the supervisor Manager agent.
- `manager({ message | prompt })` — Explicit manager-level swarming and planning execution.
- `help({ question | message })` — High-speed product troubleshooting.
- `guide({ message })` — Interactive guided workflow tutorial.
- `post({ prompt })` — Generates optimized marketing status, caption, and social outreach copy.
- `research({ query | message })` — Double-tier search (local repository documents + Tavily deep-web research).
- `image({ prompt, provider, size, outputDir })` — Generates image assets via Vercel AI SDK.
- `remember({ text, tags })`, `recall({ query, limit })` — Save and retrieve facts from Upstash Redis or local memory.
- `createJob({ task, schedule, source, metadata })`, `runDueJobs()` — Queue, schedule, and run background automation jobs.

---

## 🏛️ Swarm Departmental Architecture

ZilMate organizes complex business pipelines by splitting responsibilities among 30+ specialists across 6 key departments. By deploying a horizontal active peer-to-peer messaging fabric, the swarm can coordinate actions and negotiate schemas directly. For a deep-dive into specialist instructions, toolkits, and communication protocols, see the comprehensive [SWARM.md](file:///c:/Users/mseyy/Downloads/zilo-manager/SWARM.md) document.

ZilMate’s core corporate structure is represented below:

```text
💼 Supervisor Manager (CEO)
 └── ⚙️ Digital Corporation (COO)
      ├── 📊 Strategy & Planning Department
      ├── 💻 Software Engineering Department
      ├── 📈 Growth & Marketing Department
      ├── 📋 General Operations Department
      ├── 🗄️ Data Analytics Department
      ├── 🛡️ Security & Audits Department
      └── 💰 Revenue & Finance Department
```

* **Quick Help Agent** — High-speed, local-focused markdown troubleshooting and workflow assistance.
* **Developer Helper** — Assists with CLI setup, NPM packaging, serverless webhooks, and QStash connection tuning.
* **Composio Connector** — Handles app discoveries, OAuth auth links, and action schemas.
* **Local Files Agent** — Performs safe directory audits, summarizes PDF docs, and generates git-style change snapshots within safe roots.
* **Desktop Agent** — Handshakes with OS APIs to grab clipboard contents, trigger screenshots, capture camera stills, and interpret UI using vision models.

---

## 🛡️ Security & Safety Guidelines

- **Sensitive File Blocklist** — ZilMate automatically denies reading or exposing `.env`, API keys, private certificates, or local credentials to prevent unauthorized data exposure.
- **Granular Approvals** — All write-like external app integrations (e.g. creating, updating, charging, deleting) require explicit approval via the interactive Safety Checklist.
- **Data Veracity** — The AI swarm will never claim a live external state (such as payments, identity verification, or database columns) has changed unless a tool invocation returns a successful execution confirmation.

---
*Developed as part of the ZiloShift operational intelligence ecosystem. For security reports, bug logs, and custom integration requests, please refer to [docs/README.md](docs/README.md) or open an issue.*
