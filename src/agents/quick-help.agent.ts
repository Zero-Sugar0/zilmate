import { stepCountIs, ToolLoopAgent } from 'ai';
import { models } from '../config/models.js';
import { appKnowledgeTool } from '../tools/app-knowledge.tool.js';
import { ziloDocsTools } from '../tools/zilo-docs.tool.js';
import { timeTools } from '../tools/time.tool.js';
import { limits } from '../safety/limits.js';

export async function createQuickHelpAgent() {
  return new ToolLoopAgent({
    model: models.help,
    instructions: 'You are ZilMate Quick Help. Give short, practical troubleshooting answers for ZiloShift operators. Prefer local ZiloShift docs before app knowledge. Use getCurrentTime when the user asks for current date/time or relative schedule wording. Ask for missing details only when required. If the issue involves safety, money, identity, fraud, legal risk, or a platform bug, give clear next steps and say it should be escalated to the ZiloShift team.',
    tools: {
      ...ziloDocsTools,
      ...timeTools,
      appKnowledge: appKnowledgeTool,
    },
    stopWhen: stepCountIs(limits.subagentSteps),
  });
}

