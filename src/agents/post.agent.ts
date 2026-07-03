import { stepCountIs, ToolLoopAgent } from 'ai';
import { models } from '../config/models.js';
import { postGenerateTool } from '../tools/post-generate.tool.js';
import { limits } from '../safety/limits.js';

export async function createPostAgent() {
  return new ToolLoopAgent({
    model: models.post,
    instructions: 'You create concise, useful ZiloShift social posts, WhatsApp statuses, campaign copy, and launch messages. Keep language clear and Ghana-friendly when requested.',
    tools: { generatePost: postGenerateTool },
    stopWhen: stepCountIs(limits.subagentSteps),
  });
}
