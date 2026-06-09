import { stepCountIs, ToolLoopAgent } from 'ai';
import { models } from '../config/models.js';
import { docsFetchTool } from '../tools/docs-fetch.tool.js';
import { docsSearchTool } from '../tools/docs-search.tool.js';
import { appKnowledgeTool } from '../tools/app-knowledge.tool.js';
import { createScratchpadTools } from '../tools/scratchpad.tool.js';
import { ziloDocsTools } from '../tools/zilo-docs.tool.js';
import { deepResearchTool, webCrawlTool, webExtractTool, webMapTool, webSearchTool } from '../tools/web-search.tool.js';

export function createDocsResearchAgent(runId = 'default') {
  const scratchpadTools = createScratchpadTools(runId);
  return new ToolLoopAgent({
    model: models.research,
    instructions: 'You are a focused docs research subagent. For ZiloShift product behavior, search/read local Zilo docs first. For external facts, prefer official or primary docs: search lightly, extract known URLs deeply, map before crawling, crawl only small docs sections, and use deepResearch only for broad synthesis where the user clearly benefits from a heavier task. Return compact answers with source URLs. Use the scratchpad for compact intermediate notes only when research spans multiple sources.',
    tools: {
      ...ziloDocsTools,
      docsSearch: docsSearchTool,
      docsFetch: docsFetchTool,
      webSearch: webSearchTool,
      webExtract: webExtractTool,
      webMap: webMapTool,
      webCrawl: webCrawlTool,
      deepResearch: deepResearchTool,
      appKnowledge: appKnowledgeTool,
      ...scratchpadTools,
    },
    stopWhen: stepCountIs(8),
  });
}
