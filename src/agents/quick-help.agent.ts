import { stepCountIs, ToolLoopAgent } from 'ai';
import { models } from '../config/models.js';
import { appKnowledgeTool } from '../tools/app-knowledge.tool.js';
import { ziloDocsTools } from '../tools/zilo-docs.tool.js';

export function createQuickHelpAgent() {
  return new ToolLoopAgent({
    model: models.help,
    instructions: 'You are ZilMate Quick Help. Give short, practical troubleshooting answers for ZiloShift operators. Prefer local ZiloShift docs before app knowledge. Ask for missing details only when required. If the issue involves safety, money, identity, fraud, legal risk, or a platform bug, give clear next steps and say it should be escalated to the ZiloShift team.',
    tools: {
      ...ziloDocsTools,
      appKnowledge: appKnowledgeTool,
    },
    stopWhen: stepCountIs(5),
  });
}

