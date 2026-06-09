import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('.zilo-manager');

async function ensureRoot() {
  await mkdir(root, { recursive: true });
}

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path.join(root, file), 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(file: string, value: unknown) {
  await ensureRoot();
  await writeFile(path.join(root, file), JSON.stringify(value, null, 2), 'utf8');
}

export async function appendText(file: string, value: string) {
  const current = await readJson<{ text: string }>(file, { text: '' });
  await writeJson(file, { text: `${current.text}\n${value}`.trim() });
}
