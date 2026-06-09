import type { UIMessage } from 'ai';
import { readJson, writeJson } from './local-store.js';
import { getRedis } from './redis.js';

const historyTtlSeconds = 60 * 60 * 24 * 30;

export type ChatTurn = {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export async function loadHistory(sessionId: string) {
  const redis = getRedis();
  if (redis) return (await redis.get<UIMessage[]>(`zilo-manager:ui-history:${sessionId}`)) ?? [];
  return readJson<UIMessage[]>(`history-${sessionId}.json`, []);
}

export async function saveHistory(sessionId: string, messages: UIMessage[]) {
  const redis = getRedis();
  if (redis) {
    await redis.set(`zilo-manager:ui-history:${sessionId}`, messages, { ex: historyTtlSeconds });
    return;
  }
  await writeJson(`history-${sessionId}.json`, messages);
}

export async function loadTurns(sessionId: string) {
  const redis = getRedis();
  if (redis) return (await redis.get<ChatTurn[]>(`zilo-manager:turns:${sessionId}`)) ?? [];
  return readJson<ChatTurn[]>(`turns-${sessionId}.json`, []);
}

export async function saveTurns(sessionId: string, turns: ChatTurn[]) {
  const redis = getRedis();
  const trimmed = turns.slice(-20);
  if (redis) {
    await redis.set(`zilo-manager:turns:${sessionId}`, trimmed, { ex: historyTtlSeconds });
    return;
  }
  await writeJson(`turns-${sessionId}.json`, trimmed);
}