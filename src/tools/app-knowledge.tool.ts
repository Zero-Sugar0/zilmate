import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tool } from 'ai';
import { z } from 'zod';
import { clampText } from '../safety/limits.js';
import { emitProgress } from '../runtime/progress.js';

const projectRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

const safeFiles = new Map([
  ['agent-docs', path.join(projectRoot, 'agent-docs.md')],
  ['readme', path.join(projectRoot, 'README.md')],
]);

export const appKnowledgeTool = tool({
  description: 'Read local ZilMate reference notes by key.',
  inputSchema: z.object({ key: z.enum(['agent-docs', 'readme']) }),
  execute: async ({ key }) => {
    emitProgress({ type: 'fetch:start', label: 'Reading local knowledge', detail: key });
    const file = safeFiles.get(key)!;
    try {
      const content = clampText(await readFile(file, 'utf8'), 10000);
      emitProgress({ type: 'fetch:end', label: 'Local knowledge loaded', detail: key });
      return content;
    } catch {
      emitProgress({ type: 'fetch:end', label: 'Local knowledge missing', detail: key });
      return `No local knowledge file found for ${key}.`;
    }
  },
});

