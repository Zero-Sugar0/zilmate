export interface StorageProvider {
  name: string;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}

export class KeyValueStorage {
  constructor(private provider: StorageProvider) {}

  async get<T>(key: string): Promise<T | null> {
    return this.provider.get<T>(key);
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.provider.set(key, value);
  }

  async delete(key: string): Promise<void> {
    await this.provider.delete(key);
  }

  async list(prefix?: string): Promise<string[]> {
    return this.provider.list(prefix);
  }
}
