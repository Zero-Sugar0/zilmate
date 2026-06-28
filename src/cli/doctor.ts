import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { constants, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { env, hasComposio, hasDeepgram, hasGatewayAuth, hasQStash, hasRedis, hasChatIntegration } from '../config/env.js';
import { getModelAvailability, models } from '../config/models.js';
import { getComposioStatus } from '../tools/composio.tool.js';
import { memoryBackendName } from '../memory/redis.js';
import { initWorkspace } from '../workspace/init.js';
import { workspaceLayout } from '../workspace/paths.js';
import { getLocalDataRoot } from '../memory/local-store.js';
import { cloudflareTunnelDoctor } from './tunnel.js';
import { skillsRegistryDoctor } from '../skills/registry.js';
import { checkDependency } from '../observability/doctor.js';
import { mcpManagementTools } from '../tools/mcp.tool.js';
import { confirmPrompt } from './prompt.js';
import { queryWiki } from '../memory/corporate-wiki.js';


export type DoctorStatus = 'pass' | 'warn' | 'fail';

export type DoctorCheck = {
  name: string;
  status: DoctorStatus;
  detail: string;
};

const projectRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

async function packageVersion() {
  try {
    const raw = await readFile(path.join(projectRoot, 'package.json'), 'utf8');
    return (JSON.parse(raw) as { version?: string }).version || 'unknown';
  } catch {
    return 'unknown';
  }
}

async function writableMemoryFolder() {
  await initWorkspace();
  const folder = getLocalDataRoot();
  const probe = path.join(folder, `.doctor-${Date.now()}.tmp`);
  await mkdir(folder, { recursive: true });
  await writeFile(probe, 'ok', 'utf8');
  await access(probe, constants.R_OK | constants.W_OK);
  await unlink(probe);
  return folder;
}

export function getConfigSummary() {
  return {
    package: 'zilmate',
    version: null as string | null,
    node: process.versions.node,
    envFiles: {
      dotenv: existsSync('.env'),
      dotenvLocal: existsSync('.env.local'),
    },
    auth: {
      aiGateway: hasGatewayAuth(),
      composio: Boolean(env.composioApiKey),
      zilmateUserId: Boolean(env.zilmateUserId),
      tavily: Boolean(env.tavilyApiKey),
      redisUrl: Boolean(env.upstashRedisRestUrl),
      redisToken: Boolean(env.upstashRedisRestToken),
      jobs: env.zilmateJobsEnabled,
      qstash: Boolean(env.upstashQstashToken),
      jobWebhookUrl: Boolean(env.zilmatePublicJobWebhookUrl),
      triggerWorkflows: env.zilmateTriggerWorkflowsEnabled,
      voice: env.zilmateVoiceEnabled,
      deepgram: Boolean(env.deepgramApiKey),
      chatEnabled: env.chatIntegrationEnabled,
      slackToken: Boolean(env.slackBotToken),
      telegramToken: Boolean(env.telegramBotToken),
      imessageLocal: env.imessageLocal,
      awsS3: Boolean(env.awsAccessKeyId && env.awsSecretAccessKey),
      gcs: Boolean(env.gcsProjectId && env.gcsKeyFilename),
      vercelBlob: Boolean(env.blobReadWriteToken),
      corporateWikiProvider: env.corporateWikiProvider,
      supermemoryApiKey: Boolean(env.supermemoryApiKey),
      upstashVectorUrl: Boolean(env.upstashVectorRestUrl),
      upstashVectorToken: Boolean(env.upstashVectorRestToken),
    },
    memory: {
      backend: memoryBackendName(),
    },
    models,
  };
}

export async function getResolvedConfigSummary() {
  return {
    ...getConfigSummary(),
    version: await packageVersion(),
  };
}

export async function runDoctor(options: { live?: boolean; sessionId?: string; interactive?: boolean } = {}) {
  const checks: DoctorCheck[] = [];
  const major = Number(process.versions.node.split('.')[0] || '0');
  const version = await packageVersion();

  checks.push({
    name: 'Package',
    status: 'pass',
    detail: `zilmate ${version}`,
  });
  checks.push({
    name: 'Node',
    status: major >= 20 ? 'pass' : 'fail',
    detail: `Node ${process.versions.node}${major >= 20 ? '' : ' is too old; use Node 20+'}`,
  });
  checks.push({
    name: 'Env file',
    status: existsSync('.env') || existsSync('.env.local') ? 'pass' : 'warn',
    detail: existsSync('.env.local') ? '.env.local found' : existsSync('.env') ? '.env found' : 'No .env or .env.local found; run zilmate setup',
  });
  checks.push({
    name: 'AI Gateway',
    status: hasGatewayAuth() ? 'pass' : 'fail',
    detail: hasGatewayAuth() ? 'AI Gateway auth is configured' : 'Missing AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN',
  });
  checks.push({
    name: 'Composio',
    status: hasComposio() ? 'pass' : env.composioApiKey || env.zilmateUserId ? 'warn' : 'warn',
    detail: hasComposio()
      ? 'COMPOSIO_API_KEY and ZILMATE_USER_ID are configured'
      : env.composioApiKey
        ? 'COMPOSIO_API_KEY is set but ZILMATE_USER_ID is missing; run zilmate setup'
        : 'Optional COMPOSIO_API_KEY is not configured',
  });
  checks.push({
    name: 'Tavily',
    status: env.tavilyApiKey ? 'pass' : 'warn',
    detail: env.tavilyApiKey ? 'Tavily web research is configured' : 'Optional TAVILY_API_KEY is not configured',
  });
  checks.push({
    name: 'Redis',
    status: hasRedis() ? 'pass' : env.upstashRedisRestUrl || env.upstashRedisRestToken ? 'fail' : 'warn',
    detail: hasRedis()
      ? 'Redis memory backend is configured'
      : env.upstashRedisRestUrl || env.upstashRedisRestToken
        ? 'Redis is partially configured; set both URL and token'
        : 'Redis not configured; using local file memory',
  });
  checks.push({
    name: 'Jobs',
    status: env.zilmateJobsEnabled ? 'pass' : 'warn',
    detail: env.zilmateJobsEnabled ? 'Background jobs are enabled' : 'Background jobs are disabled; set ZILMATE_JOBS_ENABLED=true',
  });
  checks.push({
    name: 'QStash',
    status: hasQStash() ? 'pass' : env.upstashQstashToken || env.zilmatePublicJobWebhookUrl ? 'fail' : 'warn',
    detail: hasQStash()
      ? 'QStash hosted scheduling is configured'
      : env.upstashQstashToken || env.zilmatePublicJobWebhookUrl
        ? 'QStash is partially configured; set token and public webhook URL'
        : 'QStash not configured; using local worker scheduling only',
  });
  checks.push({
    name: 'Trigger workflows',
    status: env.zilmateTriggerWorkflowsEnabled ? 'pass' : 'warn',
    detail: env.zilmateTriggerWorkflowsEnabled ? 'Composio trigger events will queue jobs' : 'Composio trigger workflows are disabled',
  });
  checks.push({
    name: 'Voice',
    status: env.zilmateVoiceEnabled && hasDeepgram() ? 'pass' : env.zilmateVoiceEnabled ? 'fail' : 'warn',
    detail: env.zilmateVoiceEnabled
      ? hasDeepgram()
        ? `Deepgram voice configured: ${env.zilmateVoiceListenModel} -> ${env.zilmateVoiceTtsModel}`
        : 'Voice is enabled but DEEPGRAM_API_KEY is missing'
      : 'Realtime voice is disabled',
  });

  checks.push({
    name: 'Chat Channels',
    status: env.chatIntegrationEnabled ? hasChatIntegration() ? 'pass' : 'fail' : 'warn',
    detail: env.chatIntegrationEnabled
      ? hasChatIntegration()
        ? `Chat enabled: ${env.slackBotToken ? 'Slack ' : ''}${env.telegramBotToken ? 'Telegram ' : ''}${env.imessageEnabled ? 'iMessage' : ''}`
        : 'Chat is enabled but no channel tokens are configured (Slack/Telegram/iMessage)'
      : 'External chat channels are disabled',
  });

  checks.push({
    name: 'Workspace',
    status: existsSync(workspaceLayout().root) ? 'pass' : 'warn',
    detail: existsSync(workspaceLayout().root)
      ? `ZilMate workspace at ${workspaceLayout().root}`
      : 'Workspace missing; run zilmate setup or zilmate workspace init',
  });

  const tunnel = await cloudflareTunnelDoctor();
  checks.push({
    name: tunnel.name,
    status: tunnel.ok ? 'pass' : 'warn',
    detail: tunnel.detail,
  });

  checks.push({
    name: 'Notebook',
    status: existsSync(workspaceLayout().notebook) ? 'pass' : 'warn',
    detail: existsSync(workspaceLayout().notebook)
      ? `Agent notebook at ${workspaceLayout().notebook}`
      : 'Run zilmate workspace-init to create notebook.md',
  });

  checks.push({
    name: 'Documents',
    status: 'pass',
    detail: 'PDF + slide deck generation available (pdfkit, pptxgenjs)',
  });

  let hasPlaywright = await checkDependency('npx playwright --version').catch(() => false);
  if (!hasPlaywright && options.interactive && process.stdin.isTTY) {
    const confirm = await confirmPrompt('Playwright is missing. Install now?');
    if (confirm) {
      try {
        console.log('Installing Playwright browser binaries...');
        execSync('npx playwright install', { stdio: 'inherit' });
        hasPlaywright = await checkDependency('npx playwright --version').catch(() => false);
      } catch (e) {
        console.log(chalk.red(`Failed to install Playwright: ${e instanceof Error ? e.message : String(e)}`));
      }
    }
  }

  checks.push({
    name: 'Browser Automation',
    status: hasPlaywright ? 'pass' : 'warn',
    detail: hasPlaywright ? 'Playwright is available' : 'Run: npx playwright install',
  });

  let hasRembg = await checkDependency('rembg --version').catch(() => false);
  if (!hasRembg && options.interactive && process.stdin.isTTY) {
    const confirm = await confirmPrompt('rembg is missing. Install now?');
    if (confirm) {
      try {
        console.log('Installing rembg python package...');
        execSync('pip install rembg', { stdio: 'inherit' });
        hasRembg = await checkDependency('rembg --version').catch(() => false);
      } catch (e) {
        console.log(chalk.red(`Failed to install rembg: ${e instanceof Error ? e.message : String(e)}`));
      }
    }
  }

  checks.push({
    name: 'Image Intelligence',
    status: hasRembg ? 'pass' : 'warn',
    detail: hasRembg ? 'rembg is available' : 'Run: pip install rembg',
  });

  const hasDocker = await checkDependency('docker').catch(() => false);
  checks.push({
    name: 'Docker (DevOps)',
    status: hasDocker ? 'pass' : 'warn',
    detail: hasDocker ? 'Docker is available' : 'Docker is not installed or running; some DevOps tools will be unavailable.',
  });

  const hasFfmpeg = await checkDependency('ffmpeg').catch(() => false);
  checks.push({
    name: 'FFmpeg (Multimedia)',
    status: hasFfmpeg ? 'pass' : 'warn',
    detail: hasFfmpeg ? 'FFmpeg is available' : 'FFmpeg is not installed; video, audio, and image watermark tools will be disabled.',
  });

  const hasSqlite = await checkDependency('sqlite3').catch(() => false);
  checks.push({
    name: 'SQLite (Database)',
    status: hasSqlite ? 'pass' : 'warn',
    detail: hasSqlite ? 'SQLite3 CLI is available' : 'SQLite3 CLI is not installed; database query tools will fall back to Python.',
  });

  const cloudProviders: string[] = [];
  let cloudStatus: 'pass' | 'warn' = 'warn';
  if (env.awsAccessKeyId && env.awsSecretAccessKey) cloudProviders.push('AWS S3');
  if (env.gcsProjectId && env.gcsKeyFilename) cloudProviders.push('Google Cloud Storage');
  if (env.blobReadWriteToken) cloudProviders.push('Vercel Blob');

  if (cloudProviders.length > 0) {
    cloudStatus = 'pass';
  }
  checks.push({
    name: 'Cloud Storage',
    status: cloudStatus,
    detail: cloudProviders.length > 0
      ? `Configured providers: ${cloudProviders.join(', ')}`
      : 'No cloud storage providers are configured (S3, GCS, or Vercel Blob)',
  });

  const wikiProvider = env.corporateWikiProvider || (env.supermemoryApiKey ? 'supermemory' : env.upstashVectorRestUrl ? 'upstash' : 'local-file');
  let wikiStatus: 'pass' | 'warn' | 'fail' = 'pass';
  let wikiDetail = '';

  if (wikiProvider === 'supermemory') {
    if (env.supermemoryApiKey) {
      wikiDetail = 'SuperMemory is configured';
    } else {
      wikiStatus = 'fail';
      wikiDetail = 'SuperMemory is selected but SUPERMEMORY_API_KEY is missing';
    }
  } else if (wikiProvider === 'upstash') {
    if (env.upstashVectorRestUrl && env.upstashVectorRestToken) {
      wikiDetail = 'Upstash Vector is configured';
    } else {
      wikiStatus = 'fail';
      wikiDetail = 'Upstash Vector is selected but REST URL or token is missing';
    }
  } else {
    wikiStatus = 'warn';
    wikiDetail = 'Using local JSON database fallback (local-file); configure SuperMemory or Upstash Vector for collaborative memory';
  }

  checks.push({
    name: 'Corporate Wiki',
    status: wikiStatus,
    detail: wikiDetail,
  });

  const skillsRegistry = await skillsRegistryDoctor();
  checks.push({
    name: skillsRegistry.name,
    status: skillsRegistry.ok ? 'pass' : 'warn',
    detail: skillsRegistry.detail,
  });

  checks.push({
    name: 'Desktop notifications',
    status: 'pass',
    detail: process.platform === 'win32'
      ? 'Windows toast via PowerShell'
      : process.platform === 'darwin'
        ? 'macOS notification via osascript'
        : 'Linux notify-send / zenify fallback',
  });

  if (hasQStash()) {
    checks.push({
      name: 'QStash webhook',
      status: 'pass',
      detail: `Public URL configured. Run \`zilmate jobs listen --tunnel\` while laptop is on.`,
    });
  }

  checks.push({
    name: 'CLI UX',
    status: process.stdin.isTTY ? 'pass' : 'warn',
    detail: process.stdin.isTTY
      ? 'Interactive prompts, spinner, and arrow/space selection available'
      : 'Non-TTY mode — notifications and select menus may be limited',
  });

  try {
    const folder = await writableMemoryFolder();
    checks.push({ name: 'Memory folder', status: 'pass', detail: `Writable: ${folder}` });
  } catch (error) {
    checks.push({ name: 'Memory folder', status: 'fail', detail: error instanceof Error ? error.message : String(error) });
  }

  if (options.live) {
    try {
      const mcpResult = await (mcpManagementTools.listMCPServers as any).execute({});
      const enabled = mcpResult.servers.filter((s: any) => s.enabled);
      const active = mcpResult.servers.filter((s: any) => s.active);
      checks.push({
        name: 'MCP Servers',
        status: enabled.length > 0 ? (active.length === enabled.length ? 'pass' : 'warn') : 'warn',
        detail: enabled.length > 0
          ? `${active.length}/${enabled.length} enabled servers are active`
          : 'No MCP servers are enabled',
      });
    } catch (error) {
      checks.push({ name: 'MCP Servers', status: 'fail', detail: String(error) });
    }

    if (hasGatewayAuth()) {
      try {
        const availability = await getModelAvailability();
        checks.push({
          name: 'Gateway live',
          status: availability.missing.length === 0 ? 'pass' : 'warn',
          detail: availability.missing.length === 0 ? `${availability.availableIds.length} models reported` : `Missing configured models: ${availability.missing.join(', ')}`,
        });
      } catch (error) {
        checks.push({ name: 'Gateway live', status: 'fail', detail: error instanceof Error ? error.message : String(error) });
      }
    }

    if (hasComposio()) {
      try {
        const status = await getComposioStatus(options.sessionId || 'default');
        checks.push({
          name: 'Composio live',
          status: status.configured && status.sessionId ? 'pass' : 'fail',
          detail: status.sessionId ? `Session ${status.sessionId}; ${status.toolkits.length} toolkits listed` : 'No Composio session returned',
        });
      } catch (error) {
        checks.push({ name: 'Composio live', status: 'fail', detail: error instanceof Error ? error.message : String(error) });
      }
    }

    if (wikiProvider === 'supermemory' || wikiProvider === 'upstash') {
      try {
        const results = await queryWiki('ping', 1);
        checks.push({
          name: 'Corporate Wiki live',
          status: 'pass',
          detail: `Connected to ${wikiProvider === 'supermemory' ? 'SuperMemory' : 'Upstash Vector'} successfully (returned ${results.length} results)`,
        });
      } catch (error) {
        checks.push({
          name: 'Corporate Wiki live',
          status: 'fail',
          detail: `Could not connect to ${wikiProvider === 'supermemory' ? 'SuperMemory' : 'Upstash Vector'}: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }
  }

  return checks;
}
