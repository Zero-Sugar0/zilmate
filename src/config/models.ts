import { gateway } from 'ai';
import { env, type ImageProvider } from './env.js';

export type ModelRegistry = {
  manager: string;
  help: string;
  post: string;
  chat: string;
  research: string;
  imageDefaultProvider: ImageProvider;
  imageOpenai: string;
  imageGemini: string;
  image: string;
};

const cheapModelCandidates = [
  'openai/gpt-5.4-mini',
  'google/gemini-3-flash',
  'xai/grok-4.1-fast',
  'mistral/mistral-small-latest',
];

export const models: ModelRegistry = {
  manager: env.managerModel,
  help: env.helpModel || cheapModelCandidates[0]!,
  post: env.postModel || cheapModelCandidates[0]!,
  chat: env.helpModel || env.managerModel,
  research: env.managerModel,
  imageDefaultProvider: env.imageDefaultProvider,
  imageOpenai: env.imageOpenaiModel,
  imageGemini: env.imageGeminiModel,
  image: env.imageDefaultProvider === 'gemini' ? env.imageGeminiModel : env.imageOpenaiModel,
};

export type ModelAvailability = {
  selected: ModelRegistry;
  availableIds: string[];
  missing: string[];
  warnings: string[];
};

export async function getModelAvailability(): Promise<ModelAvailability> {
  const result = await gateway.getAvailableModels();
  const rawModels = Array.isArray(result) ? result : ((result as { models?: unknown[] }).models || []);
  const availableIds = rawModels
    .map((model) => typeof model === 'string' ? model : (model as { id?: string }).id)
    .filter((id): id is string => Boolean(id));

  const selected = Object.entries(models)
    .filter(([key]) => key !== 'imageDefaultProvider')
    .map(([, value]) => value);
  const missing = selected.filter((id, index) => selected.indexOf(id) === index && !availableIds.includes(id));
  const warnings = missing.map((id) => `Configured model not reported by Gateway: ${id}`);

  return { selected: models, availableIds, missing, warnings };
}

export function pickAvailableTextModel(availableIds: string[], preferred?: string) {
  if (preferred && availableIds.includes(preferred)) return preferred;
  return cheapModelCandidates.find((id) => availableIds.includes(id)) || preferred || models.help;
}
