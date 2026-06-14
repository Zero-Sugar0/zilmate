import { appendFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { workspaceLayout } from '../workspace/paths.js';

export type TrustAction = {
  id: string;
  action: string;
  category: 'destructive' | 'outbound' | 'os-control' | 'other';
  reversible: boolean;
  undoHint?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
  undoneAt?: string;
};

const DEFAULT_UNDO_MS = Number(process.env.ZILMATE_UNDO_WINDOW_MS || 30_000);

async function appendTrust(action: TrustAction) {
  await appendFile(workspaceLayout().trustLog, `${JSON.stringify(action)}\n`, 'utf8');
}

export async function logTrustAction(input: {
  action: string;
  category?: TrustAction['category'];
  reversible?: boolean;
  undoHint?: string;
  metadata?: Record<string, unknown>;
  undoWindowMs?: number;
}) {
  const now = Date.now();
  const windowMs = input.undoWindowMs ?? DEFAULT_UNDO_MS;
  const entry: TrustAction = {
    id: `trust_${now}`,
    action: input.action,
    category: input.category ?? 'other',
    reversible: input.reversible ?? false,
    ...(input.undoHint ? { undoHint: input.undoHint } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + windowMs).toISOString(),
  };
  await appendTrust(entry);
  return entry;
}

export async function listActiveTrustActions() {
  const path = workspaceLayout().trustLog;
  if (!existsSync(path)) return [];
  const now = Date.now();
  const lines = (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean);
  return lines
    .map((line) => JSON.parse(line) as TrustAction)
    .filter((action) => !action.undoneAt && new Date(action.expiresAt).getTime() > now);
}

export async function markTrustActionUndone(id: string) {
  const path = workspaceLayout().trustLog;
  if (!existsSync(path)) return null;
  const lines = (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean);
  let updated: TrustAction | null = null;
  const next = lines.map((line) => {
    const action = JSON.parse(line) as TrustAction;
    if (action.id === id && !action.undoneAt) {
      updated = { ...action, undoneAt: new Date().toISOString() };
      return JSON.stringify(updated);
    }
    return line;
  });
  if (updated) {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path, `${next.join('\n')}\n`, 'utf8');
  }
  return updated;
}

export function trustUndoWindowMs() {
  return DEFAULT_UNDO_MS;
}
