import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import chalk from 'chalk';

type SetupOptions = {
  path?: string;
  force?: boolean;
  yes?: boolean;
  aiGatewayKey?: string;
  tavilyKey?: string;
  redisUrl?: string;
  redisToken?: string;
};

const defaults = {
  ZILO_MANAGER_MODEL: 'minimax/minimax-m3',
  ZILO_HELP_MODEL: 'alibaba/qwen3.7-plus',
  ZILO_POST_MODEL: 'alibaba/qwen3.7-plus',
  ZILO_IMAGE_DEFAULT_PROVIDER: 'openai',
  ZILO_IMAGE_OPENAI_MODEL: 'openai/gpt-image-2',
  ZILO_IMAGE_GEMINI_MODEL: 'google/gemini-3-pro-image',
  ZILO_IMAGE_MODEL: '',
};

function parseEnvFile(content: string) {
  const values = new Map<string, string>();
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!key || rawValue === undefined) continue;
    values.set(key, rawValue.replace(/^"(.*)"$/, '$1'));
  }
  return values;
}

function formatEnvValue(value: string) {
  if (!value) return '';
  if (/^[A-Za-z0-9_./:@+=-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

async function askRequiredSecret(rl: readline.Interface, prompt: string) {
  while (true) {
    const value = await rl.question(prompt);
    if (value.trim()) return value.trim();
    console.log(chalk.yellow('This value is required.'));
  }
}

async function askOptionalSecret(rl: readline.Interface, prompt: string) {
  const value = await rl.question(prompt);
  return value.trim();
}

async function askYesNo(rl: readline.Interface, prompt: string, defaultValue = false) {
  const suffix = defaultValue ? 'Y/n' : 'y/N';
  const answer = (await rl.question(`${prompt} (${suffix}) `)).trim().toLowerCase();
  if (!answer) return defaultValue;
  return answer === 'y' || answer === 'yes';
}

function buildEnv(values: Map<string, string>) {
  const lines: Array<[string, string]> = [
    ['AI_GATEWAY_API_KEY', values.get('AI_GATEWAY_API_KEY') || ''],
    ['TAVILY_API_KEY', values.get('TAVILY_API_KEY') || ''],
    ['UPSTASH_REDIS_REST_URL', values.get('UPSTASH_REDIS_REST_URL') || ''],
    ['UPSTASH_REDIS_REST_TOKEN', values.get('UPSTASH_REDIS_REST_TOKEN') || ''],
    ['ZILO_MANAGER_MODEL', values.get('ZILO_MANAGER_MODEL') || defaults.ZILO_MANAGER_MODEL],
    ['ZILO_HELP_MODEL', values.get('ZILO_HELP_MODEL') || defaults.ZILO_HELP_MODEL],
    ['ZILO_POST_MODEL', values.get('ZILO_POST_MODEL') || defaults.ZILO_POST_MODEL],
    ['ZILO_IMAGE_DEFAULT_PROVIDER', values.get('ZILO_IMAGE_DEFAULT_PROVIDER') || defaults.ZILO_IMAGE_DEFAULT_PROVIDER],
    ['ZILO_IMAGE_OPENAI_MODEL', values.get('ZILO_IMAGE_OPENAI_MODEL') || defaults.ZILO_IMAGE_OPENAI_MODEL],
    ['ZILO_IMAGE_GEMINI_MODEL', values.get('ZILO_IMAGE_GEMINI_MODEL') || defaults.ZILO_IMAGE_GEMINI_MODEL],
    ['ZILO_IMAGE_MODEL', values.get('ZILO_IMAGE_MODEL') || defaults.ZILO_IMAGE_MODEL],
  ];

  return `${lines.map(([key, value]) => `${key}=${formatEnvValue(value)}`).join('\n')}\n`;
}

export async function runSetup(options: SetupOptions = {}) {
  const envPath = options.path || '.env';
  const existing = existsSync(envPath) ? parseEnvFile(await readFile(envPath, 'utf8')) : new Map<string, string>();
  const rl = readline.createInterface({ input, output });

  try {
    console.log(chalk.cyan('ZilMate setup'));
    console.log(chalk.gray(`Writing local environment config to ${envPath}`));

    if (existing.size > 0 && !options.force && !options.yes) {
      const overwrite = await askYesNo(rl, `${envPath} already exists. Update it?`, false);
      if (!overwrite) {
        console.log(chalk.yellow('Setup cancelled. Existing .env was left unchanged.'));
        return;
      }
    }

    const values = new Map(existing);
    if (options.aiGatewayKey) values.set('AI_GATEWAY_API_KEY', options.aiGatewayKey);
    if (options.tavilyKey !== undefined) values.set('TAVILY_API_KEY', options.tavilyKey);
    if (options.redisUrl !== undefined) values.set('UPSTASH_REDIS_REST_URL', options.redisUrl);
    if (options.redisToken !== undefined) values.set('UPSTASH_REDIS_REST_TOKEN', options.redisToken);

    const currentGatewayKey = values.get('AI_GATEWAY_API_KEY');
    if (options.aiGatewayKey) {
      values.set('AI_GATEWAY_API_KEY', options.aiGatewayKey);
    } else if (!currentGatewayKey && options.yes) {
      throw new Error('AI_GATEWAY_API_KEY is required. Pass --ai-gateway-key or run setup interactively.');
    } else if (currentGatewayKey) {
      const replace = await askYesNo(rl, 'AI_GATEWAY_API_KEY already exists. Replace it?', false);
      if (replace) values.set('AI_GATEWAY_API_KEY', await askRequiredSecret(rl, 'AI_GATEWAY_API_KEY: '));
    } else {
      values.set('AI_GATEWAY_API_KEY', await askRequiredSecret(rl, 'AI_GATEWAY_API_KEY: '));
    }

    if (!options.yes && options.tavilyKey === undefined && await askYesNo(rl, 'Add Tavily web search key?', Boolean(values.get('TAVILY_API_KEY')))) {
      const tavilyKey = await askOptionalSecret(rl, 'TAVILY_API_KEY (blank to skip): ');
      values.set('TAVILY_API_KEY', tavilyKey);
    }

    if (!options.yes && options.redisUrl === undefined && options.redisToken === undefined && await askYesNo(rl, 'Configure Upstash Redis memory?', Boolean(values.get('UPSTASH_REDIS_REST_URL') && values.get('UPSTASH_REDIS_REST_TOKEN')))) {
      values.set('UPSTASH_REDIS_REST_URL', (await rl.question('UPSTASH_REDIS_REST_URL: ')).trim());
      values.set('UPSTASH_REDIS_REST_TOKEN', await askOptionalSecret(rl, 'UPSTASH_REDIS_REST_TOKEN: '));
    }

    for (const [key, value] of Object.entries(defaults)) {
      if (!values.has(key)) values.set(key, value);
    }

    await writeFile(envPath, buildEnv(values), 'utf8');
    console.log(chalk.green(`Saved ${envPath}.`));
    console.log(chalk.gray('Try: zilmate ping'));
  } finally {
    rl.close();
  }
}
