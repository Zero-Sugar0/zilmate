import { tool, type Tool } from 'ai';
import { z, type ZodType } from 'zod';
import { emitProgress } from './progress.js';

export type ToolDefinition<INPUT extends ZodType<any>, OUTPUT> = {
  description: string;
  inputSchema: INPUT;
  execute: (input: z.infer<INPUT>, context: { abortSignal?: AbortSignal }) => Promise<OUTPUT>;
  group?: string;
};

export function defineTool<INPUT extends ZodType<any>, OUTPUT>(
  name: string,
  def: ToolDefinition<INPUT, OUTPUT>
): Tool<z.infer<INPUT>, OUTPUT> {
  return tool({
    description: def.description,
    // @ts-ignore - Vercel AI SDK v6 type compatibility with generic Zod types
    inputSchema: def.inputSchema,
    // @ts-ignore
    execute: async (input: z.infer<INPUT>, context: { abortSignal?: AbortSignal }) => {
      emitProgress({
        type: 'tool:start',
        label: `Executing ${name}`,
        ...(def.group ? { detail: `Group: ${def.group}` } : {})
      });

      try {
        const result = await def.execute(input, context);
        emitProgress({ type: 'tool:end', label: `${name} completed` });
        return result;
      } catch (error) {
        emitProgress({
          type: 'tool:error',
          label: `${name} failed`,
          detail: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    },
  });
}
