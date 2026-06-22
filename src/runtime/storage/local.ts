import { readFile, writeFile, unlink, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { StorageProvider } from './interface.js';

export class LocalFileStorage implements StorageProvider {
  name = 'local';

  constructor(private rootDir: string) {
    if (!existsSync(rootDir)) {
      mkdir(rootDir, { recursive: true }).catch(() => undefined);
    }
  }

  private getPath(key: string) {
    return path.join(this.rootDir, `${key.replace(/:/g, '_')}.json`);
  }

  async get<T>(key: string): Promise<T | null> {
    const filePath = this.getPath(key);
    if (!existsSync(filePath)) return null;
    try {
      const data = await readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    const filePath = this.getPath(key);
    await writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getPath(key);
    if (existsSync(filePath)) {
      await unlink(filePath);
    }
  }

  async list(prefix?: string): Promise<string[]> {
    if (!existsSync(this.rootDir)) return [];
    const files = await readdir(this.rootDir);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', '').replace(/_/g, ':'))
      .filter(k => !prefix || k.startsWith(prefix));
  }
}
