import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { generateImage, generateText, tool } from 'ai';
import { z } from 'zod';
import { models } from '../config/models.js';
import { getOutputDir } from '../workspace/output-paths.js';
import { requireGatewayAuth, type ImageProvider } from '../config/env.js';
import { redactSensitiveText } from '../safety/redaction.js';
import { emitProgress } from '../runtime/progress.js';

export type ImageProviderInput = ImageProvider | 'chatgpt' | 'google' | 'default';
export type ImageSize = `${number}x${number}`;

export type ImageGenerationOptions = {
  provider?: ImageProviderInput | undefined;
  size?: ImageSize | undefined;
  outputDir?: string | undefined;
};

export type ImageGenerationResult = {
  text?: string;
  files: string[];
  model: string;
  provider: ImageProvider;
};

export function isImageSize(value: string | undefined): value is ImageSize {
  return /^\d+x\d+$/.test(value || '');
}

function normalizeProvider(provider: ImageProviderInput | undefined): ImageProvider {
  const value = (provider || models.imageDefaultProvider || 'openai').toLowerCase().trim();
  if (value === 'default') return models.imageDefaultProvider;
  if (value === 'chatgpt' || value === 'openai') return 'openai';
  if (value === 'google' || value === 'gemini') return 'gemini';
  throw new Error(`Unsupported image provider: ${provider}. Use openai, chatgpt, or gemini.`);
}

function extensionFromMediaType(mediaType: string | undefined) {
  const value = mediaType?.split('/')[1]?.split(';')[0];
  if (!value) return 'png';
  if (value === 'jpeg') return 'jpg';
  return value;
}

function toBuffer(data: Uint8Array | ArrayBuffer | Buffer | string) {
  if (typeof data === 'string') return Buffer.from(data, 'base64');
  if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data));
  return Buffer.from(data);
}

async function saveImageBytes(data: Uint8Array | ArrayBuffer | Buffer | string, mediaType: string | undefined, outputDir: string, index: number) {
  const extension = extensionFromMediaType(mediaType);
  const filename = `zilo-image-${Date.now()}-${index}.${extension}`;
  const target = path.join(outputDir, filename);
  await writeFile(target, toBuffer(data));
  return target;
}

async function generateOpenAiImage(prompt: string, outputDir: string, size?: ImageSize): Promise<ImageGenerationResult> {
  const model = models.imageOpenai;
  emitProgress({ type: 'tool:start', label: 'Generating OpenAI image', detail: model });
  const result = await generateImage({
    model,
    prompt: redactSensitiveText(prompt),
    ...(size ? { size } : {}),
    providerOptions: {
      gateway: {
        tags: ['zilo-manager', 'feature:image', 'model:openai'],
      },
    },
  });

  const saved: string[] = [];
  for (const [index, image] of result.images.entries()) {
    const value = image as unknown as { uint8Array?: Uint8Array; data?: Uint8Array | ArrayBuffer | string; base64?: string; mediaType?: string };
    const data = value.uint8Array || value.data || value.base64;
    if (!data) continue;
    saved.push(await saveImageBytes(data, value.mediaType || image.mediaType, outputDir, index));
  }

  emitProgress({ type: 'tool:end', label: 'OpenAI image generation complete', detail: `${saved.length} file${saved.length === 1 ? '' : 's'}` });
  return { files: saved, model, provider: 'openai' };
}

async function generateGeminiImage(prompt: string, outputDir: string): Promise<ImageGenerationResult> {
  const model = models.imageGemini;
  emitProgress({ type: 'tool:start', label: 'Generating Gemini image', detail: model });
  const result = await generateText({
    model,
    prompt: redactSensitiveText(prompt),
    providerOptions: {
      gateway: {
        tags: ['zilo-manager', 'feature:image', 'model:gemini'],
      },
    },
  });

  const files = (result.files || []).filter((file) => file.mediaType?.startsWith('image/'));
  const saved: string[] = [];
  for (const [index, file] of files.entries()) {
    const value = file as unknown as { uint8Array?: Uint8Array; data?: Uint8Array | ArrayBuffer | string; base64?: string; mediaType?: string };
    const data = value.uint8Array || value.data || value.base64;
    if (!data) continue;
    saved.push(await saveImageBytes(data, value.mediaType || file.mediaType, outputDir, index));
  }

  emitProgress({ type: 'tool:end', label: 'Gemini image generation complete', detail: `${saved.length} file${saved.length === 1 ? '' : 's'}` });
  return { text: result.text, files: saved, model, provider: 'gemini' };
}

export async function generateImageAsset(prompt: string, options: ImageGenerationOptions = {}): Promise<ImageGenerationResult> {
  requireGatewayAuth();
  const outputDir = options.outputDir || getOutputDir('images');
  await mkdir(outputDir, { recursive: true });
  const provider = normalizeProvider(options.provider);
  if (provider === 'gemini') return generateGeminiImage(prompt, outputDir);
  return generateOpenAiImage(prompt, outputDir, options.size);
}

export const imageGenerateTool = tool({
  description: 'Generate a high-quality image with OpenAI GPT Image 2 or Gemini 3 Pro Image and save it locally.',
  inputSchema: z.object({
    prompt: z.string().min(5),
    provider: z.enum(['openai', 'chatgpt', 'gemini', 'google', 'default']).optional(),
    size: z.string().regex(/^\d+x\d+$/).optional(),
  }),
  execute: async ({ prompt, provider, size }) => generateImageAsset(prompt, {
    ...(provider ? { provider } : {}),
    ...(isImageSize(size) ? { size } : {}),
  }),
});
