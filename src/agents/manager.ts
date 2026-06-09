import { randomUUID } from 'node:crypto';
import { stepCountIs, tool, ToolLoopAgent } from 'ai';
import { z } from 'zod';
import { models } from '../config/models.js';
import { createQuickHelpAgent } from './quick-help.agent.js';
import { createChatAgent } from './chat.agent.js';
import { createPostAgent } from './post.agent.js';
import { createImageAgent } from './image.agent.js';
import { createDocsResearchAgent } from './docs-research.agent.js';
import { checkReadOnlyIntent } from '../safety/approvals.js';
import { limits } from '../safety/limits.js';
import { emitProgress, type ProgressEvent, withProgressListener } from '../runtime/progress.js';
import { createScratchpadTools } from '../tools/scratchpad.tool.js';
import { ziloDocsTools } from '../tools/zilo-docs.tool.js';

function agentInput(prompt: string, abortSignal?: AbortSignal) {
  return abortSignal ? { prompt, abortSignal } : { prompt };
}

function describeTool(name: string) {
  const labels: Record<string, string> = {
    quickHelp: 'Using quick-help subagent',
    chat: 'Using chat subagent',
    post: 'Using post-writing subagent',
    image: 'Using image generation subagent',
    research: 'Using research subagent',
    readScratchpad: 'Reading scratchpad',
    appendScratchpad: 'Updating scratchpad',
    listZiloDocs: 'Listing Zilo docs',
    readZiloDoc: 'Reading Zilo doc',
    searchZiloDocs: 'Searching Zilo docs',
  };
  return labels[name] || `Using ${name}`;
}

function subagentTool(name: string, description: string, run: (prompt: string, abortSignal?: AbortSignal) => Promise<string>) {
  return tool({
    description,
    inputSchema: z.object({ prompt: z.string().min(3) }),
    execute: async ({ prompt }, { abortSignal }) => {
      emitProgress({ type: 'tool:start', label: describeTool(name), detail: prompt });
      try {
        const result = await run(prompt, abortSignal);
        emitProgress({ type: 'tool:end', label: `${describeTool(name)} finished` });
        return result;
      } catch (error) {
        emitProgress({ type: 'tool:error', label: `${describeTool(name)} failed`, detail: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    },
    toModelOutput: ({ output }) => ({ type: 'text', value: String(output) }),
  });
}

export function createManagerAgent(runId: string = randomUUID()) {
  const quickHelp = createQuickHelpAgent();
  const chat = createChatAgent();
  const post = createPostAgent();
  const image = createImageAgent();
  const research = createDocsResearchAgent(runId);
  const scratchpadTools = createScratchpadTools(runId);

  return new ToolLoopAgent({
    model: models.manager,
    instructions: 'You are ZilMate, the CLI orchestrator for ZiloShift app operations. Route to specialized subagents. Keep parent context small. You can guide, research, draft, chat, and generate image assets. You may use scratchpad tools for compact notes during multi-source or multi-subagent tasks. You must not mutate production systems or claim you performed app changes.',
    tools: {
      quickHelp: subagentTool('quickHelp', 'Fast troubleshooting and usage guidance.', async (prompt, abortSignal) => {
        const result = await quickHelp.generate(agentInput(prompt, abortSignal));
        return result.text;
      }),
      chat: subagentTool('chat', 'Natural conversation about ZiloShift workflows and features.', async (prompt, abortSignal) => {
        const result = await chat.generate(agentInput(prompt, abortSignal));
        return result.text;
      }),
      post: subagentTool('post', 'Generate short WhatsApp/status/social post copy.', async (prompt, abortSignal) => {
        const result = await post.generate(agentInput(prompt, abortSignal));
        return result.text;
      }),
      image: subagentTool('image', 'Generate image assets and return saved local file paths.', async (prompt, abortSignal) => {
        const result = await image.generate(agentInput(prompt, abortSignal));
        return result.text;
      }),
      research: subagentTool('research', 'Research docs or current web information and return sourced summaries.', async (prompt, abortSignal) => {
        const result = await research.generate(agentInput(prompt, abortSignal));
        return result.text;
      }),
      ...ziloDocsTools,
      ...scratchpadTools,
    },
    stopWhen: stepCountIs(limits.managerSteps),
  });
}

function toolNamesFromStep(step: unknown) {
  const toolCalls = (step as { toolCalls?: Array<{ toolName?: string }> }).toolCalls || [];
  return toolCalls.map((call) => call.toolName).filter((name): name is string => Boolean(name));
}

export async function runManager(prompt: string, options: { progress?: (event: ProgressEvent) => void; runId?: string } = {}) {
  const safety = checkReadOnlyIntent(prompt);
  if (safety.decision === 'blocked') return safety.reason!;

  return withProgressListener(options.progress, async () => {
    const runId = options.runId || randomUUID();
    emitProgress({ type: 'thinking', label: 'Thinking', detail: runId });
    const result = await createManagerAgent(runId).generate({
      prompt,
      onStepFinish: (step) => {
        const tools = toolNamesFromStep(step);
        if (tools.length > 0) {
          emitProgress({ type: 'step', label: 'Manager selected tools', detail: tools.join(', ') });
        }
      },
    });
    emitProgress({ type: 'done', label: 'Response ready' });
    return result.text;
  });
}



