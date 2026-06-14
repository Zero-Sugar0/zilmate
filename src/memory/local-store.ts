import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { workspaceLayout, legacyDataRoot } from '../workspace/paths.js';

function dataRoot() {
  const layout = workspaceLayout();
  return layout.data;
}

async function ensureRoot() {
  const root = dataRoot();
  await mkdir(root, { recursive: true });
  return root;
}

function legacyFile(file: string) {
  return path.join(legacyDataRoot(), file);
}

function workspaceFile(file: string) {
  return path.join(dataRoot(), file);
}

async function readFromStores<T>(file: string, fallback: T): Promise<T> {
  const primary = workspaceFile(file);
  if (existsSync(primary)) {
    try {
      return JSON.parse(await readFile(primary, 'utf8')) as T;
    } catch {
      return fallback;
    }
  }
  const legacy = legacyFile(file);
  if (existsSync(legacy)) {
    try {
      const value = JSON.parse(await readFile(legacy, 'utf8')) as T;
      await writeJson(file, value);
      return value;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  return readFromStores(file, fallback);
}

export async function writeJson(file: string, value: unknown) {
  await ensureRoot();
  await writeFile(workspaceFile(file), JSON.stringify(value, null, 2), 'utf8');
}

export async function appendText(file: string, value: string) {
  const current = await readJson<{ text: string }>(file, { text: '' });
  await writeJson(file, { text: `${current.text}\n${value}`.trim() });
}

export function getLocalDataRoot() {
  return dataRoot();
}
