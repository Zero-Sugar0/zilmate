import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';

const root = process.env.ZILMATE_WORKSPACE?.trim()
  ? path.resolve(process.env.ZILMATE_WORKSPACE.trim())
  : process.platform === 'win32' || process.platform === 'darwin'
    ? path.join(homedir(), 'Downloads', 'ZilMate')
    : path.join(homedir(), 'ZilMate');

const dirs = [
  root,
  path.join(root, 'skills'),
  path.join(root, 'outputs', 'osint'),
  path.join(root, 'outputs', 'pentest'),
  path.join(root, 'outputs', 'images'),
  path.join(root, 'logs'),
  path.join(root, 'projects'),
  path.join(root, 'attachments'),
  path.join(root, 'backups'),
  path.join(root, 'config'),
  path.join(root, 'scratch'),
  path.join(root, 'data'),
];

for (const dir of dirs) {
  await mkdir(dir, { recursive: true });
}

const notebook = path.join(root, 'notebook.md');
if (!existsSync(notebook)) {
  await writeFile(notebook, '# ZilMate Notebook\n\n', 'utf8');
}

const memory = path.join(root, 'memory.json');
if (!existsSync(memory)) {
  await writeFile(memory, '[]\n', 'utf8');
}

console.log(`ZilMate workspace ready at ${root}`);
