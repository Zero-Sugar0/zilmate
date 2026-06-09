import { Redis } from '@upstash/redis';
import { env, hasRedis } from '../config/env.js';

let client: Redis | null | undefined;

export function getRedis() {
  if (!hasRedis()) return null;
  if (client !== undefined) return client;
  client = new Redis({
    url: env.upstashRedisRestUrl!,
    token: env.upstashRedisRestToken!,
  });
  return client;
}

export function memoryBackendName() {
  return hasRedis() ? 'redis' : 'local-file';
}