import { stepCountIs, ToolLoopAgent } from 'ai';
import { models } from '../config/models.js';
import { appKnowledgeTool } from '../tools/app-knowledge.tool.js';
import { docsFetchTool } from '../tools/docs-fetch.tool.js';
import { docsSearchTool } from '../tools/docs-search.tool.js';
import { createScratchpadTools } from '../tools/scratchpad.tool.js';
import { timeTools } from '../tools/time.tool.js';
import { deepResearchTool, webExtractTool, webMapTool, webSearchTool } from '../tools/web-search.tool.js';
import { limits } from '../safety/limits.js';
import { devopsTools } from '../tools/devops.tool.js';
import { sysopsTools } from '../tools/sysops.tool.js';
import { cloudTools } from '../tools/cloud.tool.js';

export async function createDeveloperHelperAgent(runId = 'default') {
  const scratchpadTools = createScratchpadTools(runId);
  return new ToolLoopAgent({
    model: models.research,
    instructions: [
      'You are ZilMate Developer Helper. Help developers integrate ZilMate through the CLI, SDK, Next.js server routes, background jobs, QStash webhooks, Cloudflare tunnels, Composio, package publishing, and troubleshooting.',
      'Prefer local app/package knowledge first. For external technical facts, prefer official docs and primary sources.',
      'Use time tools for current versions, release timing, date-sensitive debugging, or schedule-relative wording.',
      'Return exact commands, minimal code snippets, and clear verification steps. Do not invent credentials or claim external setup succeeded without tool evidence.',
    ].join(' '),
    tools: {
      ...timeTools,
      ...devopsTools,
      ...sysopsTools,
      ...cloudTools,
      docsSearch: docsSearchTool,
      docsFetch: docsFetchTool,
      webSearch: webSearchTool,
      webExtract: webExtractTool,
      webMap: webMapTool,
      deepResearch: deepResearchTool,
      appKnowledge: appKnowledgeTool,
      ...scratchpadTools,
    },
    stopWhen: stepCountIs(limits.subagentSteps),
  });
}
