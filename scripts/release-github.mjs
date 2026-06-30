import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const version = pkg.version;
const tag = `v${version}`;
const title = `ZilMate ${tag}`;

const notes = `# ${title}

ZilMate ${tag} — The Official **ZilMate Swarm (Digital Corporation Blueprint)** Release! 🌌

This release officially introduces the decentralized, multi-agent Digital Corporation architecture, powering 30+ specialists across 6 business divisions. By deploying a horizontal Peer-to-Peer Coordination Bus and Semantic Corporate Wiki backends, ZilMate bypasses rigid centralized supervisors, reducing operational token costs, cutting latency, and facilitating deep collaborative pipelines.

## Install

\`\`\`powershell
npm install -g zilmate@${version}
zilmate setup
zilmate doctor
zilmate status
\`\`\`

## 🌌 Swarm Architecture Highlights (Digital Corporation Blueprint)

- **🌐 ZilMate Ubiquity Background Service** — Zero-dependency background service offering system-wide hotkeys:
  - **Global Hotkey Integration**: Press \`Ctrl+Shift+Z\` (Windows) or \`Cmd+Shift+Z\` (macOS) in any application (Notion, WhatsApp, browser, etc.) to intercept, process, and replace selected text in-place.
  - **Zero-Dependency Native Listeners**: PowerShell-compiled WinForms hooks on Windows, and programmatically constructed native Service Workflows on macOS.
  - **Secure Local API Daemon**: High-speed communication protected by single-use bearer tokens, guarding from cross-origin hijacking.
- **🏛️ Departmental Topology** — Organizes 30+ AI specialists across 6 core corporate divisions:
  - **Strategy & Product** (Product Manager, UX Researcher, Market Analyst)
  - **Engineering & Creative** (Architect, Full-Stack Coder, QA Engineer, SRE, Video Producer, Security Auditors)
  - **Development Division** (Frontend/Backend Architects, DB Specialist, Auth/Billing Specialist, SRE, Data Intelligence, Mobile Coder)
  - **Growth & Marketing** (Growth Hacker, SEO Expert, Content/Ads/Social Managers, E-Comm Merchant, CRO, AI SEO Strategist)
  - **Operations & CS** (CS, Legal Counsel, Logistics, HR, Finance Analyst)
  - **Data & Intelligence** (Data Scientist, BI Reporter, Agent Optimizer)
- **⚡ Dual-Pillar P2P Coordination Fabric**:
  - **Active P2P Bus (Joint War Room)**: Agents can bypass centralized coordinators and invoke \`collaborateWithPeer\` to spin up dedicated sub-threads for task resolution.
  - **Passive blackboard Bus (Semantic Corporate Wiki)**: Agents publish high-value deliverables to a shared semantic index (SuperMemory / Upstash Vector) for others to query asynchronously on-demand.
- **🛡️ Semantic Approvals Firewall (\`approvals.ts\`)** — Intercepts filesystem and terminal commands via high-speed regex checks and low-latency LLM guardrails to prevent OWASP and host shell exploits.
- **🛑 Departmental Suspension** — Safe-guards operation by enabling operators to halt or resume specific departments at any time without halting the global swarm.


## 🛠️ Also Included in the 1.10.x Release Train
- **☁️ Cloud Storage Integration** — Stream-safe chunked uploads, recursive directory purging, and timed pre-signed URL generation.
- **🎙️ Multimedia Engine** — Resilient 3-tier Speech-to-text and Text-To-Speech pipelines featuring offline native OS speech synthesis engine fallbacks.
- **🖥️ SysOps & DevOps Toolkits** — Cross-platform port monitoring, process terminators, real-time metrics, and container execution.

## npm

Published package: \`zilmate@${version}\`
`;

const run = (command, commandArgs, options = {}) => {
  return execFileSync(command, commandArgs, {
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
    ...options,
  });
};

if (dryRun) {
  console.log(`Tag: ${tag}`);
  console.log(`Title: ${title}`);
  console.log('');
  console.log(notes);
  process.exit(0);
}

try {
  run('gh', ['auth', 'status'], { stdio: 'pipe' });
} catch {
  console.error('GitHub CLI is not authenticated. Run: gh auth login -h github.com');
  process.exit(1);
}

const notesPath = join(tmpdir(), `zilmate-${version}-github-release.md`);
writeFileSync(notesPath, notes);

run(
  'gh',
  [
    'release',
    'create',
    tag,
    '--repo',
    'zester4/zilmate',
    '--title',
    title,
    '--notes-file',
    notesPath,
    '--latest',
  ],
  { stdio: 'inherit' },
);
