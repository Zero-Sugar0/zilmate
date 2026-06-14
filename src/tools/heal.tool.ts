import { tool } from 'ai';
import { z } from 'zod';
import { runHeal, readRecentHealLog } from '../memory/heal.js';
import { emitProgress } from '../runtime/progress.js';

export const healTools = {
  runHealPass: tool({
    description: 'Review recent session work, learn what worked or failed, save missed personal context, and append to notebook.',
    inputSchema: z.object({
      sessionSummary: z.string().min(10),
      sessionId: z.string().optional(),
      recentSuccesses: z.array(z.string()).optional(),
      recentFailures: z.array(z.string()).optional(),
      deep: z.boolean().optional().describe('Run two-pass deep heal (default true)'),
    }),
    execute: async (input) => {
      emitProgress({ type: 'thinking', label: 'Running heal pass' });
      const result = await runHeal({
        sessionSummary: input.sessionSummary,
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        ...(input.recentSuccesses ? { recentSuccesses: input.recentSuccesses } : {}),
        ...(input.recentFailures ? { recentFailures: input.recentFailures } : {}),
        ...(input.deep !== undefined ? { deep: input.deep } : { deep: true }),
      });
      emitProgress({ type: 'done', label: 'Heal pass complete' });
      return result;
    },
  }),

  readHealHistory: tool({
    description: 'Read recent heal pass log entries.',
    inputSchema: z.object({ limit: z.number().int().min(1).max(20).optional() }),
    execute: async ({ limit }) => readRecentHealLog(limit ?? 5),
  }),
};
