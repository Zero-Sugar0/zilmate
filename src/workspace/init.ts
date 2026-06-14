import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { workspaceLayout, resolveWorkspaceRoot } from './paths.js';

const NOTEBOOK_TEMPLATE = `# ZilMate Notebook

Private working notes for ZilMate. The agent appends learnings, decisions, and follow-ups here.

## Today

`;

export async function initWorkspace(root = resolveWorkspaceRoot()) {
  const layout = workspaceLayout(root);
  const dirs = [
    layout.root,
    layout.skills,
    layout.outputs,
    layout.osint,
    layout.pentest,
    layout.images,
    layout.logs,
    layout.projects,
    layout.attachments,
    layout.backups,
    layout.config,
    layout.scratch,
    layout.data,
  ];

  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }

  if (!existsSync(layout.notebook)) {
    await writeFile(layout.notebook, NOTEBOOK_TEMPLATE, 'utf8');
  }

  if (!existsSync(layout.memoryJson)) {
    await writeFile(layout.memoryJson, '[]\n', 'utf8');
  }

  if (!existsSync(layout.notesJson)) {
    await writeFile(layout.notesJson, JSON.stringify({ entries: [] }, null, 2), 'utf8');
  }

  if (!existsSync(layout.knowledgeGraph)) {
    await writeFile(layout.knowledgeGraph, JSON.stringify({
      ownerName: '',
      nodes: [],
      updatedAt: new Date().toISOString(),
    }, null, 2), 'utf8');
  }

  const readme = `# ZilMate Workspace

This folder is your local ZilMate home: outputs, skills, notebook, memory, and logs.

- \`notebook.md\` — agent working notes
- \`memory.json\` — durable memory mirror (Redis optional)
- \`knowledge-graph.json\` — people, projects, relationships
- \`skills/\` — install skills here (\`skills/my-skill/SKILL.md\`)
- \`outputs/\` — OSINT, pentest, images
- \`logs/\` — heal and trust action logs

Set \`ZILMATE_WORKSPACE\` to use a different path.
`;
  const readmePath = `${layout.root}/README.md`;
  if (!existsSync(readmePath)) {
    await writeFile(readmePath, readme, 'utf8');
  }

  return layout;
}

export async function readWorkspaceReadme() {
  const layout = workspaceLayout();
  try {
    return await readFile(`${layout.root}/README.md`, 'utf8');
  } catch {
    return '';
  }
}
