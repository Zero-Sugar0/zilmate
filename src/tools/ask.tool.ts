import { tool } from 'ai';
import { z } from 'zod';
import { askUser } from '../runtime/ask.js';
import { emitProgress } from '../runtime/progress.js';

export const askTools = {
  askUserQuestion: tool({
    description: 'Ask the user a clarifying question with selectable options (CLI shows arrow/space menu). Use when you need a decision before proceeding.',
    inputSchema: z.object({
      question: z.string().min(5),
      options: z.array(z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        description: z.string().optional(),
      })).min(2).max(8),
      allowMultiple: z.boolean().optional(),
      required: z.boolean().optional(),
    }),
    execute: async ({ question, options, allowMultiple, required }) => {
      emitProgress({ type: 'step', label: 'Waiting for your answer', detail: question });
      const selected = await askUser({
        question,
        options: options.map((option) => ({
          id: option.id,
          label: option.label,
          ...(option.description ? { description: option.description } : {}),
        })),
        ...(allowMultiple !== undefined ? { allowMultiple } : {}),
        ...(required !== undefined ? { required } : {}),
      });

      if (!selected || selected.length === 0) {
        return {
          answered: false,
          selectedIds: [],
          message: required
            ? 'User did not answer (required). Ask again or pick a sensible default.'
            : 'User skipped the question.',
        };
      }

      return {
        answered: true,
        selectedIds: selected,
        labels: options.filter((option) => selected.includes(option.id)).map((option) => option.label),
      };
    },
  }),
};
