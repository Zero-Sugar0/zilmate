import { existsSync } from 'node:fs';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import chalk from 'chalk';
import { gateway } from 'ai';
import { printPanel, printZilMateBanner } from './format.js';
import { runCameraDoctor } from '../tools/desktop.tool.js';
import { initWorkspace } from '../workspace/init.js';
import { workspaceLayout, resolveWorkspaceRoot } from '../workspace/paths.js';
import { startCloudflareQuickTunnel, isCloudflaredAvailable, ensureCloudflared } from './tunnel.js';
import { startJobWebhookServer } from '../jobs/webhook-server.js';
import { Supermemory } from 'supermemory';
import { Index } from '@upstash/vector';


const execFileAsync = promisify(execFile);

// Live Verification Helpers
async function verifyGatewayKey(key: string): Promise<boolean> {
  const originalKey = process.env.AI_GATEWAY_API_KEY;
  try {
    process.env.AI_GATEWAY_API_KEY = key;
    await gateway.getAvailableModels();
    return true;
  } catch {
    return false;
  } finally {
    process.env.AI_GATEWAY_API_KEY = originalKey;
  }
}

async function verifyTavilyKey(key: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, query: 'ping', max_results: 1 }),
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function verifyDeepgramKey(key: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.deepgram.com/v1/projects', {
      headers: { 'Authorization': `Token ${key}` },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function verifyRedisCredentials(url: string, token: string): Promise<boolean> {
  try {
    const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const res = await fetch(`${cleanUrl}/ping`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.status !== 200) return false;
    const data = await res.json() as { result?: string };
    return data.result === 'PONG';
  } catch {
    return false;
  }
}

async function verifySupermemoryKey(key: string): Promise<boolean> {
  try {
    const client = new Supermemory({ apiKey: key });
    await client.search.memories({ q: 'ping', limit: 1 });
    return true;
  } catch {
    return false;
  }
}

async function verifyUpstashVectorCredentials(url: string, token: string): Promise<boolean> {
  try {
    const index = new Index({ url, token });
    await index.info();
    return true;
  } catch {
    return false;
  }
}


type SetupOptions = {
  path?: string;
  force?: boolean;
  yes?: boolean;
  aiGatewayKey?: string;
  composioKey?: string;
  zilmateUserId?: string;
  tavilyKey?: string;
  redisUrl?: string;
  redisToken?: string;
  jobsEnabled?: string;
  qstashToken?: string;
  publicJobWebhookUrl?: string;
  jobWebhookSecret?: string;
  triggerWorkflowsEnabled?: string;
  deepgramApiKey?: string;
  voiceEnabled?: string;
  voiceListenModel?: string;
  voiceTtsModel?: string;
  voiceLanguage?: string;
  voiceInputDevice?: string;
  cameraDevice?: string;
  installCameraDeps?: string;
  installCloudflareDeps?: string;
  screenshotModel?: string;
  fileRoots?: string;
  slackBotToken?: string;
  slackSigningSecret?: string;
  telegramBotToken?: string;
  chatEnabled?: string;
  imessageEnabled?: string;
  imessageLocal?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsRegion?: string;
  gcsProjectId?: string;
  gcsKeyFilename?: string;
  blobReadWriteToken?: string;
  corporateWikiProvider?: string;
  supermemoryApiKey?: string;
  upstashVectorRestUrl?: string;
  upstashVectorRestToken?: string;
};

const defaults = {
  ZILO_MANAGER_MODEL: 'minimax/minimax-m3',
  ZILO_HELP_MODEL: 'alibaba/qwen3.7-plus',
  ZILO_POST_MODEL: 'alibaba/qwen3.7-plus',
  ZILO_IMAGE_DEFAULT_PROVIDER: 'openai',
  ZILO_IMAGE_OPENAI_MODEL: 'openai/gpt-image-2',
  ZILO_IMAGE_GEMINI_MODEL: 'google/gemini-3-pro-image',
  ZILO_IMAGE_MODEL: '',
  ZILMATE_VOICE_INPUT_DEVICE: '',
  ZILMATE_SCREENSHOT_MODEL: 'google/gemini-3.1-flash-lite',
  ZILMATE_CAMERA_DEVICE: '',
  ZILMATE_FILE_ROOTS: '',
};

function normalizeBooleanOption(value: string | undefined, fallback = false) {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y';
}

function newWebhookSecret() {
  return randomBytes(24).toString('base64url');
}

function parseEnvFile(content: string) {
  const values = new Map<string, string>();
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!key || rawValue === undefined) continue;
    values.set(key, rawValue.replace(/^"(.*)"$/, ''));
  }
  return values;
}

function formatEnvValue(value: string) {
  if (!value) return '';
  if (/^[A-Za-z0-9_./:@+=-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

// Secure keypress-based masking prompter
async function askSecret(rl: readline.Interface, prompt: string, required = false): Promise<string> {
  if (!process.stdin.isTTY) {
    while (true) {
      const val = (await rl.question(prompt)).trim();
      if (val || !required) return val;
      console.log(chalk.yellow('This value is required.'));
    }
  }

  // Pause readline to prevent standard/OS-level character echoes or double-handling during transition
  rl.pause();

  return new Promise<string>((resolve) => {
    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    // Carriage return & clear line to wipe any leaked echoes from bulk copy-paste buffering
    process.stdout.write('\r\x1b[K' + prompt);

    let value = '';

    const onData = (key: string | Buffer) => {
      const char = key.toString('utf8');

      for (let i = 0; i < char.length; i++) {
        const c = char[i]!;
        if (c === '\r' || c === '\n') {
          process.stdin.setRawMode(wasRaw);
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.resume(); // Resume readline handler
          const trimmed = value.trim();
          if (required && !trimmed) {
            rl.pause(); // Pause again for re-prompt
            process.stdin.setRawMode(true);
            process.stdin.on('data', onData);
            process.stdout.write(chalk.yellow('This value is required.\n') + '\r\x1b[K' + prompt);
            value = '';
          } else {
            resolve(trimmed);
          }
          return;
        } else if (c === '\u0003') { // Ctrl+C
          process.stdin.setRawMode(wasRaw);
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          process.exit(130);
        } else if (c === '\b' || c === '\x7f') { // Backspace
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (c >= ' ') {
          value += c;
          process.stdout.write('*');
        }
      }
    };

    process.stdin.on('data', onData);
  });
}

async function askRequiredSecret(rl: readline.Interface, prompt: string) {
  return askSecret(rl, prompt, true);
}

async function askOptionalSecret(rl: readline.Interface, prompt: string) {
  return askSecret(rl, prompt, false);
}

async function askYesNo(rl: readline.Interface, question: string, fallback: boolean) {
  const answer = (await rl.question(`${question} (${fallback ? 'Y/n' : 'y/N'}): `)).trim().toLowerCase();
  if (!answer) return fallback;
  return answer === 'y' || answer === 'yes';
}

async function askSection(rl: readline.Interface, title: string, description: string, question: string, fallback: boolean) {
  console.log(chalk.cyan(`\n${title}`));
  console.log(chalk.gray(description));
  return askYesNo(rl, question, fallback);
}

async function readEnvValues(path: string) {
  if (!existsSync(path)) return new Map<string, string>();
  try {
    const content = await readFile(path, 'utf8');
    return parseEnvFile(content);
  } catch {
    return new Map<string, string>();
  }
}

async function writeEnvValues(path: string, values: Map<string, string>, options: { merge?: boolean; touchedKeys?: Set<string> } = {}) {
  if (existsSync(path)) {
    try {
      const backupPath = `${path}.bak`;
      await copyFile(path, backupPath);
      console.log(chalk.gray(`Created backup: ${backupPath}`));
    } catch (error) {
      console.log(chalk.yellow(`Warning: Could not create backup file: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  let content = '';
  if (options.merge && existsSync(path)) {
    const existing = await readFile(path, 'utf8');
    const existingLines = existing.split(/\r?\n/);
    const usedKeys = new Set<string>();

    for (const line of existingLines) {
      const trimmed = line.trim();
      const match = /^([A-Z0-9_]+)=/.exec(trimmed);
      if (match && values.has(match[1]!) && (!options.touchedKeys || options.touchedKeys.has(match[1]!))) {
        content += `${match[1]}=${formatEnvValue(values.get(match[1]!)!)}\n`;
        usedKeys.add(match[1]!);
      } else {
        content += `${line}\n`;
      }
    }

    for (const [key, value] of values) {
      if (!usedKeys.has(key)) {
        content += `${key}=${formatEnvValue(value)}\n`;
      }
    }
  } else {
    for (const [key, value] of values) {
      content += `${key}=${formatEnvValue(value)}\n`;
    }
  }

  await writeFile(path, content.trim() + '\n', 'utf8');
}

async function commandExists(command: string) {
  const probe = process.platform === 'win32' ? 'where.exe' : 'which';
  try {
    await execFileAsync(probe, [command], { windowsHide: true, timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function installCameraDependency() {
  if (process.platform === 'darwin') {
    await execFileAsync('brew', ['install', 'ffmpeg']);
    return true;
  }
  if (process.platform === 'linux') {
    await execFileAsync('sudo', ['apt-get', 'update']);
    await execFileAsync('sudo', ['apt-get', 'install', '-y', 'ffmpeg']);
    return true;
  }
  return false;
}

function resolveEnvPath(passedPath?: string): string {
  if (passedPath) return passedPath;
  if (existsSync('.env')) return '.env';
  return path.join(resolveWorkspaceRoot(), '.env');
}

export async function runSetup(options: SetupOptions = {}) {
  const envPath = resolveEnvPath(options.path);
  const existing = await readEnvValues(envPath);
  const rl = readline.createInterface({ input, output });
  const mergeMode = options.force ? false : existing.size > 0;
  const touchedKeys = new Set<string>();

  try {
    printZilMateBanner('ZilMate Setup');
    if (mergeMode) {
      console.log(chalk.gray(`Merging settings into existing ${envPath}.`));
    } else {
      console.log(chalk.gray(`Creating new ${envPath}.`));
    }

    const values = new Map(existing);

    if (options.aiGatewayKey) {
      values.set('AI_GATEWAY_API_KEY', options.aiGatewayKey);
      touchedKeys.add('AI_GATEWAY_API_KEY');
    } else if (!values.has('AI_GATEWAY_API_KEY') || options.force) {
      console.log(chalk.cyan('\nAI Gateway'));
      console.log(chalk.gray('ZilMate uses the Vercel AI Gateway for LLM access. You need an API key from the gateway.'));
      while (true) {
        const key = await askRequiredSecret(rl, 'AI_GATEWAY_API_KEY: ');
        process.stdout.write(chalk.gray('Verifying key... '));
        const ok = await verifyGatewayKey(key);
        if (ok) {
          console.log(chalk.green('✅ Verified!'));
          values.set('AI_GATEWAY_API_KEY', key);
          touchedKeys.add('AI_GATEWAY_API_KEY');
          break;
        } else {
          console.log(chalk.red('❌ Verification failed.'));
          const retry = await askYesNo(rl, 'The key appears to be invalid or there was a network error. Re-enter?', true);
          if (!retry) {
            values.set('AI_GATEWAY_API_KEY', key);
            touchedKeys.add('AI_GATEWAY_API_KEY');
            break;
          }
        }
      }
    }

    if (options.composioKey) {
      values.set('COMPOSIO_API_KEY', options.composioKey);
      touchedKeys.add('COMPOSIO_API_KEY');
    } else if (!options.yes && (!values.has('COMPOSIO_API_KEY') || options.force)) {
      if (await askSection(
        rl,
        'External App Intelligence (Composio)',
        'Enable ZilMate to use Stripe, HubSpot, GitHub, Gmail, and 100+ other apps via Composio.',
        'Configure Composio now?',
        true,
      )) {
        values.set('COMPOSIO_API_KEY', await askRequiredSecret(rl, 'COMPOSIO_API_KEY: '));
        touchedKeys.add('COMPOSIO_API_KEY');
      }
    }

    if (options.zilmateUserId) {
      values.set('ZILMATE_USER_ID', options.zilmateUserId);
      touchedKeys.add('ZILMATE_USER_ID');
    } else if (values.get('COMPOSIO_API_KEY') && (!values.get('ZILMATE_USER_ID') || options.force)) {
      const suggestedId = `zilmate-${randomUUID().slice(0, 8)}`;
      const userId = (await rl.question(`ZilMate User ID (default: ${suggestedId}): `)).trim();
      values.set('ZILMATE_USER_ID', userId || suggestedId);
      touchedKeys.add('ZILMATE_USER_ID');
    }

    if (options.tavilyKey) {
      values.set('TAVILY_API_KEY', options.tavilyKey);
      touchedKeys.add('TAVILY_API_KEY');
    } else if (!options.yes && (!values.has('TAVILY_API_KEY') || options.force)) {
      if (await askSection(
        rl,
        'Web Research (Tavily)',
        'Tavily allows ZilMate to perform real-time web searches for accurate up-to-date information.',
        'Configure Tavily now?',
        true,
      )) {
        while (true) {
          const key = await askRequiredSecret(rl, 'TAVILY_API_KEY: ');
          process.stdout.write(chalk.gray('Verifying Tavily key... '));
          const ok = await verifyTavilyKey(key);
          if (ok) {
            console.log(chalk.green('✅ Verified!'));
            values.set('TAVILY_API_KEY', key);
            touchedKeys.add('TAVILY_API_KEY');
            break;
          } else {
            console.log(chalk.red('❌ Verification failed.'));
            const retry = await askYesNo(rl, 'The key appears to be invalid or there was a network error. Re-enter?', true);
            if (!retry) {
              values.set('TAVILY_API_KEY', key);
              touchedKeys.add('TAVILY_API_KEY');
              break;
            }
          }
        }
      }
    }

    if (options.redisUrl && options.redisToken) {
      values.set('UPSTASH_REDIS_REST_URL', options.redisUrl);
      values.set('UPSTASH_REDIS_REST_TOKEN', options.redisToken);
      touchedKeys.add('UPSTASH_REDIS_REST_URL');
      touchedKeys.add('UPSTASH_REDIS_REST_TOKEN');
    } else if (!options.yes && (!values.has('UPSTASH_REDIS_REST_URL') || options.force)) {
      if (await askSection(
        rl,
        'Persistent Multi-Instance Memory (Redis)',
        'By default, ZilMate uses local files for memory. Use Upstash Redis for distributed memory and reliable background jobs.',
        'Configure Upstash Redis now?',
        false,
      )) {
        while (true) {
          const redisUrl = await askRequiredSecret(rl, 'UPSTASH_REDIS_REST_URL: ');
          const redisToken = await askRequiredSecret(rl, 'UPSTASH_REDIS_REST_TOKEN: ');
          process.stdout.write(chalk.gray('Verifying Redis REST connection... '));
          const ok = await verifyRedisCredentials(redisUrl, redisToken);
          if (ok) {
            console.log(chalk.green('✅ Connected successfully!'));
            values.set('UPSTASH_REDIS_REST_URL', redisUrl);
            values.set('UPSTASH_REDIS_REST_TOKEN', redisToken);
            touchedKeys.add('UPSTASH_REDIS_REST_URL');
            touchedKeys.add('UPSTASH_REDIS_REST_TOKEN');
            break;
          } else {
            console.log(chalk.red('❌ Connection failed.'));
            const retry = await askYesNo(rl, 'Connection failed. Re-enter Redis credentials?', true);
            if (!retry) {
              values.set('UPSTASH_REDIS_REST_URL', redisUrl);
              values.set('UPSTASH_REDIS_REST_TOKEN', redisToken);
              touchedKeys.add('UPSTASH_REDIS_REST_URL');
              touchedKeys.add('UPSTASH_REDIS_REST_TOKEN');
              break;
            }
          }
        }
      }
    }

    const jobsEnabled = options.jobsEnabled !== undefined ? normalizeBooleanOption(options.jobsEnabled) : undefined;
    if (jobsEnabled !== undefined) {
      values.set('ZILMATE_JOBS_ENABLED', jobsEnabled ? 'true' : 'false');
      touchedKeys.add('ZILMATE_JOBS_ENABLED');
    } else if (!options.yes && (!values.has('ZILMATE_JOBS_ENABLED') || options.force)) {
      if (await askSection(
        rl,
        'Background Jobs',
        'ZilMate can run background tasks, schedules, and trigger-based workflows.',
        'Enable background jobs?',
        true,
      )) {
        values.set('ZILMATE_JOBS_ENABLED', 'true');
        touchedKeys.add('ZILMATE_JOBS_ENABLED');
      } else {
        values.set('ZILMATE_JOBS_ENABLED', 'false');
        touchedKeys.add('ZILMATE_JOBS_ENABLED');
      }
    }

    if (values.get('ZILMATE_JOBS_ENABLED') === 'true') {
      if (options.qstashToken && options.publicJobWebhookUrl) {
        values.set('UPSTASH_QSTASH_TOKEN', options.qstashToken);
        values.set('ZILMATE_PUBLIC_JOB_WEBHOOK_URL', options.publicJobWebhookUrl);
        touchedKeys.add('UPSTASH_QSTASH_TOKEN');
        touchedKeys.add('ZILMATE_PUBLIC_JOB_WEBHOOK_URL');
      } else if (!options.yes && (!values.has('UPSTASH_QSTASH_TOKEN') || options.force)) {
        if (await askSection(
          rl,
          'Hosted Job Scheduling (QStash)',
          'Local schedules stop when the laptop closes. Use Upstash QStash for durable, hosted scheduling and retries.',
          'Configure Upstash QStash now?',
          false,
        )) {
          values.set('UPSTASH_QSTASH_TOKEN', await askRequiredSecret(rl, 'UPSTASH_QSTASH_TOKEN: '));
          values.set('ZILMATE_PUBLIC_JOB_WEBHOOK_URL', await askRequiredSecret(rl, 'ZILMATE_PUBLIC_JOB_WEBHOOK_URL: '));
          touchedKeys.add('UPSTASH_QSTASH_TOKEN');
          touchedKeys.add('ZILMATE_PUBLIC_JOB_WEBHOOK_URL');
        }
      }

      if (values.get('UPSTASH_QSTASH_TOKEN') && (!values.get('ZILMATE_JOB_WEBHOOK_SECRET') || options.force)) {
        const secret = options.jobWebhookSecret || newWebhookSecret();
        values.set('ZILMATE_JOB_WEBHOOK_SECRET', secret);
        touchedKeys.add('ZILMATE_JOB_WEBHOOK_SECRET');
      }

      const triggersEnabled = options.triggerWorkflowsEnabled !== undefined ? normalizeBooleanOption(options.triggerWorkflowsEnabled) : undefined;
      if (triggersEnabled !== undefined) {
        values.set('ZILMATE_TRIGGER_WORKFLOWS_ENABLED', triggersEnabled ? 'true' : 'false');
        touchedKeys.add('ZILMATE_TRIGGER_WORKFLOWS_ENABLED');
      } else if (!options.yes && (!values.has('ZILMATE_TRIGGER_WORKFLOWS_ENABLED') || options.force)) {
        if (await askSection(
          rl,
          'Composio Triggers',
          'Automatically start ZilMate jobs when events occur in Slack, Stripe, Gmail, etc.',
          'Enable trigger workflows?',
          true,
        )) {
          values.set('ZILMATE_TRIGGER_WORKFLOWS_ENABLED', 'true');
          touchedKeys.add('ZILMATE_TRIGGER_WORKFLOWS_ENABLED');
        } else {
          values.set('ZILMATE_TRIGGER_WORKFLOWS_ENABLED', 'false');
          touchedKeys.add('ZILMATE_TRIGGER_WORKFLOWS_ENABLED');
        }
      }
    }

    if (options.deepgramApiKey) {
      values.set('DEEPGRAM_API_KEY', options.deepgramApiKey);
      touchedKeys.add('DEEPGRAM_API_KEY');
    } else if (!options.yes && (!values.has('DEEPGRAM_API_KEY') || options.force)) {
      if (await askSection(
        rl,
        'Realtime Voice (Deepgram)',
        'Enable ZilMate to listen and speak in realtime with ultra-low latency.',
        'Configure Deepgram voice now?',
        false,
      )) {
        while (true) {
          const key = await askRequiredSecret(rl, 'DEEPGRAM_API_KEY: ');
          process.stdout.write(chalk.gray('Verifying Deepgram key... '));
          const ok = await verifyDeepgramKey(key);
          if (ok) {
            console.log(chalk.green('✅ Verified!'));
            values.set('DEEPGRAM_API_KEY', key);
            touchedKeys.add('DEEPGRAM_API_KEY');
            break;
          } else {
            console.log(chalk.red('❌ Verification failed.'));
            const retry = await askYesNo(rl, 'The key appears to be invalid or there was a network error. Re-enter?', true);
            if (!retry) {
              values.set('DEEPGRAM_API_KEY', key);
              touchedKeys.add('DEEPGRAM_API_KEY');
              break;
            }
          }
        }
      }
    }

    if (values.get('DEEPGRAM_API_KEY')) {
      const voiceEnabled = options.voiceEnabled !== undefined ? normalizeBooleanOption(options.voiceEnabled) : undefined;
      if (voiceEnabled !== undefined) {
        values.set('ZILMATE_VOICE_ENABLED', voiceEnabled ? 'true' : 'false');
        touchedKeys.add('ZILMATE_VOICE_ENABLED');
      } else if (!options.yes && (!values.has('ZILMATE_VOICE_ENABLED') || options.force)) {
        values.set('ZILMATE_VOICE_ENABLED', (await askYesNo(rl, 'Enable realtime voice by default?', true)) ? 'true' : 'false');
        touchedKeys.add('ZILMATE_VOICE_ENABLED');
      }
    }

    if (!options.yes && options.fileRoots === undefined) {
      if (await askSection(
        rl,
        'Local File Access',
        'Let ZilMate search, read, summarize, create, move, copy, and rename files inside approved roots. Writes still ask for approval.',
        'Configure extra file access roots?',
        Boolean(values.get('ZILMATE_FILE_ROOTS')),
      )) {
        const currentRoots = values.get('ZILMATE_FILE_ROOTS') || '';
        const roots = (await rl.question(`ZILMATE_FILE_ROOTS comma-separated${currentRoots ? ` (${currentRoots})` : ' (blank for current folder only)'}: `)).trim();
        values.set('ZILMATE_FILE_ROOTS', roots || currentRoots);
        touchedKeys.add('ZILMATE_FILE_ROOTS');
      }
    }

    if (!options.yes && options.screenshotModel === undefined) {
      if (await askSection(
        rl,
        'Screen and photo understanding',
        'ZilMate uses a vision model to describe screenshots and camera photos. The default is Gemini 3.1 Flash Lite through the AI Gateway.',
        'Use the default screenshot/photo vision model?',
        true,
      )) {
        values.set('ZILMATE_SCREENSHOT_MODEL', values.get('ZILMATE_SCREENSHOT_MODEL') || defaults.ZILMATE_SCREENSHOT_MODEL);
        touchedKeys.add('ZILMATE_SCREENSHOT_MODEL');
      } else {
        const model = (await rl.question(`ZILMATE_SCREENSHOT_MODEL (${values.get('ZILMATE_SCREENSHOT_MODEL') || defaults.ZILMATE_SCREENSHOT_MODEL}): `)).trim();
        values.set('ZILMATE_SCREENSHOT_MODEL', model || values.get('ZILMATE_SCREENSHOT_MODEL') || defaults.ZILMATE_SCREENSHOT_MODEL);
        touchedKeys.add('ZILMATE_SCREENSHOT_MODEL');
      }
    }

    // Chat Integration Section
    if (!options.yes && (!values.has('CHAT_INTEGRATION_ENABLED') || options.force)) {
      if (await askSection(
        rl,
        'Chat Channels (Slack, Telegram, iMessage)',
        'Enable ZilMate to respond to you on Slack, Telegram, or iMessage, and proactively report business events.',
        'Configure Chat Channels now?',
        false,
      )) {
        values.set('CHAT_INTEGRATION_ENABLED', 'true');
        touchedKeys.add('CHAT_INTEGRATION_ENABLED');

        if (await askYesNo(rl, 'Configure Slack?', Boolean(values.get('SLACK_BOT_TOKEN')))) {
          const slackToken = options.slackBotToken || await askRequiredSecret(rl, 'SLACK_BOT_TOKEN: ');
          values.set('SLACK_BOT_TOKEN', slackToken);
          touchedKeys.add('SLACK_BOT_TOKEN');
          const slackSecret = options.slackSigningSecret || await askOptionalSecret(rl, 'SLACK_SIGNING_SECRET (optional): ');
          if (slackSecret) {
            values.set('SLACK_SIGNING_SECRET', slackSecret);
            touchedKeys.add('SLACK_SIGNING_SECRET');
          }
        }

        if (await askYesNo(rl, 'Configure Telegram?', Boolean(values.get('TELEGRAM_BOT_TOKEN')))) {
          const tgToken = options.telegramBotToken || await askRequiredSecret(rl, 'TELEGRAM_BOT_TOKEN: ');
          values.set('TELEGRAM_BOT_TOKEN', tgToken);
          touchedKeys.add('TELEGRAM_BOT_TOKEN');
        }

        if (await askYesNo(rl, 'Configure iMessage?', values.get('CHAT_IMESSAGE_ENABLED') === 'true')) {
           values.set('CHAT_IMESSAGE_ENABLED', 'true');
           touchedKeys.add('CHAT_IMESSAGE_ENABLED');
           if (process.platform === 'darwin') {
             values.set('IMESSAGE_LOCAL', (await askYesNo(rl, 'Use local iMessage database (macOS only)?', true)) ? 'true' : 'false');
             touchedKeys.add('IMESSAGE_LOCAL');
           } else {
             values.set('IMESSAGE_LOCAL', 'false');
             touchedKeys.add('IMESSAGE_LOCAL');
             console.log(chalk.yellow('Non-macOS platform detected. iMessage will run in Remote Mode via Photon bridge.'));
           }
        } else {
           values.set('CHAT_IMESSAGE_ENABLED', 'false');
           touchedKeys.add('CHAT_IMESSAGE_ENABLED');
        }
      } else {
        values.set('CHAT_INTEGRATION_ENABLED', 'false');
        touchedKeys.add('CHAT_INTEGRATION_ENABLED');
      }
    }

    if (options.awsAccessKeyId) {
      values.set('AWS_ACCESS_KEY_ID', options.awsAccessKeyId);
      touchedKeys.add('AWS_ACCESS_KEY_ID');
    }
    if (options.awsSecretAccessKey) {
      values.set('AWS_SECRET_ACCESS_KEY', options.awsSecretAccessKey);
      touchedKeys.add('AWS_SECRET_ACCESS_KEY');
    }
    if (options.awsRegion) {
      values.set('AWS_REGION', options.awsRegion);
      touchedKeys.add('AWS_REGION');
    }
    if (options.gcsProjectId) {
      values.set('GCS_PROJECT_ID', options.gcsProjectId);
      touchedKeys.add('GCS_PROJECT_ID');
    }
    if (options.gcsKeyFilename) {
      values.set('GOOGLE_APPLICATION_CREDENTIALS', options.gcsKeyFilename);
      touchedKeys.add('GOOGLE_APPLICATION_CREDENTIALS');
    }
    if (options.blobReadWriteToken) {
      values.set('BLOB_READ_WRITE_TOKEN', options.blobReadWriteToken);
      touchedKeys.add('BLOB_READ_WRITE_TOKEN');
    }

    if (!options.yes && (!values.has('AWS_ACCESS_KEY_ID') || !values.has('GOOGLE_APPLICATION_CREDENTIALS') || !values.has('BLOB_READ_WRITE_TOKEN') || options.force)) {
      if (await askSection(
        rl,
        'Cloud Storage Integration (S3, GCS, Vercel Blob)',
        'Enable ZilMate to backup, restore, or store persistent files across AWS S3, Google Cloud Storage, or Vercel Blob.',
        'Configure Cloud Storage now?',
        false,
      )) {
        if (await askYesNo(rl, 'Configure AWS S3?', Boolean(values.get('AWS_ACCESS_KEY_ID')))) {
          const awsId = options.awsAccessKeyId || await askRequiredSecret(rl, 'AWS_ACCESS_KEY_ID: ');
          const awsSecret = options.awsSecretAccessKey || await askRequiredSecret(rl, 'AWS_SECRET_ACCESS_KEY: ');
          const currentRegion = options.awsRegion || values.get('AWS_REGION') || 'us-east-1';
          const awsRegion = options.awsRegion || ((await rl.question(`AWS_REGION (${currentRegion}): `)).trim() || currentRegion);
          
          values.set('AWS_ACCESS_KEY_ID', awsId);
          values.set('AWS_SECRET_ACCESS_KEY', awsSecret);
          values.set('AWS_REGION', awsRegion);
          
          touchedKeys.add('AWS_ACCESS_KEY_ID');
          touchedKeys.add('AWS_SECRET_ACCESS_KEY');
          touchedKeys.add('AWS_REGION');
        }

        if (await askYesNo(rl, 'Configure Google Cloud Storage?', Boolean(values.get('GOOGLE_APPLICATION_CREDENTIALS')))) {
          const currentProject = options.gcsProjectId || values.get('GCS_PROJECT_ID') || '';
          const gcsProj = options.gcsProjectId || ((await rl.question(`GCS_PROJECT_ID${currentProject ? ` (${currentProject})` : ''}: `)).trim() || currentProject);
          const currentKeyFile = options.gcsKeyFilename || values.get('GOOGLE_APPLICATION_CREDENTIALS') || '';
          const gcsKey = options.gcsKeyFilename || ((await rl.question(`GOOGLE_APPLICATION_CREDENTIALS (path to key file)${currentKeyFile ? ` (${currentKeyFile})` : ''}: `)).trim() || currentKeyFile);
          
          if (gcsProj) {
            values.set('GCS_PROJECT_ID', gcsProj);
            touchedKeys.add('GCS_PROJECT_ID');
          }
          if (gcsKey) {
            values.set('GOOGLE_APPLICATION_CREDENTIALS', gcsKey);
            touchedKeys.add('GOOGLE_APPLICATION_CREDENTIALS');
          }
        }

        if (await askYesNo(rl, 'Configure Vercel Blob?', Boolean(values.get('BLOB_READ_WRITE_TOKEN')))) {
          const blobToken = options.blobReadWriteToken || await askRequiredSecret(rl, 'BLOB_READ_WRITE_TOKEN: ');
          values.set('BLOB_READ_WRITE_TOKEN', blobToken);
          touchedKeys.add('BLOB_READ_WRITE_TOKEN');
        }
      }
    }

    const installCameraDeps = options.installCameraDeps === undefined ? undefined : normalizeBooleanOption(options.installCameraDeps);
    if (!options.yes && installCameraDeps === undefined) {
      console.log(chalk.cyan('\nDesktop camera'));
      console.log(chalk.gray('Screenshots and clipboard use built-in OS tools. Camera capture needs ffmpeg so ZilMate can grab a still photo reliably.'));
      const hasFfmpeg = await commandExists('ffmpeg');
      if (hasFfmpeg) {
        console.log(chalk.green('ffmpeg is already available.'));
      } else if (await askYesNo(rl, 'ffmpeg is missing. Install camera dependency now?', false)) {
        try {
          const installed = await installCameraDependency();
          console.log(installed ? chalk.green('ffmpeg is ready.') : chalk.yellow('ffmpeg was not detected after install. Run `zilmate camera doctor` after checking PATH.'));
        } catch (error) {
          console.log(chalk.yellow(error instanceof Error ? error.message : String(error)));
          console.log(chalk.gray('Setup will continue. You can install ffmpeg later and run `zilmate camera doctor`.'));
        }
      }

      const currentDevice = values.get('ZILMATE_CAMERA_DEVICE') || '';
      if (await askYesNo(rl, 'Set a specific camera device now?', Boolean(currentDevice))) {
        const cameraDevice = (await rl.question(`Camera device${currentDevice ? ` (${currentDevice})` : ' (blank for auto-detect)'}: `)).trim();
        values.set('ZILMATE_CAMERA_DEVICE', cameraDevice || currentDevice);
        touchedKeys.add('ZILMATE_CAMERA_DEVICE');
      }

      const checks = await runCameraDoctor();
      console.log(chalk.gray(`Camera check: ${checks.map((check) => `${check.name} ${check.status}`).join(', ')}`));
    } else if (installCameraDeps) {
      if (!(await commandExists('ffmpeg'))) await installCameraDependency();
    }

    const installCloudflareDeps = options.installCloudflareDeps === undefined ? undefined : normalizeBooleanOption(options.installCloudflareDeps);
    if (!options.yes && installCloudflareDeps === undefined) {
      console.log(chalk.cyan('\nCloudflare Tunnel'));
      console.log(chalk.gray('For background jobs, an optional Cloudflare Quick Tunnel can route Upstash QStash webhook requests to your local computer. This needs cloudflared.'));
      const hasCloudflared = await isCloudflaredAvailable();
      if (hasCloudflared) {
        console.log(chalk.green('cloudflared is already available.'));
      } else if (await askYesNo(rl, 'cloudflared is missing. Download/install Cloudflare tunnel automatically?', false)) {
        try {
          await ensureCloudflared();
        } catch (error) {
          console.log(chalk.yellow(error instanceof Error ? error.message : String(error)));
          console.log(chalk.gray('Setup will continue. You can install cloudflared later.'));
        }
      }
    } else if (installCloudflareDeps) {
      if (!(await isCloudflaredAvailable())) {
        try {
          await ensureCloudflared();
        } catch (error) {
          console.log(chalk.yellow(`Could not auto-install cloudflared: ${error instanceof Error ? error.message : String(error)}`));
        }
      }
    }
    
    // Unified Corporate Wiki Configuration
    if (options.corporateWikiProvider) {
      values.set('CORPORATE_WIKI_PROVIDER', options.corporateWikiProvider);
      touchedKeys.add('CORPORATE_WIKI_PROVIDER');
      if (options.supermemoryApiKey) {
        values.set('SUPERMEMORY_API_KEY', options.supermemoryApiKey);
        touchedKeys.add('SUPERMEMORY_API_KEY');
      }
      if (options.upstashVectorRestUrl && options.upstashVectorRestToken) {
        values.set('UPSTASH_VECTOR_REST_URL', options.upstashVectorRestUrl);
        values.set('UPSTASH_VECTOR_REST_TOKEN', options.upstashVectorRestToken);
        touchedKeys.add('UPSTASH_VECTOR_REST_URL');
        touchedKeys.add('UPSTASH_VECTOR_REST_TOKEN');
      }
    } else if (!options.yes && (!values.has('CORPORATE_WIKI_PROVIDER') || options.force)) {
      if (await askSection(
        rl,
        'Unified Corporate Wiki Memory',
        'Configure a shared vector database (SuperMemory or Upstash Vector) for specialist collaboration. Falls back to a local JSON database if skipped.',
        'Configure Corporate Wiki now?',
        true,
      )) {
        console.log(chalk.gray('\nSelect Corporate Wiki Provider:'));
        console.log(chalk.gray('  1) local-file (Default fallback, zero config)'));
        console.log(chalk.gray('  2) supermemory (Persistent cloud memory)'));
        console.log(chalk.gray('  3) upstash (Durable Upstash Vector DB)'));

        const choice = (await rl.question('Enter choice (1-3, default: 1): ')).trim();
        if (choice === '2') {
          values.set('CORPORATE_WIKI_PROVIDER', 'supermemory');
          touchedKeys.add('CORPORATE_WIKI_PROVIDER');
          while (true) {
            const key = await askRequiredSecret(rl, 'SUPERMEMORY_API_KEY: ');
            process.stdout.write(chalk.gray('Verifying SuperMemory API key... '));
            const ok = await verifySupermemoryKey(key);
            if (ok) {
              console.log(chalk.green('✅ Verified!'));
              values.set('SUPERMEMORY_API_KEY', key);
              touchedKeys.add('SUPERMEMORY_API_KEY');
              break;
            } else {
              console.log(chalk.red('❌ Verification failed.'));
              const retry = await askYesNo(rl, 'The key appears to be invalid or there was a network error. Re-enter?', true);
              if (!retry) {
                values.set('SUPERMEMORY_API_KEY', key);
                touchedKeys.add('SUPERMEMORY_API_KEY');
                break;
              }
            }
          }
        } else if (choice === '3') {
          values.set('CORPORATE_WIKI_PROVIDER', 'upstash');
          touchedKeys.add('CORPORATE_WIKI_PROVIDER');
          while (true) {
            const url = await askRequiredSecret(rl, 'UPSTASH_VECTOR_REST_URL: ');
            const token = await askRequiredSecret(rl, 'UPSTASH_VECTOR_REST_TOKEN: ');
            process.stdout.write(chalk.gray('Verifying Upstash Vector connection... '));
            const ok = await verifyUpstashVectorCredentials(url, token);
            if (ok) {
              console.log(chalk.green('✅ Connected successfully!'));
              values.set('UPSTASH_VECTOR_REST_URL', url);
              values.set('UPSTASH_VECTOR_REST_TOKEN', token);
              touchedKeys.add('UPSTASH_VECTOR_REST_URL');
              touchedKeys.add('UPSTASH_VECTOR_REST_TOKEN');
              break;
            } else {
              console.log(chalk.red('❌ Connection failed.'));
              const retry = await askYesNo(rl, 'Connection failed. Re-enter Upstash Vector credentials?', true);
              if (!retry) {
                values.set('UPSTASH_VECTOR_REST_URL', url);
                values.set('UPSTASH_VECTOR_REST_TOKEN', token);
                touchedKeys.add('UPSTASH_VECTOR_REST_URL');
                touchedKeys.add('UPSTASH_VECTOR_REST_TOKEN');
                break;
              }
            }
          }
        } else {
          values.set('CORPORATE_WIKI_PROVIDER', 'local-file');
          touchedKeys.add('CORPORATE_WIKI_PROVIDER');
          console.log(chalk.green('Selected Local File fallback.'));
        }
      } else {
        values.set('CORPORATE_WIKI_PROVIDER', 'local-file');
        touchedKeys.add('CORPORATE_WIKI_PROVIDER');
      }
    }

    await writeEnvValues(envPath, values, { merge: mergeMode, touchedKeys });
    console.log(chalk.green(`Saved ${envPath}.`));
    printPanel('Setup summary', [
      ['Gateway', values.get('AI_GATEWAY_API_KEY') ? 'configured' : 'missing'],
      ['Composio', values.get('COMPOSIO_API_KEY') ? 'configured' : 'skipped'],
      ['Tavily', values.get('TAVILY_API_KEY') ? 'configured' : 'skipped'],
      ['Redis', values.get('UPSTASH_REDIS_REST_URL') && values.get('UPSTASH_REDIS_REST_TOKEN') ? 'configured' : 'local fallback'],
      ['Jobs', values.get('ZILMATE_JOBS_ENABLED') === 'true' ? 'enabled' : 'disabled'],
      ['Corporate Wiki', values.get('CORPORATE_WIKI_PROVIDER') || 'local fallback'],
      ['QStash', values.get('UPSTASH_QSTASH_TOKEN') && values.get('ZILMATE_PUBLIC_JOB_WEBHOOK_URL') ? 'configured' : 'local schedules only'],
      ['Workspace', values.get('ZILMATE_WORKSPACE') || workspaceLayout().root],
      ['Trigger workflows', values.get('ZILMATE_TRIGGER_WORKFLOWS_ENABLED') === 'true' ? 'enabled' : 'disabled'],
      ['Voice', values.get('ZILMATE_VOICE_ENABLED') === 'true' ? values.get('DEEPGRAM_API_KEY') ? 'enabled' : 'enabled, missing Deepgram key' : 'disabled'],
      ['Chat', values.get('CHAT_INTEGRATION_ENABLED') === 'true' ? 'enabled' : 'disabled'],
      ['Cloud Storage', (() => {
        const provs: string[] = [];
        if (values.get('AWS_ACCESS_KEY_ID') && values.get('AWS_SECRET_ACCESS_KEY')) provs.push('S3');
        if (values.get('GCS_PROJECT_ID') && values.get('GOOGLE_APPLICATION_CREDENTIALS')) provs.push('GCS');
        if (values.get('BLOB_READ_WRITE_TOKEN')) provs.push('Vercel Blob');
        return provs.length > 0 ? provs.join(', ') : 'disabled';
      })()],
      ['Camera', await commandExists('ffmpeg') ? 'ready' : 'needs ffmpeg'],
      ['Tunnel', await isCloudflaredAvailable() ? 'ready' : 'needs cloudflared'],
    ]);
    console.log(chalk.gray('\nNext steps:'));
    console.log(chalk.gray('  zilmate ping'));
    console.log(chalk.gray('  zilmate doctor'));
    if (values.get('ZILMATE_JOBS_ENABLED') === 'true') {
      console.log(chalk.gray('  zilmate jobs worker'));
      if (values.get('UPSTASH_QSTASH_TOKEN')) {
        console.log(chalk.gray('  zilmate jobs listen --tunnel'));
      }
    }
    if (values.get('COMPOSIO_API_KEY')) {
      console.log(chalk.gray('  zilmate apps status'));
    }
    console.log(chalk.gray('  zilmate voice doctor'));
    console.log(chalk.gray('  zilmate camera doctor'));
    console.log(chalk.gray('  zilmate daemon start  (for system-wide hotkeys: Ctrl+Shift+Z / Cmd+Shift+Z)'));
  } finally {
    rl.close();
  }
}

export async function runVoiceSetup(options: Pick<SetupOptions, 'path' | 'force' | 'deepgramApiKey' | 'voiceListenModel' | 'voiceTtsModel' | 'voiceLanguage'> = {}) {
  const envPath = resolveEnvPath(options.path);
  const existing = await readEnvValues(envPath);
  const rl = readline.createInterface({ input, output });

  try {
    printZilMateBanner('Voice setup');
    console.log(chalk.gray('This turns on realtime voice without walking through every other ZilMate setup step.'));
    console.log(chalk.gray('Defaults use Deepgram Flux V2 for fast listening and Aura-2 for spoken replies.'));

    if (existing.size > 0 && !options.force) {
      const update = await askYesNo(rl, `${envPath} already exists. Update voice settings?`, true);
      if (!update) {
        console.log(chalk.yellow('Voice setup cancelled. Existing .env was left unchanged.'));
        return;
      }
    }

    const values = new Map(existing);
    values.set('ZILMATE_VOICE_ENABLED', 'true');
    values.set('ZILMATE_VOICE_MODE', 'agent');
    values.set('ZILMATE_VOICE_BARGE_IN', 'true');

    const currentKey = options.deepgramApiKey ?? values.get('DEEPGRAM_API_KEY') ?? '';
    if (options.deepgramApiKey) {
      values.set('DEEPGRAM_API_KEY', options.deepgramApiKey);
    } else if (currentKey) {
      const replace = await askYesNo(rl, 'DEEPGRAM_API_KEY already exists. Replace it?', false);
      if (replace) {
        while (true) {
          const key = await askRequiredSecret(rl, 'DEEPGRAM_API_KEY: ');
          process.stdout.write(chalk.gray('Verifying Deepgram key... '));
          const ok = await verifyDeepgramKey(key);
          if (ok) {
            console.log(chalk.green('✅ Verified!'));
            values.set('DEEPGRAM_API_KEY', key);
            break;
          } else {
            console.log(chalk.red('❌ Verification failed.'));
            const retry = await askYesNo(rl, 'The key appears to be invalid or there was a network error. Re-enter?', true);
            if (!retry) {
              values.set('DEEPGRAM_API_KEY', key);
              break;
            }
          }
        }
      }
    } else {
      while (true) {
        const key = await askRequiredSecret(rl, 'DEEPGRAM_API_KEY: ');
        process.stdout.write(chalk.gray('Verifying Deepgram key... '));
        const ok = await verifyDeepgramKey(key);
        if (ok) {
          console.log(chalk.green('✅ Verified!'));
          values.set('DEEPGRAM_API_KEY', key);
          break;
        } else {
          console.log(chalk.red('❌ Verification failed.'));
          const retry = await askYesNo(rl, 'The key appears to be invalid or there was a network error. Re-enter?', true);
          if (!retry) {
            values.set('DEEPGRAM_API_KEY', key);
            break;
          }
        }
      }
    }

    const currentListenModel = options.voiceListenModel ?? values.get('ZILMATE_VOICE_LISTEN_MODEL') ?? 'flux-general-en';
    const listenModel = options.voiceListenModel ?? ((await rl.question(`Listen model (${currentListenModel}): `)).trim() || currentListenModel);
    values.set('ZILMATE_VOICE_LISTEN_MODEL', listenModel);
    values.set('ZILMATE_VOICE_LISTEN_VERSION', listenModel.startsWith('flux-') ? 'v2' : 'v1');

    const currentTtsModel = options.voiceTtsModel ?? values.get('ZILMATE_VOICE_TTS_MODEL') ?? 'aura-2-thalia-en';
    values.set('ZILMATE_VOICE_TTS_MODEL', options.voiceTtsModel ?? ((await rl.question(`TTS voice (${currentTtsModel}): `)).trim() || currentTtsModel));

    const currentLanguage = options.voiceLanguage ?? values.get('ZILMATE_VOICE_LANGUAGE') ?? 'en';
    values.set('ZILMATE_VOICE_LANGUAGE', options.voiceLanguage ?? ((await rl.question(`Language (${currentLanguage}): `)).trim() || currentLanguage));

    if (!values.has('ZILMATE_VOICE_LANGUAGE_HINTS')) values.set('ZILMATE_VOICE_LANGUAGE_HINTS', '');

    await writeEnvValues(envPath, values, {
      merge: existsSync(envPath),
      touchedKeys: new Set(['ZILMATE_VOICE_ENABLED', 'DEEPGRAM_API_KEY', 'ZILMATE_VOICE_LISTEN_MODEL', 'ZILMATE_VOICE_LISTEN_VERSION', 'ZILMATE_VOICE_TTS_MODEL', 'ZILMATE_VOICE_LANGUAGE', 'ZILMATE_VOICE_MODE', 'ZILMATE_VOICE_BARGE_IN']),
    });
    console.log(chalk.green(`Saved voice settings to ${envPath}.`));
    printPanel('Voice summary', [
      ['Voice', 'enabled'],
      ['Deepgram', values.get('DEEPGRAM_API_KEY') ? 'configured' : 'missing'],
      ['Listen model', `${values.get('ZILMATE_VOICE_LISTEN_MODEL')} (${values.get('ZILMATE_VOICE_LISTEN_VERSION')})`],
      ['TTS voice', values.get('ZILMATE_VOICE_TTS_MODEL') || 'aura-2-thalia-en'],
      ['Language', values.get('ZILMATE_VOICE_LANGUAGE') || 'en'],
    ]);
    console.log(chalk.gray('\nNext steps:'));
    console.log(chalk.gray('  zilmate voice doctor'));
    console.log(chalk.gray('  zilmate voice config'));
  } finally {
    rl.close();
  }
}

export async function setVoiceEnabled(enabled: boolean, options: Pick<SetupOptions, 'path'> = {}) {
  const envPath = resolveEnvPath(options.path);
  const values = await readEnvValues(envPath);
  values.set('ZILMATE_VOICE_ENABLED', enabled ? 'true' : 'false');
  if (enabled) {
    values.set('ZILMATE_VOICE_MODE', values.get('ZILMATE_VOICE_MODE') || 'agent');
    values.set('ZILMATE_VOICE_LISTEN_MODEL', values.get('ZILMATE_VOICE_LISTEN_MODEL') || 'flux-general-en');
    values.set('ZILMATE_VOICE_LISTEN_VERSION', values.get('ZILMATE_VOICE_LISTEN_VERSION') || 'v2');
    values.set('ZILMATE_VOICE_TTS_MODEL', values.get('ZILMATE_VOICE_TTS_MODEL') || 'aura-2-thalia-en');
    values.set('ZILMATE_VOICE_LANGUAGE', values.get('ZILMATE_VOICE_LANGUAGE') || 'en');
    values.set('ZILMATE_VOICE_BARGE_IN', values.get('ZILMATE_VOICE_BARGE_IN') || 'true');
  }
  await writeEnvValues(envPath, values, { merge: existsSync(envPath) });
  printPanel('Voice', [
    ['Status', enabled ? 'enabled' : 'disabled'],
    ['Deepgram', values.get('DEEPGRAM_API_KEY') ? 'configured' : 'missing'],
    ['Next', enabled ? values.get('DEEPGRAM_API_KEY') ? 'zilmate voice doctor' : 'zilmate voice setup' : 'zilmate voice enable'],
  ]);
}

export async function runChatSetup(options: Pick<SetupOptions, 'path' | 'force' | 'slackBotToken' | 'slackSigningSecret' | 'telegramBotToken' | 'imessageEnabled' | 'imessageLocal'> = {}) {
  const envPath = resolveEnvPath(options.path);
  const existing = await readEnvValues(envPath);
  const rl = readline.createInterface({ input, output });

  try {
    printZilMateBanner('Chat setup');
    console.log(chalk.gray('Configure Slack, Telegram, and iMessage channels for ZilMate.'));

    const values = new Map(existing);
    values.set('CHAT_INTEGRATION_ENABLED', 'true');

    if (options.slackBotToken) {
      values.set('SLACK_BOT_TOKEN', options.slackBotToken);
      if (options.slackSigningSecret) values.set('SLACK_SIGNING_SECRET', options.slackSigningSecret);
    } else if (await askYesNo(rl, 'Configure Slack?', Boolean(values.get('SLACK_BOT_TOKEN')))) {
      values.set('SLACK_BOT_TOKEN', await askRequiredSecret(rl, 'SLACK_BOT_TOKEN: '));
      values.set('SLACK_SIGNING_SECRET', await askOptionalSecret(rl, 'SLACK_SIGNING_SECRET: '));
    }

    if (options.telegramBotToken) {
      values.set('TELEGRAM_BOT_TOKEN', options.telegramBotToken);
    } else if (await askYesNo(rl, 'Configure Telegram?', Boolean(values.get('TELEGRAM_BOT_TOKEN')))) {
      values.set('TELEGRAM_BOT_TOKEN', await askRequiredSecret(rl, 'TELEGRAM_BOT_TOKEN: '));
    }

    const imessageEnabled = options.imessageEnabled !== undefined ? normalizeBooleanOption(options.imessageEnabled) : undefined;
    if (imessageEnabled !== undefined) {
      values.set('CHAT_IMESSAGE_ENABLED', imessageEnabled ? 'true' : 'false');
      if (options.imessageLocal !== undefined) values.set('IMESSAGE_LOCAL', normalizeBooleanOption(options.imessageLocal) ? 'true' : 'false');
    } else if (await askYesNo(rl, 'Configure iMessage?', values.get('CHAT_IMESSAGE_ENABLED') === 'true')) {
      values.set('CHAT_IMESSAGE_ENABLED', 'true');
      if (process.platform === 'darwin') {
        values.set('IMESSAGE_LOCAL', (await askYesNo(rl, 'Use local iMessage database (macOS only)?', true)) ? 'true' : 'false');
      } else {
        values.set('IMESSAGE_LOCAL', 'false');
      }
    }

    await writeEnvValues(envPath, values, {
      merge: existsSync(envPath),
      touchedKeys: new Set(['CHAT_INTEGRATION_ENABLED', 'SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'TELEGRAM_BOT_TOKEN', 'CHAT_IMESSAGE_ENABLED', 'IMESSAGE_LOCAL']),
    });

    console.log(chalk.green(`Saved chat settings to ${envPath}.`));
    printPanel('Chat summary', [
      ['Status', 'enabled'],
      ['Slack', values.get('SLACK_BOT_TOKEN') ? 'configured' : 'missing'],
      ['Telegram', values.get('TELEGRAM_BOT_TOKEN') ? 'configured' : 'missing'],
      ['iMessage', values.get('CHAT_IMESSAGE_ENABLED') === 'true' ? values.get('IMESSAGE_LOCAL') === 'true' ? 'enabled (Local)' : 'enabled (Remote)' : 'disabled'],
    ]);
  } finally {
    rl.close();
  }
}
