#!/usr/bin/env node
import { Command } from 'commander';
import { generateText } from 'ai';
import { requireGatewayAuth } from './config/env.js';
import { getModelAvailability, models } from './config/models.js';
import { runManager } from './agents/manager.js';
import { createQuickHelpAgent } from './agents/quick-help.agent.js';
import { createChatAgent } from './agents/chat.agent.js';
import { createPostAgent } from './agents/post.agent.js';
import { createDocsResearchAgent } from './agents/docs-research.agent.js';
import { generateImageAsset, isImageSize } from './tools/image-generate.tool.js';
import { startInteractiveChat } from './cli/interactive.js';
import { runSetup } from './cli/setup.js';
import { memoryBackendName } from './memory/redis.js';
import { printError, printJson, printMarkdown, printProgress } from './cli/format.js';
import { createTerminalConfirmation } from './cli/confirm.js';
import { getComposioStatus } from './tools/composio.tool.js';
import { getResolvedConfigSummary, runDoctor, type DoctorCheck } from './cli/doctor.js';
import { clearMemories, forget, listMemories, recall, remember } from './memory/long-term.js';
import { createTrigger, listenToTriggers, listTriggers, listTriggerTypes, showTriggerType } from './cli/triggers.js';

type TextAgentFactory = () => { generate: (input: { prompt: string }) => Promise<{ text: string }> };

async function printResult(value: string | unknown) {
  if (typeof value === 'string') {
    printMarkdown(value);
  } else {
    printJson(value);
  }
}

async function runAgentText(agentFactory: TextAgentFactory, prompt: string) {
  requireGatewayAuth();
  const result = await agentFactory().generate({ prompt });
  await printResult(result.text);
}

function printDoctorChecks(checks: DoctorCheck[]) {
  for (const check of checks) {
    const label = check.status.toUpperCase().padEnd(4);
    console.log(`${label} ${check.name}: ${check.detail}`);
  }
}

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/AI_GATEWAY_API_KEY|VERCEL_OIDC_TOKEN|TAVILY_API_KEY|COMPOSIO_API_KEY|ZILMATE_USER_ID/.test(message)) return message;
  return `ZilMate failed: ${message}`;
}

const program = new Command();
program
  .name('zilmate')
  .description('ZilMate CLI agent for ZiloShift workflows')
  .version('1.0.0');

program
  .command('setup')
  .option('-p, --path <file>', 'environment file to create or update', '.env')
  .option('-f, --force', 'skip the first overwrite confirmation when the env file exists')
  .option('-y, --yes', 'noninteractive mode; write defaults plus provided keys')
  .option('--ai-gateway-key <key>', 'AI Gateway API key')
  .option('--composio-key <key>', 'optional Composio API key for external app tools')
  .option('--zilmate-user-id <id>', 'stable local user id for Composio sessions')
  .option('--tavily-key <key>', 'optional Tavily API key for web research')
  .option('--redis-url <url>', 'optional Upstash Redis REST URL')
  .option('--redis-token <token>', 'optional Upstash Redis REST token')
  .description('Create or update a local .env file for ZilMate')
  .action(async (options: { path: string; force?: boolean; yes?: boolean; aiGatewayKey?: string; composioKey?: string; zilmateUserId?: string; tavilyKey?: string; redisUrl?: string; redisToken?: string }) => {
    try {
      await runSetup({
        path: options.path,
        force: Boolean(options.force),
        yes: Boolean(options.yes),
        ...(options.aiGatewayKey !== undefined ? { aiGatewayKey: options.aiGatewayKey } : {}),
        ...(options.composioKey !== undefined ? { composioKey: options.composioKey } : {}),
        ...(options.zilmateUserId !== undefined ? { zilmateUserId: options.zilmateUserId } : {}),
        ...(options.tavilyKey !== undefined ? { tavilyKey: options.tavilyKey } : {}),
        ...(options.redisUrl !== undefined ? { redisUrl: options.redisUrl } : {}),
        ...(options.redisToken !== undefined ? { redisToken: options.redisToken } : {}),
      });
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

program
  .command('doctor')
  .option('--live', 'also run live Gateway and Composio checks')
  .option('-s, --session <id>', 'Composio/ZilMate session id for live checks', 'default')
  .option('--json', 'print JSON output')
  .description('Check local ZilMate config, keys, memory, Node, and optional live integrations')
  .action(async (options: { live?: boolean; session: string; json?: boolean }) => {
    try {
      const checks = await runDoctor({ live: Boolean(options.live), sessionId: options.session });
      if (options.json) {
        printJson(checks);
      } else {
        printDoctorChecks(checks);
      }
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

const envCommand = program
  .command('env')
  .description('Inspect ZilMate environment setup');

envCommand
  .command('check')
  .option('--live', 'also run live Gateway and Composio checks')
  .option('-s, --session <id>', 'Composio/ZilMate session id for live checks', 'default')
  .option('--json', 'print JSON output')
  .description('Alias for zilmate doctor focused on environment readiness')
  .action(async (options: { live?: boolean; session: string; json?: boolean }) => {
    try {
      const checks = await runDoctor({ live: Boolean(options.live), sessionId: options.session });
      if (options.json) {
        printJson(checks);
      } else {
        printDoctorChecks(checks);
      }
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

program
  .command('config')
  .description('Show sanitized ZilMate configuration without secrets')
  .action(async () => {
    try {
      printJson(await getResolvedConfigSummary());
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

program
  .command('remember')
  .argument('<note...>', 'memory text to save')
  .option('-t, --tag <tag...>', 'optional memory tags')
  .description('Save a durable long-term ZilMate memory')
  .action(async (note: string[], options: { tag?: string[] }) => {
    try {
      const memory = await remember(note.join(' '), options.tag ?? []);
      printJson(memory);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

program
  .command('recall')
  .argument('[query...]', 'memory query; omitted means recent memories')
  .option('-l, --limit <number>', 'maximum memories to return', '8')
  .description('Recall durable long-term ZilMate memories')
  .action(async (query: string[] | undefined, options: { limit: string }) => {
    try {
      const limit = Number.parseInt(options.limit, 10);
      printJson(await recall((query ?? []).join(' '), Number.isFinite(limit) ? limit : 8));
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

program
  .command('forget')
  .argument('[id]', 'memory id to forget')
  .option('--all', 'forget all memories')
  .description('Forget one durable memory by id')
  .action(async (id: string | undefined, options: { all?: boolean }) => {
    try {
      if (options.all) {
        await clearMemories();
        printJson({ cleared: true });
        return;
      }
      if (!id) throw new Error('Pass a memory id, or use --all to clear every memory.');
      printJson({ id, deleted: await forget(id) });
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

const memoryCommand = program
  .command('memory')
  .description('Manage durable long-term ZilMate memory');

memoryCommand
  .command('list')
  .description('List all durable long-term memories')
  .action(async () => {
    try {
      printJson(await listMemories());
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

const apps = program
  .command('apps')
  .description('Manage external app tooling through Composio');

apps
  .command('status')
  .option('-s, --session <id>', 'ZilMate chat session id', 'default')
  .description('Show Composio setup, user id, session, and toolkit connection status')
  .action(async (options: { session: string }) => {
    try {
      const status = await getComposioStatus(options.session);
      printJson(status);
      if (!status.configured) {
        console.log('Composio is not configured. Run `zilmate setup` and add `COMPOSIO_API_KEY` to enable GitHub/Gmail/Slack/Stripe/Supabase-style external app tools.');
      }
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

const triggers = program
  .command('triggers')
  .description('Listen to and manage Composio trigger events');

triggers
  .command('types')
  .argument('[toolkit]', 'optional toolkit slug, e.g. github or gmail')
  .option('-l, --limit <number>', 'maximum trigger types to show', '25')
  .option('--json', 'print JSON output')
  .description('List available Composio trigger types')
  .action(async (toolkit: string | undefined, options: { limit?: string; json?: boolean }) => {
    try {
      await listTriggerTypes(toolkit, options);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

triggers
  .command('info')
  .argument('<trigger>', 'trigger type slug, e.g. GITHUB_COMMIT_EVENT')
  .option('--json', 'print JSON output')
  .description('Show one Composio trigger type schema')
  .action(async (trigger: string, options: { json?: boolean }) => {
    try {
      await showTriggerType(trigger, options);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

triggers
  .command('list')
  .option('-l, --limit <number>', 'maximum trigger instances to show', '25')
  .option('--show-disabled', 'include disabled trigger instances')
  .option('--json', 'print JSON output')
  .description('List active Composio trigger instances')
  .action(async (options: { limit?: string; showDisabled?: boolean; json?: boolean }) => {
    try {
      await listTriggers(options);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

triggers
  .command('create')
  .argument('<trigger>', 'trigger type slug, e.g. GITHUB_COMMIT_EVENT')
  .option('--connected-account <id>', 'specific connected account id to use')
  .option('--config <json>', 'trigger config as a JSON object')
  .option('--dry-run', 'print the create payload without creating a trigger')
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .description('Create a Composio trigger instance; unknown --flags become trigger config')
  .action(async (trigger: string, options: { connectedAccount?: string; config?: string; dryRun?: boolean }, command: Command) => {
    try {
      const unknownArgs = command.args.filter((arg) => arg !== trigger);
      await createTrigger(trigger, options, unknownArgs);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

triggers
  .command('listen')
  .option('--trigger <id>', 'filter by trigger instance id')
  .option('--trigger-slug <slug...>', 'filter by trigger type slug')
  .option('--toolkit <slug...>', 'filter by toolkit slug')
  .option('--connected-account <id>', 'filter by connected account id')
  .option('--trigger-data <value>', 'filter by trigger data')
  .option('--user-id <id>', 'filter by Composio user id')
  .option('--json', 'print full event JSON')
  .option('--once', 'exit after the first matching event')
  .description('Stream Composio trigger events into the terminal')
  .action(async (options: { trigger?: string; triggerSlug?: string[]; toolkit?: string[]; connectedAccount?: string; triggerData?: string; userId?: string; json?: boolean; once?: boolean }) => {
    try {
      await listenToTriggers(options);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

program
  .command('models')
  .description('Show configured Gateway models and availability warnings')
  .action(async () => {
    try {
      requireGatewayAuth();
      const availability = await getModelAvailability();
      printJson({
        selected: availability.selected,
        memory: memoryBackendName(),
        availableCount: availability.availableIds.length,
        missing: availability.missing,
        warnings: availability.warnings,
      });
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

program
  .command('talk')
  .option('-s, --session <id>', 'persistent chat session id', 'default')
  .description('Start an interactive chat with the main manager agent')
  .action(async (options: { session: string }) => {
    try {
      await startInteractiveChat(options.session);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

program
  .command('chat')
  .argument('<message...>', 'message to discuss')
  .description('One-shot natural dialogue about ZiloShift')
  .action(async (message: string[]) => {
    try {
      await runAgentText(createChatAgent, message.join(' '));
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

program
  .command('help')
  .argument('<question...>', 'quick-help question')
  .description('Fast troubleshooting and app guidance')
  .action(async (question: string[]) => {
    try {
      await runAgentText(createQuickHelpAgent, question.join(' '));
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

program
  .command('post')
  .argument('<prompt...>', 'post generation prompt')
  .description('Generate WhatsApp/status/social copy')
  .action(async (prompt: string[]) => {
    try {
      await runAgentText(createPostAgent, prompt.join(' '));
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

program
  .command('research')
  .argument('<query...>', 'research query')
  .description('Search docs/web and return sourced research')
  .action(async (query: string[]) => {
    try {
      await runAgentText(createDocsResearchAgent, query.join(' '));
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

program
  .command('image')
  .argument('<prompt...>', 'image prompt')
  .option('-m, --model <model>', 'image model: openai|chatgpt|gemini', 'openai')
  .option('--size <size>', 'image size for OpenAI, e.g. 1024x1024')
  .description('Generate an image and save it under outputs/images')
  .action(async (prompt: string[], options: { model: string; size?: string }) => {
    try {
      const result = await generateImageAsset(prompt.join(' '), {
        provider: options.model as 'openai' | 'chatgpt' | 'gemini' | 'google' | 'default',
        ...(isImageSize(options.size) ? { size: options.size } : {}),
      });
      await printResult(result);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

program
  .command('manager')
  .argument('<prompt...>', 'manager orchestration prompt')
  .option('-s, --session <id>', 'persistent manager session id for Composio tools', 'default')
  .description('Route a one-shot task through the manager agent')
  .action(async (prompt: string[], options: { session: string }) => {
    try {
      requireGatewayAuth();
      await printResult(await runManager(prompt.join(' '), {
        progress: printProgress,
        sessionId: options.session,
        confirm: createTerminalConfirmation(),
      }));
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

program
  .command('ping')
  .description('Make a tiny Gateway text call to verify auth')
  .action(async () => {
    try {
      requireGatewayAuth();
      const result = await generateText({ model: models.help, prompt: 'Reply with exactly: ZilMate online' });
      await printResult(result.text);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv).catch((error) => {
  printError(friendlyError(error));
  process.exitCode = 1;
});






