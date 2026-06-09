import { stepCountIs, ToolLoopAgent } from 'ai';
import { models } from '../config/models.js';
import { imageGenerateTool } from '../tools/image-generate.tool.js';

export function createImageAgent() {
  return new ToolLoopAgent({
    model: models.manager,
    instructions: 'You are the ZiloShift image agent. Improve the user image prompt when useful, then call generateImage. Use Gemini 3 Pro Image via Gateway. Do not claim GPT-2 can generate images.',
    tools: { generateImage: imageGenerateTool },
    stopWhen: stepCountIs(4),
  });
}
