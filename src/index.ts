#!/usr/bin/env node
import { Command } from 'commander';
import { generateText } from 'ai';
import { requireGatewayAuth } from './config/env.js';
import { models } from './config/models.js';
import { runManager } from './agents/manager.js';
import { createQuickHelpAgent } from './agents/quick-help.agent.js';
import { createChatAgent } from './agents/chat.agent.js';
import { createPostAgent } from './agents/post.agent.js';
import { createDocsResearchAgent } from './agents/docs-research.agent.js';
import { generateImageAsset, isImageSize } from './tools/image-generate.tool.js';
import { startInteractiveChat } from './cli/interactive.js';
import { runSetup, runVoiceSetup, runChatSetup, setVoiceEnabled } from './cli/setup.js';
import { printError, printJson, printMarkdown, printProgress } from './cli/format.js';
import { createTerminalConfirmation } from './cli/confirm.js';
import { getComposioStatus } from './tools/composio.tool.js';
import { getResolvedConfigSummary, runDoctor } from './cli/doctor.js';
import { clearMemories, forget, listMemories, recall, remember } from './memory/long-term.js';
import { createTrigger, listenToTriggers, listTriggers, listTriggerTypes, showTriggerType } from './cli/triggers.js';
import { cancelCliJob, createCliJob, listCliJobs, runCliJob, showCliJob, showCliJobLogs, startCliJobListener, startCliJobWorker } from './cli/jobs.js';
import { initWorkspace } from './workspace/init.js';
import { workspaceLayout } from './workspace/paths.js';
import { runHeal } from './memory/heal.js';
import { runSwarmCli } from './cli/swarm.js';
import { printWelcomeScreen } from './cli/welcome.js';
import { startDefaultLauncher, startMainMenu } from './cli/menu.js';
import { printDoctorChecks } from './cli/health.js';
import { printAppsStatus } from './cli/apps.js';
import { printMemoryTable } from './cli/memory.js';
import { listVoiceDevices, printVoiceConfig, runTerminalVoiceLive, runVoiceAgentProbe, runVoiceDoctor, runVoiceSpeakTest, runVoiceTurn } from './cli/voice.js';
import { printVersionStatus, runSelfUpdate } from './cli/update.js';
import { captureCameraCli, listCameraDevicesCli, runCameraDoctorCli } from './cli/camera.js';
import { printModelBrowser } from './cli/models.js';

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
  if (/AI_GATEWAY_API_KEY|VERCEL_OIDC_TOKEN|TAVILY_API_KEY|COMPOSIO_API_KEY|ZILMATE_USER_ID/.test(message)) return message;
  return `ZilMate failed: ${message}`;
}

const program = new Command();
program
  .name('zilmate')
  .description('ZilMate Agent')
  .version('1.7.5');

program
  .command('welcome')
  .description('Show the ZilMate welcome dashboard')
  .action(async () => {
    try {
      await printWelcomeScreen();
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

program
  .command('version')
  .description('Show current ZilMate version and check npm for updates')
  .action(async () => {
    try {
      await printVersionStatus(program.version() || 'unknown');
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

program
  .command('update')
  .option('--tag <tag>', 'npm dist-tag or version to install', 'latest')
  .option('--dry-run', 'show the update command without running it')
  .description('Update the global ZilMate CLI/SDK from npm')
  .action(async (options: { tag?: string; dryRun?: boolean }) => {
    try {
      await runSelfUpdate({
        ...(options.tag !== undefined ? { tag: options.tag } : {}),
        dryRun: Boolean(options.dryRun),
      });
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

program
  .command('menu')
  .description('Start the ZilMate CLI main menu')
  .action(async () => {
    try {
      await startMainMenu();
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

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
  .option('--jobs-enabled <true|false>', 'enable or disable background jobs')
  .option('--qstash-token <token>', 'optional Upstash QStash token')
  .option('--job-webhook-url <url>', 'publicly accessible ZilMate webhook URL for scheduling')
  .option('--job-webhook-secret <secret>', 'secret for verifying job webhooks')
  .option('--trigger-workflows-enabled <true|false>', 'enable or disable Composio trigger workflows')
  .option('--deepgram-key <key>', 'optional Deepgram API key for realtime voice')
  .option('--voice-enabled <true|false>', 'enable or disable realtime voice by default')
  .option('--voice-listen-model <model>', 'Deepgram listen model')
  .option('--voice-tts-model <model>', 'Deepgram TTS model')
  .option('--voice-language <language>', 'voice language, e.g. en')
  .option('--voice-input-device <device>', 'specific input device index or id')
  .option('--screenshot-model <model>', 'vision model for describing screenshots')
  .option('--file-roots <roots>', 'comma-separated list of approved file roots')
  .option('--camera-device <device>', 'specific camera device name or id')
  .option('--install-camera-deps <true|false>', 'install ffmpeg for camera photo capture')
  .option('--install-cloudflare-deps <true|false>', 'install cloudflared for quick tunnels')
  .description('Interactive wizard to configure ZilMate credentials and features')
  .action(async (options: any) => {
    try {
      await runSetup({
        path: options.path,
        force: options.force,
        yes: options.yes,
        aiGatewayKey: options.aiGatewayKey,
        composioKey: options.composioKey,
        zilmateUserId: options.zilmateUserId,
        tavilyKey: options.tavilyKey,
        redisUrl: options.redisUrl,
        redisToken: options.redisToken,
        jobsEnabled: options.jobsEnabled,
        qstashToken: options.qstashToken,
        publicJobWebhookUrl: options.jobWebhookUrl,
        jobWebhookSecret: options.jobWebhookSecret,
        triggerWorkflowsEnabled: options.triggerWorkflowsEnabled,
        deepgramApiKey: options.deepgramKey,
        voiceEnabled: options.voiceEnabled,
        voiceListenModel: options.voiceListenModel,
        voiceTtsModel: options.voiceTtsModel,
        voiceLanguage: options.voiceLanguage,
        voiceInputDevice: options.voiceInputDevice,
        screenshotModel: options.screenshotModel,
        fileRoots: options.fileRoots,
        cameraDevice: options.cameraDevice,
        installCameraDeps: options.installCameraDeps,
        installCloudflareDeps: options.installCloudflareDeps,
      });
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

const setup = program.command('setup');

setup
  .command('voice')
  .option('-p, --path <file>', 'environment file to create or update', '.env')
  .option('-f, --force', 'skip the first update confirmation when the env file exists')
  .option('--deepgram-key <key>', 'Deepgram API key for realtime voice')
  .option('--voice-listen-model <model>', 'Deepgram listen model')
  .option('--voice-tts-model <model>', 'Deepgram Aura TTS model')
  .option('--voice-language <language>', 'voice language, e.g. en')
  .description('Turn on realtime voice with a focused guided setup')
  .action(async (options: any) => {
    try {
      await runVoiceSetup(options);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

setup
  .command('chat')
  .option('-p, --path <file>', 'environment file to create or update', '.env')
  .option('-f, --force', 'skip the first update confirmation when the env file exists')
  .option('--slack-bot-token <token>', 'Slack Bot Token')
  .option('--slack-signing-secret <secret>', 'Slack Signing Secret')
  .option('--telegram-bot-token <token>', 'Telegram Bot Token')
  .description('Configure Slack and Telegram chat channels')
  .action(async (options: any) => {
    try {
      await runChatSetup(options);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

const voice = program
  .command('voice')
  .description('Manage ZilMate realtime voice features');

voice
  .command('enable')
  .option('-p, --path <file>', 'environment file to update', '.env')
  .description('Enable realtime voice mode in .env')
  .action(async (options: { path: string }) => {
    try {
      await setVoiceEnabled(true, options);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

voice
  .command('disable')
  .option('-p, --path <file>', 'environment file to update', '.env')
  .description('Disable realtime voice mode in .env')
  .action(async (options: { path: string }) => {
    try {
      await setVoiceEnabled(false, options);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

program
  .command('doctor')
  .option('--live', 'perform live API and dependency checks')
  .option('-s, --session <id>', 'session id for live Composio check', 'default')
  .description('Check ZilMate environment, credentials, and dependencies')
  .action(async (options: { live?: boolean; session?: string }) => {
    try {
      const checks = await runDoctor({ live: options.live, sessionId: options.session });
      printDoctorChecks(checks);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

program
  .command('config')
  .description('Show current ZilMate configuration and resolved environment')
  .action(async () => {
    try {
      printJson(await getResolvedConfigSummary());
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

voice
  .command('turn')
  .argument('<transcript...>', 'previous dialogue context')
  .option('-s, --session <id>', 'voice session id', 'default')
  .description('Request a single voice-formatted response turn')
  .action(async (transcript: string[], options: { session: string }) => {
    try {
      await runVoiceTurn(transcript, options.session);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

const camera = program
  .command('camera')
  .description('Manage desktop camera features');

camera
  .command('doctor')
  .description('Check camera hardware and ffmpeg dependency')
  .action(async () => {
    try {
      await runCameraDoctorCli();
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

camera
  .command('list')
  .description('List available camera devices')
  .action(async () => {
    try {
      await listCameraDevicesCli();
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

camera
  .command('capture')
  .option('-d, --device <device>', 'specific camera device name or id')
  .description('Capture a still photo from the desktop camera')
  .action(async (options: { device?: string }) => {
    try {
      await captureCameraCli(options.device);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

voice
  .command('devices')
  .description('List audio input devices for voice mode')
  .action(async () => {
    try {
      await listVoiceDevices();
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

voice
  .command('live')
  .option('-s, --session <id>', 'voice session id', 'default')
  .description('Start a realtime voice session (requires DEEPGRAM_API_KEY)')
  .action(async (options: { session: string }) => {
    try {
      await runTerminalVoiceLive(options.session);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

voice
  .command('speak-test')
  .argument('<text...>', 'text to synthesize into speech')
  .description('Verify Deepgram TTS by playing a text snippet')
  .action(async (text: string[]) => {
    try {
      await runVoiceSpeakTest(text.join(' '));
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

voice
  .command('agent-probe')
  .description('Perform a live voice agent handshake test')
  .action(async () => {
    try {
      await runVoiceAgentProbe();
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

voice
  .command('doctor')
  .description('Check audio hardware and voice dependencies')
  .action(async () => {
    try {
      await runVoiceDoctor();
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

voice
  .command('config')
  .description('Show resolved voice configuration')
  .action(async () => {
    try {
      printVoiceConfig();
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

const jobs = program
  .command('jobs')
  .description('Manage background jobs and schedules');

jobs
  .command('worker')
  .description('Start the local job worker to process due schedules')
  .action(async () => {
    try {
      await startCliJobWorker();
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

jobs
  .command('listen')
  .option('-t, --tunnel', 'start a Cloudflare quick tunnel for the webhook server')
  .option('-p, --port <number>', 'port to listen on', '8787')
  .description('Start the job webhook server for QStash callbacks')
  .action(async (options: { tunnel?: boolean; port?: string }) => {
    try {
      await startCliJobListener(options);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

jobs
  .command('create')
  .argument('<task...>', 'task description')
  .option('-s, --schedule <cron>', 'cron schedule, e.g. "0 9 * * *"')
  .option('-a, --at <iso>', 'one-time execution at ISO date/time')
  .description('Create a new background job')
  .action(async (task: string[], options: { schedule?: string; runAt?: string }) => {
    try {
      await createCliJob(task.join(' '), options);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

jobs
  .command('list')
  .option('-s, --status <status>', 'filter by job status')
  .option('-l, --limit <number>', 'maximum jobs to show', '20')
  .description('List recently created jobs')
  .action(async (options: { status?: string; limit?: string }) => {
    try {
      await listCliJobs(options);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

jobs
  .command('status')
  .argument('<id>', 'job id')
  .description('Show status and metadata for a specific job')
  .action(async (id: string) => {
    try {
      await showCliJob(id);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

jobs
  .command('logs')
  .argument('<id>', 'job id')
  .description('Show execution logs for a job')
  .action(async (id: string) => {
    try {
      await showCliJobLogs(id);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

jobs
  .command('run')
  .argument('<id>', 'job id')
  .description('Manually trigger a job to run immediately')
  .action(async (id: string) => {
    try {
      await runCliJob(id);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

jobs
  .command('cancel')
  .argument('<id>', 'job id')
  .description('Cancel a pending or scheduled job')
  .action(async (id: string) => {
    try {
      await cancelCliJob(id);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

const workspace = program
  .command('workspace')
  .description('Manage the ZilMate local workspace folder');

workspace
  .command('init')
  .description('Initialize a new ZilMate workspace (notebook, skills, outputs)')
  .action(async () => {
    try {
      await initWorkspace();
      console.log(`Workspace ready at ${workspaceLayout().root}`);
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

program
  .command('heal')
  .description('Analyze terminal errors and attempt to auto-fix the codebase')
  .action(async () => {
    try {
      requireGatewayAuth();
      await runHeal();
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

const memory = program
  .command('memory')
  .description('Manage durable long-term ZilMate memory');

memory
  .command('forget')
  .argument('[id]', 'memory id to delete')
  .option('--all', 'clear all durable long-term memories')
  .description('Delete one or all durable long-term memories')
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
  .description('Manage durable long-term ZilMate memory')
  .action(async () => {
    try {
      printMemoryTable(await listMemories());
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

memoryCommand
  .command('list')
  .description('List all durable long-term memories')
  .action(async () => {
    try {
      printMemoryTable(await listMemories());
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

const apps = program
  .command('apps')
  .description('Manage external app tooling through Composio')
  .action(async () => {
    try {
      printAppsStatus(await getComposioStatus());
    } catch (error) {
      printError(friendlyError(error));
      process.exitCode = 1;
    }
  });

apps
  .command('status')
  .option('-s, --session <id>', 'ZilMate chat session id', 'default')
  .description('Show Composio setup, user id, session, and toolkit connection status')
  .action(async (options: { session: string }) => {
    try {
      const status = await getComposioStatus(options.session);
      printAppsStatus(status);
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
  .option('-p, --provider <provider>', 'filter models by provider or text, e.g. openai, google, gemini, anthropic')
  .option('-l, --limit <number>', 'models per page', '20')
  .option('--page <number>', 'page number', '1')
  .description('Browse available AI Gateway models')
  .action(async (options: { provider?: string; limit?: string; page?: string }) => {
    try {
      requireGatewayAuth();
      await printModelBrowser(options);
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
  .command('swarm')
  .argument('<task...>', 'business task for the digital corporation swarm')
  .option('-s, --session <id>', 'swarm session id', 'default')
  .description('Route a high-level business objective to the Digital Corporation swarm')
  .action(async (task: string[], options: { session: string }) => {
    try {
      requireGatewayAuth();
      await runSwarmCli(task.join(' '), options);
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

if (process.argv.length <= 2) {
  await initWorkspace().catch(() => undefined);
  await startDefaultLauncher();
} else {
  await initWorkspace().catch(() => undefined);
  await program.parseAsync(process.argv).catch((error) => {
    printError(friendlyError(error));
    process.exitCode = 1;
  });
}
