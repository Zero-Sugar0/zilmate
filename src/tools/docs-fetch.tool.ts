import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tool } from 'ai';
import { z } from 'zod';
import { clampText, limits } from '../safety/limits.js';
import { emitProgress } from '../runtime/progress.js';

const allowedHosts = new Set([
  'ai-sdk.dev',
  'sdk.vercel.ai',
  'vercel.com',
  'developers.openai.com',
  'platform.openai.com',
  'openai.com',
  'upstash.com',
]);

const cacheDir = path.resolve('.zilo-manager', 'docs-cache');

function cacheName(url: string) {
  return Buffer.from(url).toString('base64url').slice(0, 160) + '.txt';
}

export function assertAllowedDocsUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (!allowedHosts.has(url.hostname)) {
    throw new Error(`Docs fetch blocked for non-allowlisted host: ${url.hostname}`);
  }
  return url.toString();
}

export async function fetchDocsText(rawUrl: string) {
  const url = assertAllowedDocsUrl(rawUrl);
  await mkdir(cacheDir, { recursive: true });
  const file = path.join(cacheDir, cacheName(url));
  try {
    const cached = JSON.parse(await readFile(file, 'utf8')) as { fetchedAt: number; text: string };
    if (Date.now() - cached.fetchedAt < limits.docsCacheTtlMs) {
      emitProgress({ type: 'fetch:end', label: 'Loaded docs from cache', detail: url });
      return cached.text;
    }
  } catch {
    // cache miss
  }

  emitProgress({ type: 'fetch:start', label: 'Fetching docs', detail: url });
  const response = await fetch(url, { headers: { accept: 'text/plain,text/markdown,text/html' } });
  if (!response.ok) throw new Error(`Docs fetch failed ${response.status}: ${url}`);
  const html = await response.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const clipped = clampText(text, 12000);
  await writeFile(file, JSON.stringify({ fetchedAt: Date.now(), text: clipped }, null, 2), 'utf8');
  emitProgress({ type: 'fetch:end', label: 'Docs fetched', detail: url });
  return clipped;
}

export const docsFetchTool = tool({
  description: 'Fetch and cache allowlisted documentation pages. Use only for docs/reference sources.',
  inputSchema: z.object({ url: z.string().url() }),
  execute: async ({ url }) => fetchDocsText(url),
});
