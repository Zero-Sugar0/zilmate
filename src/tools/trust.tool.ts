import { tool } from 'ai';
import { z } from 'zod';
import {
  listActiveTrustActions,
  logTrustAction,
  markTrustActionUndone,
  trustUndoWindowMs,
} from '../safety/trust-log.js';

export const trustTools = {
  logTrustAction: tool({
    description: 'Record a destructive or outbound action for undo-window tracking and user transparency.',
    inputSchema: z.object({
      action: z.string().min(3),
      category: z.enum(['destructive', 'outbound', 'os-control', 'other']).optional(),
      reversible: z.boolean().optional(),
      undoHint: z.string().optional(),
    }),
    execute: async (input) => logTrustAction({
      action: input.action,
      ...(input.category ? { category: input.category } : {}),
      ...(input.reversible !== undefined ? { reversible: input.reversible } : {}),
      ...(input.undoHint ? { undoHint: input.undoHint } : {}),
    }),
  }),

  listActiveTrustActions: tool({
    description: 'List trust-layer actions still inside the undo window.',
    inputSchema: z.object({}),
    execute: async () => ({
      undoWindowMs: trustUndoWindowMs(),
      actions: await listActiveTrustActions(),
    }),
  }),

  markTrustActionUndone: tool({
    description: 'Mark a trust action as undone within the undo window.',
    inputSchema: z.object({ id: z.string().min(3) }),
    execute: async ({ id }) => markTrustActionUndone(id),
  }),
};
