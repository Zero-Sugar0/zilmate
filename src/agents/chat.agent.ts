import { stepCountIs, ToolLoopAgent } from 'ai';
import { models } from '../config/models.js';
import { appKnowledgeTool } from '../tools/app-knowledge.tool.js';
import { ziloDocsTools } from '../tools/zilo-docs.tool.js';

export function createChatAgent() {
  return new ToolLoopAgent({
    model: models.chat,
    instructions: 'You are the ZiloShift conversational app guide. Explain workflows for workers, venues, admin operations, payments, disputes, shifts, onboarding, and launch tasks in a calm practical tone. Use local ZiloShift docs on demand for accurate product behavior instead of guessing. Keep answers practical and do not dump long docs into the response.',
    tools: {
      ...ziloDocsTools,
      appKnowledge: appKnowledgeTool,
    },
    stopWhen: stepCountIs(6),
  });
}
