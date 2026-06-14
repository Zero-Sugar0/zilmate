import { tool } from 'ai';
import { z } from 'zod';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { runDoctor } from '../cli/doctor.js';
import { initWorkspace } from '../workspace/init.js';
import { workspaceLayout } from '../workspace/paths.js';
import { hasComposio, hasDeepgram, hasGatewayAuth, hasQStash, hasRedis, env } from '../config/env.js';
import { cloudflareTunnelDoctor } from '../cli/tunnel.js';
import { emitProgress } from '../runtime/progress.js';

const SECRET_KEYS = new Set([
  'AI_GATEWAY_API_KEY',
  'COMPOSIO_API_KEY',
  'TAVILY_API_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'UPSTASH_QSTASH_TOKEN',
  'ZILMATE_JOB_WEBHOOK_SECRET',
  'DEEPGRAM_API_KEY',
  'VERCEL_OIDC_TOKEN',
]);

const SAFE_SETTINGS = new Set([
  'ZILMATE_JOBS_ENABLED',
  'ZILMATE_TRIGGER_WORKFLOWS_ENABLED',
  'ZILMATE_VOICE_ENABLED',
  'ZILMATE_WORKSPACE',
  'ZILMATE_WEBHOOK_PORT',
  'ZILMATE_FILE_ROOTS',
  'ZILO_MANAGER_MODEL',
  'ZILO_HELP_MODEL',
  'ZILO_CODING_MODEL',
  'ZILMATE_VOICE_LISTEN_MODEL',
  'ZILMATE_VOICE_TTS_MODEL',
  'ZILMATE_VOICE_LANGUAGE',
]);

function parseEnv(content: string) {
  const values = new Map<string, string>();
  for (const line of content.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) values.set(match[1]!, match[2]!.replace(/^"(.*)"$/, '$1'));
  }
  return values;
}

async function readEnvFile(envPath = '.env') {
  if (!existsSync(envPath)) return new Map<string, string>();
  return parseEnv(await readFile(envPath, 'utf8'));
}

async function upsertEnvKey(envPath: string, key: string, value: string) {
  const lines = existsSync(envPath) ? (await readFile(envPath, 'utf8')).split(/\r?\n/) : [];
  let found = false;
  const next = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) next.push(`${key}=${value}`);
  await writeFile(envPath, `${next.filter((line, index, arr) => line.length > 0 || index < arr.length - 1).join('\n')}\n`, 'utf8');
}

export const setupAssistantTools = {
  checkSetupStatus: tool({
    description: 'Audit ZilMate setup: workspace, gateway, Composio, Redis, jobs, QStash, voice, tunnel readiness. Never returns secret values.',
    inputSchema: z.object({ live: z.boolean().optional() }),
    execute: async ({ live }) => {
      emitProgress({ type: 'step', label: 'Checking setup status' });
      const layout = workspaceLayout();
      const doctor = await runDoctor({ live: Boolean(live) });
      const tunnel = await cloudflareTunnelDoctor();
      return {
        workspace: { root: layout.root, exists: existsSync(layout.root) },
        configured: {
          gateway: hasGatewayAuth(),
          composio: hasComposio(),
          redis: hasRedis(),
          jobs: env.zilmateJobsEnabled,
          qstash: hasQStash(),
          triggers: env.zilmateTriggerWorkflowsEnabled,
          voice: env.zilmateVoiceEnabled && hasDeepgram(),
        },
        doctor,
        tunnel,
        secureSetupHint: 'For API keys and tokens, tell the user to run `zilmate setup` — secrets are never sent to the agent.',
      };
    },
  }),

  launchSecureSetup: tool({
    description: 'Direct the user to interactive setup for secrets (API keys, tokens). The agent never sees entered secrets.',
    inputSchema: z.object({
      section: z.enum(['all', 'gateway', 'composio', 'tavily', 'redis', 'jobs', 'qstash', 'voice', 'workspace']).optional(),
    }),
    execute: async ({ section }) => ({
      instruction: section && section !== 'all'
        ? `Run \`zilmate setup\` and complete the "${section}" section. Secrets are entered in your terminal only.`
        : 'Run `zilmate setup` in your terminal to configure API keys and optional services. You can skip any section.',
      command: 'zilmate setup',
      note: 'Stop the agent chat if you prefer a private setup session. Keys are stored in .env locally.',
    }),
  }),

  configureSafeSetting: tool({
    description: 'Update non-secret .env settings (jobs enabled, models, workspace path). Cannot set API keys or tokens.',
    inputSchema: z.object({
      key: z.string(),
      value: z.string(),
      envPath: z.string().optional(),
    }),
    execute: async ({ key, value, envPath = '.env' }) => {
      if (SECRET_KEYS.has(key)) {
        throw new Error(`${key} is a secret. Use launchSecureSetup — the user must run \`zilmate setup\` themselves.`);
      }
      if (!SAFE_SETTINGS.has(key)) {
        throw new Error(`${key} is not in the safe-settings allowlist. Use launchSecureSetup for sensitive config.`);
      }
      await upsertEnvKey(envPath, key, value);
      if (key === 'ZILMATE_WORKSPACE') await initWorkspace(value);
      return { ok: true, key, value, envPath, reloadHint: 'Restart ZilMate or start a new session to pick up .env changes.' };
    },
  }),

  initWorkspaceFromAgent: tool({
    description: 'Create the ZilMate workspace folder (Downloads/ZilMate or ~/ZilMate) with notebook, skills, outputs, and logs.',
    inputSchema: z.object({}),
    execute: async () => {
      const layout = await initWorkspace();
      const envPath = '.env';
      if (existsSync(envPath)) {
        const current = await readEnvFile(envPath);
        if (!current.get('ZILMATE_WORKSPACE')) {
          await upsertEnvKey(envPath, 'ZILMATE_WORKSPACE', layout.root);
        }
      }
      return { root: layout.root, paths: layout };
    },
  }),
};
