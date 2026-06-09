import { generateText, tool } from 'ai';
import { z } from 'zod';
import { models } from '../config/models.js';
import { requireGatewayAuth } from '../config/env.js';

export async function generatePost(prompt: string) {
  requireGatewayAuth();
  const result = await generateText({
    model: models.post,
    prompt: `Create concise ZiloShift launch or marketplace post copy. Return 5 options, short and ready to paste. Request: ${prompt}`,
    providerOptions: { gateway: { tags: ['zilo-manager', 'feature:post'] } },
  });
  return result.text;
}

export const postGenerateTool = tool({
  description: 'Generate short WhatsApp, status, caption, or launch post variants for ZiloShift.',
  inputSchema: z.object({ prompt: z.string().min(3) }),
  execute: async ({ prompt }) => generatePost(prompt),
});
