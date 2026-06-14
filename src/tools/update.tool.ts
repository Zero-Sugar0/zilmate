import { tool } from 'ai';
import { z } from 'zod';
import { compareVersions, latestNpmVersion, runSelfUpdate } from '../cli/update.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitProgress } from '../runtime/progress.js';

async function currentPackageVersion() {
  try {
    const pkg = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json');
    const raw = await readFile(pkg, 'utf8');
    return (JSON.parse(raw) as { version?: string }).version || 'unknown';
  } catch {
    return 'unknown';
  }
}

export const updateTools = {
  checkForUpdate: tool({
    description: 'Check npm for a newer ZilMate version without installing.',
    inputSchema: z.object({}),
    execute: async () => {
      const current = await currentPackageVersion();
      try {
        const latest = await latestNpmVersion();
        return {
          current,
          latest,
          updateAvailable: compareVersions(current, latest) < 0,
          command: 'zilmate update',
        };
      } catch (error) {
        return {
          current,
          latest: null,
          updateAvailable: false,
          error: error instanceof Error ? error.message : String(error),
          command: 'npm install -g zilmate@latest',
        };
      }
    },
  }),

  selfUpdate: tool({
    description: 'Update ZilMate CLI from npm (global install). Ask user confirmation before running.',
    inputSchema: z.object({
      tag: z.string().optional(),
      dryRun: z.boolean().optional(),
      confirmed: z.boolean().describe('User explicitly confirmed the update'),
    }),
    execute: async ({ tag, dryRun, confirmed }) => {
      if (!dryRun && !confirmed) {
        throw new Error('Self-update requires confirmed=true after the user agrees.');
      }
      emitProgress({ type: 'step', label: dryRun ? 'Update dry run' : 'Updating ZilMate' });
      await runSelfUpdate({
        ...(tag ? { tag } : {}),
        dryRun: Boolean(dryRun),
      });
      return { ok: true, dryRun: Boolean(dryRun), tag: tag || 'latest' };
    },
  }),
};
