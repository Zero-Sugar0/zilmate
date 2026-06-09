import { tool } from 'ai';
import { z } from 'zod';
import { searchWeb } from './web-search.tool.js';
import { emitProgress } from '../runtime/progress.js';

export const docsSearchTool = tool({
  description: 'Search primary AI SDK, Vercel Gateway, OpenAI, and Upstash docs for implementation guidance.',
  inputSchema: z.object({ query: z.string().min(3) }),
  execute: async ({ query }) => {
    emitProgress({ type: 'search:start', label: 'Searching primary docs', detail: query });
    const scopedQuery = `${query} site:ai-sdk.dev OR site:vercel.com/docs OR site:developers.openai.com OR site:upstash.com`;
    return searchWeb(scopedQuery, 5);
  },
});
