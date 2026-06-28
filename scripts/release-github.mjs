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

ZilMate ${tag} — The ultimate power-up release, transforming ZilMate into an extremely robust, cross-platform system. It introduces a suite of DevOps, SysOps, Multimedia, Cloud Storage, and Unified Corporate Wiki tools that can "survive anything" on Windows, macOS, and Linux with full local/offline fallbacks and extensive diagnostic safeguards.

## Install

\`\`\`powershell
npm install -g zilmate@${version}
zilmate setup
zilmate doctor
zilmate menu
\`\`\`

## Highlights

### ☁️ Cloud Storage (Multi-Provider Stream-Safe Storage)
- **Zero-Memory Chunked Uploads & Content-Type Detection** — Supports uploading massive database dumps, screenshots, and logs using official SDK libraries for AWS S3, Google Cloud Storage, and Vercel Blob. Auto-detects extensions to set beautiful in-browser rendering.
- **Recursive Directory Purging** — Easily remove entire directories recursively on S3, GCS, or Vercel Blob with batched deletion.
- **Temporary Signed URL Generation** — Generate pre-signed secure URLs for timed reading/writing.

### 🛠️ DevOps (Docker & Env Management)
- **Container Command Execution (\`execDockerCommand\`)** — Run command arrays inside running containers securely with strict command-injection protection (e.g., seeding a database inside a Postgres container).
- **Container Control & Logs** — Query, start, stop, restart, kill, and fetch real-time logs of Docker containers.
- **Env Validation** — Securely audits and validates local \`.env\` structures against standard examples without leaking secrets.

### 🖥️ SysOps (System & Port Diagnostics)
- **Port-Based Process Termination** — Scan active listening ports and immediately terminate blocking processes holding development ports (e.g., \`3000\`, \`8080\`) across Windows, macOS, and Linux.
- **Real-Time Host Metrics** — Monitor host processor utilization, RAM allocation, disk spaces, and uptime with robust command fallbacks.
- **Network Routing & Database Schema Inspect** — Perform trace routes, ping latency audits, and explore SQLite database structures via local tools or Python fallbacks.

### 🎙️ Multimedia (Resilient Speech-To-Text & Offline Speech Synthesis)
- **3-Tier Text-To-Speech Pipeline** — Prioritizes **Deepgram Aura-2** (low latency, high fidelity), falls back to **OpenAI Speech API**, and gracefully cascades to **Local Offline Speech Synthesis** (Windows SAPI via PowerShell, macOS \`say\`, Linux \`espeak\`/\`festival\`) when offline or uncredentialed.
- **Speech-to-Text & Transcoding** — Seamless audio transcription cascading to Deepgram Nova-2 / OpenAI Whisper-1, video-to-audio extraction, and FFmpeg-driven video transcoding.
- **Image Watermarking** — Optimize images with custom text watermarks overlaid beautifully in the bottom-right corner using secure filtergraph escaping.

### 📚 Unified Corporate Wiki (SuperMemory & Upstash Vector)
- **Semantic Knowledge Engine** — Fully integrates **SuperMemory** and **Upstash Vector** for corporate-grade document indexing and search.
- **Diagnostics and Setup Wizards** — Setup interactive wizards for wiki backends and run comprehensive automated connectivity testing via \`zilmate doctor\`.

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
    'zester4/zilo-manager',
    '--title',
    title,
    '--notes-file',
    notesPath,
    '--latest',
  ],
  { stdio: 'inherit' },
);
