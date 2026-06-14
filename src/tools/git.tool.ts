import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { tool } from 'ai';
import { z } from 'zod';
import { emitProgress } from '../runtime/progress.js';
import { requestConfirmation } from '../runtime/confirm.js';

function runGit(cwd: string, args: string[], timeoutMs = 60_000, stdin?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      stdio: [stdin !== undefined ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      windowsHide: true,
      shell: process.platform === 'win32',
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    let out = '';
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (c) => { out += c; });
    child.stderr?.on('data', (c) => { out += c; });
    child.on('error', reject);
    if (stdin !== undefined && child.stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`git timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 || out.trim()) resolve(out);
      else reject(new Error(out.trim() || `git exited ${code}`));
    });
  });
}

async function confirmGitWrite(action: string, details: string[]) {
  return requestConfirmation({
    toolkitSlug: 'ZILMATE',
    toolSlug: 'GIT',
    action,
    access: 'Write',
    targetTools: ['ZILMATE_GIT'],
    details,
    summary: details.join('; '),
  });
}

function resolveRepo(cwd?: string) {
  return cwd ? path.resolve(cwd) : process.cwd();
}

export const gitTools = {
  gitStatus: tool({
    description: 'Show git status (branch, staged/unstaged files). Use before edits or commits.',
    inputSchema: z.object({
      cwd: z.string().optional().describe('Repository root; defaults to current directory'),
      short: z.boolean().optional().default(true),
    }),
    execute: async ({ cwd, short }) => {
      emitProgress({ type: 'fetch:start', label: 'Git status' });
      const root = resolveRepo(cwd);
      const args = short ? ['status', '-sb'] : ['status'];
      const output = await runGit(root, args);
      emitProgress({ type: 'fetch:end', label: 'Git status loaded' });
      return { cwd: root, output };
    },
  }),

  gitDiff: tool({
    description: 'Show git diff for unstaged, staged, or specific paths. Prefer this over rewriting whole files.',
    inputSchema: z.object({
      cwd: z.string().optional(),
      staged: z.boolean().optional().default(false),
      path: z.string().optional(),
      commit: z.string().optional().describe('Compare against a commit, e.g. HEAD~1'),
    }),
    execute: async ({ cwd, staged, path: filePath, commit }) => {
      emitProgress({ type: 'fetch:start', label: 'Git diff' });
      const root = resolveRepo(cwd);
      const args = ['diff'];
      if (staged) args.push('--cached');
      if (commit) args.push(commit);
      if (filePath) args.push('--', filePath);
      const output = await runGit(root, args, 120_000);
      emitProgress({ type: 'fetch:end', label: 'Git diff loaded' });
      return { cwd: root, output: output.slice(0, 12_000) };
    },
  }),

  gitLog: tool({
    description: 'Show recent git commits on the current branch.',
    inputSchema: z.object({
      cwd: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional().default(10),
      path: z.string().optional(),
    }),
    execute: async ({ cwd, limit, path: filePath }) => {
      const root = resolveRepo(cwd);
      const args = ['log', '--oneline', '-n', String(limit)];
      if (filePath) args.push('--', filePath);
      const output = await runGit(root, args);
      return { cwd: root, output };
    },
  }),

  gitBranch: tool({
    description: 'List, create, or checkout git branches.',
    inputSchema: z.object({
      cwd: z.string().optional(),
      action: z.enum(['list', 'create', 'checkout']).default('list'),
      name: z.string().optional(),
    }),
    execute: async ({ cwd, action, name }) => {
      const root = resolveRepo(cwd);
      if (action === 'list') {
        const output = await runGit(root, ['branch', '-vv']);
        return { cwd: root, branches: output };
      }
      if (!name) throw new Error('Branch name is required for create/checkout.');
      if (action === 'create' || action === 'checkout') {
        const approved = await confirmGitWrite(`${action} branch ${name}`, [`Branch: ${name}`, `Repo: ${root}`]);
        if (!approved) throw new Error('Branch change blocked by user.');
      }
      const args = action === 'create' ? ['checkout', '-b', name] : ['checkout', name];
      const output = await runGit(root, args);
      return { cwd: root, action, name, output };
    },
  }),

  gitStage: tool({
    description: 'Stage files for commit (git add). Requires confirmation.',
    inputSchema: z.object({
      cwd: z.string().optional(),
      paths: z.array(z.string()).min(1),
    }),
    execute: async ({ cwd, paths }) => {
      const root = resolveRepo(cwd);
      const approved = await confirmGitWrite('Stage files for commit', paths.map((p) => `Stage: ${p}`));
      if (!approved) throw new Error('Staging blocked by user.');
      const output = await runGit(root, ['add', '--', ...paths]);
      return { cwd: root, staged: paths, output: output || 'Staged.' };
    },
  }),

  gitCommit: tool({
    description: 'Create a git commit with a message. Requires confirmation. Does not push.',
    inputSchema: z.object({
      cwd: z.string().optional(),
      message: z.string().min(3),
    }),
    execute: async ({ cwd, message }) => {
      const root = resolveRepo(cwd);
      const approved = await confirmGitWrite('Create git commit', [`Message: ${message.slice(0, 120)}`]);
      if (!approved) throw new Error('Commit blocked by user.');
      const output = await runGit(root, ['commit', '-m', message]);
      return { cwd: root, message, output };
    },
  }),

  applyUnifiedPatch: tool({
    description: 'Apply a unified diff patch to the working tree via git apply. Prefer over full file rewrites.',
    inputSchema: z.object({
      cwd: z.string().optional(),
      patch: z.string().min(1).describe('Unified diff content'),
      dryRun: z.boolean().optional().default(false),
    }),
    execute: async ({ cwd, patch, dryRun }) => {
      const root = resolveRepo(cwd);
      if (dryRun) {
        const check = await runGit(root, ['apply', '--check', '--whitespace=fix', '-'], 30_000, patch).catch((e) => String(e));
        return { dryRun: true, cwd: root, check };
      }
      const approved = await confirmGitWrite('Apply unified patch', [
        `Repo: ${root}`,
        `Patch size: ${patch.length} chars`,
      ]);
      if (!approved) throw new Error('Patch blocked by user.');

      emitProgress({ type: 'tool:start', label: 'Applying patch' });
      const output = await runGit(root, ['apply', '--whitespace=fix', '-'], 30_000, patch);
      emitProgress({ type: 'tool:end', label: 'Patch applied' });
      return { cwd: root, applied: true, output };
    },
  }),
};
