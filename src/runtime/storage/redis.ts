import { Redis } from '@upstash/redis';
import type { StorageProvider } from './interface.js';

export class RedisStorage implements StorageProvider {
  name = 'redis';
  private client: Redis;

  constructor(url: string, token: string) {
    this.client = new Redis({ url, token });
  }

  async get<T>(key: string): Promise<T | null> {
    return this.client.get<T>(key);
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.client.set(key, value);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async list(prefix?: string): Promise<string[]> {
    return this.client.keys(prefix ? `${prefix}*` : '*');
  }
}
