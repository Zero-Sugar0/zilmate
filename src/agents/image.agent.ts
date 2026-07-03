import { stepCountIs, ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';
import { generateText } from 'ai';
import { models } from '../config/models.js';
import { imageGenerateTool } from '../tools/image-generate.tool.js';
import { imageIntelligenceTools } from '../tools/image-intelligence.tool.js';
import { multimediaTools } from '../tools/multimedia.tool.js';
import { limits } from '../safety/limits.js';
import { emitProgress } from '../runtime/progress.js';

const stylePresets = {
  product: 'Clean product photography, studio lighting, crisp detail, commercial quality, exact subject fidelity.',
  cinematic: 'Cinematic composition, dramatic lighting, rich color grading, shallow depth of field.',
  ui: 'Modern UI mockup, sharp typography, realistic device frame, professional SaaS marketing visual.',
  illustration: 'Polished digital illustration, cohesive palette, readable shapes, premium editorial style.',
  photoreal: 'Photorealistic, natural lighting, accurate materials, high resolution, no artifacts.',
};

export async function createImageAgent() {
  return new ToolLoopAgent({
    model: models.manager,
    instructions: [
      'You are ZilMate Image Director — craft prompts that produce stunning, exact visuals for the user intent.',
      'Before generating: clarify subject, composition, style, lighting, colors, aspect ratio, and must-include details.',
      'Use enhanceImagePrompt when the user brief is vague. Preserve user intent; do not drift to unrelated aesthetics.',
      'Use generateImage for final output. Pass imagePaths/imageUrls for edits; pass maskPath for inpainting.',
      'Use removeBackground when local background isolation is needed or when creating transparent product assets/cutouts.',
      'Use optimizeImage to compress, resize, format-convert, or watermark images for fast-loading web apps and pristine SEO standards.',
      'Pick provider deliberately: openai/chatgpt for precise edits; gemini/google for rich conceptual visuals.',
      'Return saved file paths, provider/model used, and a one-line description of what was created.',
    ].join(' '),
    tools: {
      enhanceImagePrompt: tool({
        description: 'Turn a rough idea into a production-grade image prompt with composition, lighting, style, and constraints.',
        inputSchema: z.object({
          idea: z.string().min(3),
          style: z.enum(['product', 'cinematic', 'ui', 'illustration', 'photoreal']).optional(),
          mustInclude: z.array(z.string()).optional(),
          avoid: z.array(z.string()).optional(),
        }),
        execute: async ({ idea, style, mustInclude, avoid }) => {
          emitProgress({ type: 'step', label: 'Enhancing image prompt' });
          const result = await generateText({
            model: models.manager,
            prompt: `Create one detailed image generation prompt.\nIdea: ${idea}\nStyle: ${style ? stylePresets[style] : 'best fit for idea'}\nMust include: ${(mustInclude ?? []).join(', ') || 'none'}\nAvoid: ${(avoid ?? []).join(', ') || 'blur, text gibberish, extra limbs'}`,
          });
          return { prompt: result.text.trim(), style: style || 'auto' };
        },
      }),
      generateImage: imageGenerateTool,
      removeBackground: imageIntelligenceTools.removeBackground,
      optimizeImage: multimediaTools.optimizeImage,
    },
    stopWhen: stepCountIs(limits.subagentSteps),
  });
}
