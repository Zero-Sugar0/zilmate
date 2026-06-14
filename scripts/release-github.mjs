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

ZilMate ${tag} — workspace-first assistant with merge setup, documents, skills.sh, heal, and richer CLI UX.

## Install

\`\`\`powershell
npm install -g zilmate@${version}
zilmate setup
zilmate doctor --live
\`\`\`

## Highlights

- **Merge setup** — \`zilmate setup\` preserves existing \`.env\` values; only adds missing keys.
- **ZilMate workspace** — \`~/Downloads/ZilMate\` with notebook, knowledge graph, skills, outputs, logs.
- **PDF & slide decks** — \`generatePdf\` / \`generateSlideDeck\` tools (Kimi-style .pptx + reports).
- **skills.sh ecosystem** — \`searchSkillsRegistry\` + \`installRegistrySkill\` via \`npx skills\`.
- **Powerful heal** — two-pass session review: memory, contacts, projects, action items, friction log.
- **Desktop notifications** — agent can toast the user when approval or attention is needed.
- **CLI UX** — spinner while thinking, arrow/space selection for agent questions.
- **QStash + Cloudflare** — optional tunnel during setup; \`zilmate jobs listen --tunnel\`.

## Quick Checks

\`\`\`powershell
zilmate workspace
zilmate heal "session summary"
zilmate jobs listen --tunnel
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
