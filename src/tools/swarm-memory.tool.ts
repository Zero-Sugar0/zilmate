import { tool } from 'ai';
import { z } from 'zod';
import { readScratchpad, appendScratchpad } from '../memory/scratchpad.js';
import { emitProgress } from '../runtime/progress.js';

export const swarmMemoryTools = {
  getSharedScratchpad: tool({
    description: 'Read the shared swarm scratchpad for short-lived, transient cross-agent context (e.g. current build error or temporary plan).',
    inputSchema: z.object({
      sessionId: z.string().optional().default('default'),
    }),
    execute: async ({ sessionId }) => {
      const content = await readScratchpad(sessionId);
      return { content };
    },
  }),
  appendSharedScratchpad: tool({
    description: 'Append to the shared swarm scratchpad. Use to communicate transient state to other agents in the immediate swarm loop.',
    inputSchema: z.object({
      content: z.string().describe('The content to append to the scratchpad.'),
      sessionId: z.string().optional().default('default'),
    }),
    execute: async ({ content, sessionId }) => {
      emitProgress({ type: 'step', label: 'Updating shared scratchpad' });
      await appendScratchpad(sessionId, content);
      return { status: 'Scratchpad updated' };
    },
  }),
};
