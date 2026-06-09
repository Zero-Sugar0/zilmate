import { tool } from 'ai';
import { z } from 'zod';
import { appendScratchpad, readScratchpad } from '../memory/scratchpad.js';
import { emitProgress } from '../runtime/progress.js';

export function createScratchpadTools(runId: string) {
  return {
    readScratchpad: tool({
      description: 'Read shared scratchpad notes for this agent run. Use this to avoid repeating context in prompts.',
      inputSchema: z.object({}),
      execute: async () => {
        emitProgress({ type: 'fetch:start', label: 'Reading scratchpad', detail: runId });
        const content = await readScratchpad(runId);
        emitProgress({ type: 'fetch:end', label: 'Scratchpad loaded', detail: runId });
        return content;
      },
    }),
    appendScratchpad: tool({
      description: 'Append compact notes to the shared scratchpad for this run. Keep notes short and factual.',
      inputSchema: z.object({ note: z.string().min(1).max(4000) }),
      execute: async ({ note }) => {
        emitProgress({ type: 'fetch:start', label: 'Appending scratchpad note', detail: runId });
        const result = await appendScratchpad(runId, note);
        emitProgress({ type: 'fetch:end', label: 'Scratchpad note saved', detail: runId });
        return result;
      },
    }),
  };
}
