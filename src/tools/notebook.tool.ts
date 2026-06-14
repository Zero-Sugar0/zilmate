import { tool } from 'ai';
import { z } from 'zod';
import {
  addNotebookEntry,
  appendNotebookMarkdown,
  listNotebookEntries,
  readNotebookMarkdown,
  searchNotebook,
  getNotebookPaths,
} from '../memory/notebook.js';
import { emitProgress } from '../runtime/progress.js';

export const notebookTools = {
  readNotebook: tool({
    description: 'Read ZilMate private notebook.md — durable working notes separate from scratchpad.',
    inputSchema: z.object({ limitChars: z.number().int().min(500).max(50_000).optional() }),
    execute: async ({ limitChars }) => {
      const text = await readNotebookMarkdown();
      return {
        paths: await getNotebookPaths(),
        content: limitChars ? text.slice(-limitChars) : text,
      };
    },
  }),

  appendNotebook: tool({
    description: 'Append a section to notebook.md and mirror it in notes.json.',
    inputSchema: z.object({
      title: z.string().min(1),
      body: z.string().min(1),
      tags: z.array(z.string()).optional(),
    }),
    execute: async ({ title, body, tags }) => {
      emitProgress({ type: 'step', label: 'Updating notebook', detail: title });
      const entry = await addNotebookEntry({
        title,
        body,
        ...(tags ? { tags } : {}),
      });
      return entry;
    },
  }),

  searchNotebook: tool({
    description: 'Search structured notebook entries by keyword.',
    inputSchema: z.object({ query: z.string().min(2), limit: z.number().int().min(1).max(20).optional() }),
    execute: async ({ query, limit }) => searchNotebook(query, limit ?? 10),
  }),

  listNotebookEntries: tool({
    description: 'List recent structured notebook entries from notes.json.',
    inputSchema: z.object({ limit: z.number().int().min(1).max(50).optional() }),
    execute: async ({ limit }) => listNotebookEntries(limit ?? 15),
  }),

  quickNotebookNote: tool({
    description: 'Quick append to notebook.md without structured entry metadata.',
    inputSchema: z.object({ section: z.string().min(1), content: z.string().min(1) }),
    execute: async ({ section, content }) => appendNotebookMarkdown(section, content),
  }),
};
