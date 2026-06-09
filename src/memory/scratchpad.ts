import { appendText, readJson } from './local-store.js';
import { getRedis } from './redis.js';

const scratchTtlSeconds = 60 * 60 * 24;

export async function readScratchpad(runId: string) {
  const redis = getRedis();
  if (redis) return (await redis.get<string>(`zilo-manager:scratch:${runId}`)) || '(empty)';
  const note = await readJson<{ text: string }>(`scratch-${runId}.json`, { text: '' });
  return note.text || '(empty)';
}

export async function appendScratchpad(runId: string, text: string) {
  const redis = getRedis();
  if (redis) {
    const key = `zilo-manager:scratch:${runId}`;
    await redis.append(key, `\n${text}`);
    await redis.expire(key, scratchTtlSeconds);
    return 'Appended.';
  }
  await appendText(`scratch-${runId}.json`, text);
  return 'Appended.';
}