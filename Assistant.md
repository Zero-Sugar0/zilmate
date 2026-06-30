# ZilMate Assistant — Architecture & New Updates 🌌

Welcome to the **ZilMate Assistant** handbook. This document describes the powerful advancements, architecture, and toolkits added across the **v1.10.x** release train (culminating in **v1.10.4**).

---

## 🚀 1. Pristine CLI Terminal Start-Up (v1.10.2)

We polished the terminal start-up sequence to offer a clean, premium visual aesthetic from the first second of execution.

*   **The Issue**: Standard `dotenv` (v17.4+) logs raw key injection counts and random tip banners (like `◇ injected env...` and `tip: ⌘ suppress logs`) to standard output when compiling and running. This leaked raw configuration info and cluttered the space above the beautiful ASCII welcome banner.
*   **The Solution**: Implemented a **Bulletproof Console Interceptor Wrapper** inside [src/config/env.ts](src/config/env.ts):
    ```typescript
    const originalLog = console.log;
    const originalError = console.error;
    console.log = () => {};
    console.error = () => {};
    try {
      // Load environment profiles safely...
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }
    ```
    All environmental configurations still load correctly with local overrides taking precedence, but start-up output remains 100% clean and pristine.

---

## 🎨 2. Visual Swarm Trace Layout Tweaks (v1.10.2)

We overhauled the visual layout within the HTML trace reporting view inside [src/observability/traces.ts](src/observability/traces.ts) to enhance clarity, scalability, and usability:

*   **Fluid-Grid Scaling**: Removed rigid, legacy viewport limits (`h-full`, `lg:overflow-hidden`) on main tags, allowing trace timeline sections, Gantt chart columns, and pre-formatted text containers to scale dynamically with the screen height.
*   **Expanded Inspector Panels**: Stripped raw `max-h-60`, `max-h-52`, and `max-h-36` scrolling blocks from raw JSON inspect panels, collaboration reports, and wiki card text elements. This ensures large outputs render in full glory without nested, awkward multi-pane scrollbars.
*   **Aesthetic Alignment**: Styled scrolling structures to work as a natural single-scrolling canvas, optimizing the Gantt waterfall grid for large-screen monitoring and trace sharing.
*   **Elite Interactive Diagnostics**: Promoted interactive diagnostic capabilities including collapsible directory tree nodes with auto-expand query matching, clickable KPI metric cards acting as instant active trace filters, chronological Gantt chart timeline grid rulers with dotted tracking guides, and a single-click "Copy JSON" clipboard utility.

---

## 🏛️ 3. Decentralized Swarm (Digital Corporation Blueprint — v1.10.1)

We officially introduced a decentralized, multi-agent **Digital Corporation Blueprint** that organizes AI specialists into cooperative departmental layers:

### A. Departmental Topology
Over **30+ specialist agents** are organized into 6 core operational divisions:
*   **Strategy & Product**: Product Manager, UX Researcher, Market Analyst.
*   **Engineering & Creative**: Architect, Full-Stack Coder, QA Engineer, SRE, Video Producer, Security Auditors.
*   **Development Division**: Frontend/Backend Architects, DB Specialist, Auth/Billing Specialist, SRE, Data Intelligence, Mobile Coder.
*   **Growth & Marketing**: Growth Hacker, SEO Expert, Content/Ads/Social Managers, E-Comm Merchant, CRO, AI SEO Strategist.
*   **Operations & CS**: Customer Support, Legal Counsel, Logistics, HR, Finance Analyst.
*   **Data & Intelligence**: Data Scientist, BI Reporter, Agent Optimizer.

### B. Dual-Pillar P2P Coordination Fabric
Bypasses centralized supervisor bottlenecks to scale workflows and minimize latency:
1.  **Active P2P Bus (Joint War Room)**: Peers can directly trigger `collaborateWithPeer` to spawn dedicated ad-hoc channels to solve complex inter-departmental subtasks.
2.  **Passive Blackboard Bus (Semantic Corporate Wiki)**: Peers publish structured deliverables (facts, schemas, copy, code) into a shared semantic index (powered by **SuperMemory** and **Upstash Vector**) for others to consume asynchronously.

### C. Semantic Approvals Firewall (`approvals.ts`)
Intercepts all local host shell commands and filesystem write streams via high-performance string filters and real-time LLM guardrails to protect against prompt injection, file directory traversal, and OWASP exploits.

---

## 🧠 4. Swarm Memory Systems & Session Continuity (v1.10.1)

We designed a multi-tiered, durable memory ecosystem to guarantee context retention, cross-agent coordination, and crash/restart resilience:

### A. Session Continuity Engine (`session-continuity.tool.ts`)
*   **Persistent State Serialization**: Saves comprehensive, structural JSON handoffs (`handoff-[sessionId].json`) including progress summaries, subsequent task lists, and open execution threads to disk.
*   **Seamless Resumes**: Upon start-up or reboot, the system automatically pulls the latest state vector, allowing agents to instantly catch up without requiring the user to repeat instructions.

### B. Durable Private Notebook (`notebook.md` & `notes.json`)
*   Provides a structured workspace journal where the agents write down durable project constraints, system architecture decisions, configured ports, active CLI processes, and environmental patterns.
*   This acts as a secondary brain, isolated from short-term conversation context, that is indexed and queryable via keyword search.

### C. Joint War Room & Swarm Vector Blackboard
*   **SuperMemory & Upstash Vector** power a shared, semantic Corporate Wiki where any department agent can publish critical schemas, documentation, and interface specs, making them immediately accessible across the decentralized corporation.
*   **Local Thread Scratchpads**: Temporary thread planning journals (`scratchpad.tool.ts`) used within a single invocation, automatically discarded upon task completion to keep context windows pristine.

---

## 🛠️ 5. Extended Developer & SysOps Toolkits (v1.10.0)

We packed the core agent executable with native, high-performance tool integrations to handle real-world deployment challenges:

### ☁️ Cloud Storage Integration (S3 / GCS / Vercel Blob)
*   **Stream-Safe Uploads**: Employs tiered `@aws-sdk/client-s3` chunked streams, `@google-cloud/storage` SDK buffers, or `@vercel/blob` APIs to bypass memory limitations when uploading large database backups.
*   **Timed Pre-signed URLs**: Generates temporary file-sharing links directly.
*   **Fallback Architecture**: Automatically falls back to local command-line binaries (`aws`, `gsutil`, `vercel`) to utilize active SSO sessions if SDK credentials are not configured.

### 🐳 DevOps (Docker Control Suite)
*   Allows the agent to list running containers, fetch the last $N$ lines of stdout/stderr logs, and control container life cycles (start, stop, restart) to triage server issues locally.
*   Checks configuration parity by comparing active `.env` parameters against `.env.example` keys.

### 🔌 SysOps & Network Diagnostics
*   **Cross-Platform Port Profiler**: Identifies active listening TCP ports, resolving port numbers directly to host process names under Windows, macOS, and Linux.
*   **ICMP Diagnostics**: Runs low-level `pingHost` and `traceRoute` to profile gateway and database latency.
*   **Database Schema Analyzer**: Inspects SQLite database structures, tables, indexes, and schemas.

### 🎙️ Multimedia Engine (FFmpeg & STT/TTS)
*   Transcodes local video files (resizing, codec adjusting) and strips high-fidelity MP3 tracks using FFmpeg.
*   Features a **3-Tier Speech-to-Text & TTS Pipeline** falling back from high-performance Deepgram endpoints to Whisper APIs, and ultimately to native offline OS speech synthesizers in non-networked environments.

---

## 📊 6. Key CLI Command Reference

Access all new features directly from your command line:

| Command | Description | Useful Options |
| :--- | :--- | :--- |
| `zilmate menu` | Opens the premium, guided CLI dashboard. | *None* |
| `zilmate doctor` | Runs extensive diagnostic checks on your environment. | `--verbose` |
| `zilmate swarm <task>` | Routes a business objective to the Digital Corporation swarm. | `--dept <name>`, `--max-steps <N>` |
| `zilmate trace` | Compiles and opens the beautiful Gantt waterfall report. | `--session <id>`, `--html` |
| `zilmate talk` | Starts an interactive workspace conversation with the manager. | `--voice` |
| `zilmate jobs` | Monitors and processes background workers and cron schedules. | `--worker`, `--listen` |
| `zilmate apps` | Manages external integrations (GitHub, Slack, Discord, etc.). | `status`, `login` |

---

## ⚡ 7. Patch Release Polish (v1.10.3)

We implemented critical UX and cognitive optimizations to enhance interactive CLI stability, upgrade the background self-learning model, and align coding delegates with corporate wiki databases.

### 🔇 TTY Prompt Thinking Ticker Suppression
*   **The Issue**: The global `thinkingTimer` background spinner (operating at an 80ms interval) continued printing re-draw sequences while `readline` was awaiting user confirmations or multi-select inputs. This corrupted checkbox displays and caused line misalignment in standard terminals.
*   **The Solution**: Engineered `pauseThinkingTicker()` and `resumeThinkingTicker()` hooks inside [src/cli/format.ts](src/cli/format.ts) to gracefully pause background renders during active TTY prompts inside [src/cli/confirm.ts](src/cli/confirm.ts).

### 🔄 Dual-Pronged Performance Optimization Loop
*   **Offensive + Defensive Harvester**: Expanded the self-optimization compiler to capture both defensive guardrails (preventing compile-time and runtime failures) and offensive design accelerators (reusable patterns, prompt enhancements, and efficiency formulas).
*   **Semantic Deduplication**: Upgraded the optimizer in [src/observability/optimizer.ts](src/observability/optimizer.ts) to pre-query active rules from the Wiki, prompting the LLM to only output net-new rules or updates to existing ones (`isUpdateOfExisting: true`), preventing guideline bloat.

### 🧠 Semantic Corporate Wiki for Coding Subagents
*   **Aligning Coding Delegates**: Equipped the internal `appBuilder` and `qaIntegration` subagents inside [src/agents/coding.agent.ts](src/agents/coding.agent.ts) with full corporate wiki tools (`queryCorporateWiki` and `publishToCorporateWiki`).
*   **Unified Context Integration**: Subagents now fetch relational requirements, third-party schemas, and monetization guides dynamically before scaffolding code, guaranteeing architectural sync.

---

## 🌐 8. ZilMate Ubiquity Background Service (v1.10.4)

We engineered **ZilMate Ubiquity**—a highly optimized, zero-dependency background daemon service that allows users to query ZilMate and inject responses anywhere across their operating system using global hotkeys.

### A. Zero-Dependency Cross-Platform Architecture
*   **Windows Hotkey Listener (`win-listener.ps1`)**: Runs a WinForms keyboard hook and message loop compiled on-the-fly inside PowerShell. This avoids requiring heavy Electron wrappers or separate compiled C# binary executables.
*   **macOS Automated Service Installer (`mac-installer.ts`)**: Programmatically scaffolds a native Quick Action Service at `~/Library/Services/ZilMate Ubiquity.workflow/`. It hooks into the macOS system shortcuts framework using Custom Plists and a fast JavaScript for Automation (JXA) JSON parser to bind to `Cmd+Shift+Z`.

### B. Secure Token-Based Communication
*   **Daemon Port Integration**: Operates a background Express-like service listening on `127.0.0.1:8124`.
*   **CSRF/Bearer Protection**: Securely writes a single-use authorization token to the user's home folder (`~/.zilmate-token`), protecting against any unauthorized cross-origin requests.

### C. Pristine Clipboard & Selection Interception
*   **Automatic Backup**: On triggering `Ctrl+Shift+Z` / `Cmd+Shift+Z`, the daemon backs up the user's active clipboard, issues an OS-level key combination to copy the highlighted text, processes the prompt in the background with "Pure Output Mode" (no conversational preambles), writes the result back, pastes it into the active field, and restores the original clipboard.

