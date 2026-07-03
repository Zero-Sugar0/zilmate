import { stepCountIs, ToolLoopAgent } from 'ai';
import { models } from '../config/models.js';
import { appKnowledgeTool } from '../tools/app-knowledge.tool.js';
import { ziloDocsTools } from '../tools/zilo-docs.tool.js';
import { timeTools } from '../tools/time.tool.js';
import { limits } from '../safety/limits.js';

export async function createChatAgent() {
  return new ToolLoopAgent({
    model: models.chat,
    instructions: 'You are the ZiloShift conversational app guide. Explain workflows for workers, venues, admin operations, payments, disputes, shifts, onboarding, and launch tasks in a calm practical tone. Use local ZiloShift docs on demand for accurate product behavior instead of guessing. Use getCurrentTime when the user asks for current date/time or relative schedule wording. Keep answers practical and do not dump long docs into the response.',
    tools: {
      ...ziloDocsTools,
      ...timeTools,
      appKnowledge: appKnowledgeTool,
    },
    stopWhen: stepCountIs(limits.subagentSteps),
  });
}
