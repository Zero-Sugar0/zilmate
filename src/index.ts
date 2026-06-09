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

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/AI_GATEWAY_API_KEY|VERCEL_OIDC_TOKEN|TAVILY_API_KEY/.test(message)) return message;
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
  .option('--tavily-key <key>', 'optional Tavily API key for web research')
  .option('--redis-url <url>', 'optional Upstash Redis REST URL')
  .option('--redis-token <token>', 'optional Upstash Redis REST token')
  .description('Create or update a local .env file for ZilMate')
  .action(async (options: { path: string; force?: boolean; yes?: boolean; aiGatewayKey?: string; tavilyKey?: string; redisUrl?: string; redisToken?: string }) => {
    try {
      await runSetup({
        path: options.path,
        force: Boolean(options.force),
        yes: Boolean(options.yes),
        ...(options.aiGatewayKey !== undefined ? { aiGatewayKey: options.aiGatewayKey } : {}),
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
  .description('Route a one-shot task through the manager agent')
  .action(async (prompt: string[]) => {
    try {
      requireGatewayAuth();
      await printResult(await runManager(prompt.join(' '), { progress: printProgress }));
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






