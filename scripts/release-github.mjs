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

ZilMate ${tag} — Suppress verbose dotenv environment injection status logs on startup, and format session-end duration using natural language phrases ("worked for 2mins" / "worked for 3m 20s" instead of "total 161.1s").

## Install

\`\`\`powershell
npm install -g zilmate@${version}
zilmate setup
zilmate doctor
zilmate menu
\`\`\`

## Highlights

- **Natural Session Duration Formatting** — Formats session-end duration using high-fidelity human-readable phrases such as \`worked for 2mins\` or \`worked for 3m 20s\` instead of the raw, second-based \`total 161.1s\`.
- **Premium CLI Experience: Suppressed Env Logs** — Configured \`quiet: true\` across all \`.env\` loading calls inside \`src/config/env.ts\`. This suppresses verbose, distracting console output lines (such as \`◇ injected env (33) from .env...\` and \`tip: encrypted .env...\`) printed by modern \`dotenv\` on startup, achieving a beautifully clean, distraction-free terminal layout.
- **Critical Hotfix: Socket Leak Mitigated** — Reuses a single global Undici \`Agent\` dispatcher in our custom Vercel AI SDK gateway fetch wrapper to completely resolve socket leaks, TCP reset drops, and SSL handshake failures (which previously caused intermittent raw \`Gateway request failed\` errors).
- **TypeScript Type-Safety Compliance** — Adjusted the gateway setup options to spread the \`apiKey\` conditionally only when defined, fully satisfying strict compilation checks under \`exactOptionalPropertyTypes: true\`.
- **SDK Upgrade: Composio Core & Vercel Integration** — Upgraded \`@composio/core\` to \`0.13.1\` and \`@composio/vercel\` to \`0.11.0\` globally to resolve CLI deprecation warnings and inherit upstream performance and tool registry fixes.
- **Cloudflare Tunnel Auto-Setup** — Automated downloader and manager for \`cloudflared\` binary blobs across Windows, macOS, and Linux to power \`zilmate jobs listen --tunnel\` with zero manual setup.
- **Interactive Safety Checklists** — Elegant terminal TUI using checkboxes and keyboard selection to toggle approval on specific multi-specialist tool parameters during execution prompts.
- **Persistent Thinking Status Card** — Smooth rotating status card widget pinned to the bottom of the chat terminal during model inference to display elapsed time and keyboard shortcuts.

## Quick Checks

\`\`\`powershell
zilmate setup
zilmate doctor
zilmate menu
\`\`\`

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
