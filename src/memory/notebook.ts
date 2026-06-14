import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { workspaceLayout } from '../workspace/paths.js';

export type NotebookEntry = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type NotesStore = {
  entries: NotebookEntry[];
};

async function readNotesJson(): Promise<NotesStore> {
  const path = workspaceLayout().notesJson;
  if (!existsSync(path)) return { entries: [] };
  try {
    return JSON.parse(await readFile(path, 'utf8')) as NotesStore;
  } catch {
    return { entries: [] };
  }
}

async function writeNotesJson(store: NotesStore) {
  await writeFile(workspaceLayout().notesJson, JSON.stringify(store, null, 2), 'utf8');
}

export async function appendNotebookMarkdown(section: string, content: string) {
  const layout = workspaceLayout();
  const stamp = new Date().toISOString();
  const block = `\n## ${section}\n_${stamp}_\n\n${content.trim()}\n`;
  await appendFile(layout.notebook, block, 'utf8');
  return { path: layout.notebook, section, appendedAt: stamp };
}

export async function readNotebookMarkdown() {
  const path = workspaceLayout().notebook;
  if (!existsSync(path)) return '';
  return readFile(path, 'utf8');
}

export async function addNotebookEntry(input: { title: string; body: string; tags?: string[] }) {
  const store = await readNotesJson();
  const now = new Date().toISOString();
  const entry: NotebookEntry = {
    id: `note_${Date.now()}`,
    title: input.title.trim(),
    body: input.body.trim(),
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };
  store.entries.unshift(entry);
  await writeNotesJson(store);
  await appendNotebookMarkdown(entry.title, entry.body);
  return entry;
}

export async function listNotebookEntries(limit = 20) {
  const store = await readNotesJson();
  return store.entries.slice(0, limit);
}

export async function searchNotebook(query: string, limit = 10) {
  const q = query.trim().toLowerCase();
  const store = await readNotesJson();
  return store.entries
    .filter((entry) =>
      entry.title.toLowerCase().includes(q)
      || entry.body.toLowerCase().includes(q)
      || entry.tags.some((tag) => tag.toLowerCase().includes(q)))
    .slice(0, limit);
}

export async function getNotebookPaths() {
  const layout = workspaceLayout();
  return { markdown: layout.notebook, json: layout.notesJson };
}
