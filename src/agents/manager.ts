import { randomUUID } from 'node:crypto';
import { stepCountIs, tool, ToolLoopAgent } from 'ai';
import { z } from 'zod';
import { models } from '../config/models.js';
import { createQuickHelpAgent } from './quick-help.agent.js';
import { createChatAgent } from './chat.agent.js';
import { createPostAgent } from './post.agent.js';
import { createImageAgent } from './image.agent.js';
import { createDocsResearchAgent } from './docs-research.agent.js';
import { createAutomationPlannerAgent } from './automation-planner.agent.js';
import { createPersonalAssistantAgent } from './personal-assistant.agent.js';
import { createDeveloperHelperAgent } from './developer-helper.agent.js';
import { createSecurityAgent } from './security.agent.js';
import { createCodingAgent } from './coding.agent.js';
import { createGoalManagerAgent } from './goal-manager.agent.js';
import { limits } from '../safety/limits.js';
import { emitProgress, type ProgressEvent, withProgressListener } from '../runtime/progress.js';
import { type ConfirmationHandler, withConfirmationHandler } from '../runtime/confirm.js';
import { createScratchpadTools } from '../tools/scratchpad.tool.js';
import { ziloDocsTools } from '../tools/zilo-docs.tool.js';
import { createComposioTools } from '../tools/composio.tool.js';
import { memoryTools } from '../tools/memory.tool.js';
import { triggerTools } from '../tools/triggers.tool.js';
import { jobTools } from '../tools/jobs.tool.js';
import { timeTools } from '../tools/time.tool.js';
import { weatherTools } from '../tools/weather.tool.js';
import { fileSystemTools } from '../tools/filesystem.tool.js';
import { desktopTools } from '../tools/desktop.tool.js';
import { computerUseTools } from '../tools/computer-use.tool.js';
import { shellTools } from '../tools/shell.tool.js';
import { skillTools } from '../tools/skills.tool.js';
import { personalContextTools } from '../tools/personal-context.tool.js';
import { setupAssistantTools } from '../tools/setup-assistant.tool.js';
import { workspaceTools } from '../tools/workspace.tool.js';
import { notebookTools } from '../tools/notebook.tool.js';
import { knowledgeTools } from '../tools/knowledge.tool.js';
import { healTools } from '../tools/heal.tool.js';
import { trustTools } from '../tools/trust.tool.js';
import { updateTools } from '../tools/update.tool.js';
import { notifyTools } from '../tools/notify.tool.js';
import { documentTools } from '../tools/documents.tool.js';
import { askTools } from '../tools/ask.tool.js';
import { withAskHandler, type AskHandler } from '../runtime/ask.js';
import { situationalAwarenessTools } from '../tools/situational-awareness.tool.js';
import { sessionContinuityTools } from '../tools/session-continuity.tool.js';
import { trackUsage } from '../observability/usage.js';
import { runProactiveDoctor } from '../observability/doctor.js';
import { SystemPromptBuilder } from '../runtime/prompts/builder.js';

function agentInput(prompt: string, abortSignal?: AbortSignal) {
  return abortSignal ? { prompt, abortSignal } : { prompt };
}

function describeTool(name: string) {
  const labels: Record<string, string> = {
    quickHelp: 'Using quick-help subagent',
    chat: 'Using chat subagent',
    post: 'Using post-writing subagent',
    image: 'Using image generation subagent',
    research: 'Using research subagent',
    automationPlanner: 'Using automation planner subagent',
    personalAssistant: 'Using personal assistant subagent',
    developerHelper: 'Using developer helper subagent',
    security: 'Using security subagent',
    coding: 'Using coding subagent',
    goalManager: 'Using goal manager subagent',
    readScratchpad: 'Reading scratchpad',
    appendScratchpad: 'Updating scratchpad',
    rememberMemory: 'Saving memory',
    recallMemory: 'Recalling memory',
    listMemory: 'Listing memory',
    forgetMemory: 'Forgetting memory',
    listZiloDocs: 'Listing Zilo docs',
    readZiloDoc: 'Reading Zilo doc',
    searchZiloDocs: 'Searching Zilo docs',
    listTriggerTypes: 'Listing trigger types',
    showTriggerType: 'Loading trigger schema',
    listTriggers: 'Listing triggers',
    createTrigger: 'Creating trigger',
    createJob: 'Creating job',
    listJobs: 'Listing jobs',
    showJob: 'Loading job',
    listJobLogs: 'Loading job logs',
    cancelJob: 'Cancelling job',
    getCurrentTime: 'Checking time',
    searchFiles: 'Searching files',
    readFile: 'Reading file',
    writeFile: 'Writing file',
    createFolder: 'Creating folder',
    moveCopyRename: 'Moving/copying/renaming file',
    deleteFile: 'Deleting file',
    deleteFolder: 'Deleting folder',
    listDirectory: 'Listing directory',
    getFileInfo: 'Getting file info',
    summarizeDocument: 'Summarizing document',
    watchFolderChanges: 'Checking folder changes',
    findDuplicateLargeFiles: 'Finding duplicate/large files',
    readClipboard: 'Reading clipboard',
    writeClipboard: 'Writing clipboard',
    takeScreenshot: 'Taking screenshot',
    analyzeScreenshot: 'Analyzing screenshot',
    takeCameraPhoto: 'Taking camera photo',
    analyzeCameraPhoto: 'Analyzing camera photo',
    openFile: 'Opening file',
    openApplication: 'Opening application',
    getSystemInfo: 'Getting system info',
    listRunningApplications: 'Listing running apps',
    simulateKeyboard: 'Sending keyboard input',
    executeCommand: 'Executing command',
    installDependencies: 'Installing dependencies',
    runPipeline: 'Running command pipeline',
    pythonScript: 'Running Python script',
    listProcesses: 'Listing processes',
    findInPath: 'Searching PATH',
    COMPOSIO_SEARCH_TOOLS: 'Searching Composio tools',
    COMPOSIO_GET_TOOL_SCHEMAS: 'Loading Composio tool schemas',
    COMPOSIO_MANAGE_CONNECTIONS: 'Managing Composio connection',
    COMPOSIO_MULTI_EXECUTE_TOOL: 'Executing Composio tool',
    COMPOSIO_REMOTE_WORKBENCH: 'Using Composio workbench',
    COMPOSIO_REMOTE_BASH_TOOL: 'Using Composio bash tool',
    installComputerUseDeps: 'Installing computer-use dependencies',
    mouseAction: 'Controlling mouse',
    keyboardAction: 'Simulating keyboard input',
    readScreen: 'Reading screen contents',
    manageWindow: 'Managing application windows',
    findOnScreen: 'Finding UI element on screen',
    dragAndDrop: 'Dragging and dropping',
    getWeather: 'Getting weather forecast',
    getForecast: 'Getting multi-day weather forecast',
    getCurrentLocation: 'Detecting location from IP',
  };
  return labels[name] || `Using ${name}`;
}

function subagentTool(
  name: string,
  description: string,
  run: (prompt: string, abortSignal?: AbortSignal) => Promise<string>,
  options: { agent?: string; trackSteps?: boolean } = {},
) {
  return tool({
    description,
    inputSchema: z.object({ prompt: z.string().min(3) }),
    execute: async ({ prompt }, { abortSignal }) => {
      const agent = options.agent || name;
      if (options.trackSteps) {
        emitProgress({ type: 'subagent:start', label: describeTool(name), detail: prompt, agent });
      } else {
        emitProgress({ type: 'tool:start', label: describeTool(name), detail: prompt });
      }
      try {
        const result = await run(prompt, abortSignal);
        emitProgress(options.trackSteps
          ? { type: 'subagent:end', label: `${describeTool(name)} finished`, agent }
          : { type: 'tool:end', label: `${describeTool(name)} finished` });
        return result;
      } catch (error) {
        emitProgress({
          type: 'tool:error',
          label: `${describeTool(name)} failed`,
          detail: error instanceof Error ? error.message : String(error),
          ...(options.trackSteps ? { agent } : {}),
        });
        throw error;
      }
    },
    toModelOutput: ({ output }) => ({ type: 'text', value: String(output) }),
  });
}

function codingStepTools(step: unknown) {
  const toolCalls = (step as { toolCalls?: Array<{ toolName?: string }> }).toolCalls || [];
  return toolCalls.map((call) => call.toolName).filter((name): name is string => Boolean(name));
}

function buildManagerInstructions() {
  const builder = new SystemPromptBuilder();

  builder.addSection({
    id: 'core',
    content: [
      'You are ZilMate, a general CLI assistant with deep built-in ZiloShift expertise.',
      'Know your current capabilities: you have text chat, realtime voice mode, shared session history, long-term memory, background jobs, and specialized subagents.',
      'Route ZiloShift/support questions through the local Zilo docs before using web research.',
      'Use specialized subagents for focused chat, quick help, post copy, image assets, research, automation, coding, and security work.',
    ].join(' '),
  });

  builder.addSection({
    id: 'composio',
    content: [
      'Use Composio tools for external app tasks such as GitHub, Gmail, Slack, Notion, Stripe, and Supabase.',
      'Prefer this flow: use COMPOSIO_SEARCH_TOOLS to find tools, COMPOSIO_GET_TOOL_SCHEMAS to inspect, and COMPOSIO_MULTI_EXECUTE_TOOL to execute.',
    ].join(' '),
  });

  builder.addSection({
    id: 'automation',
    content: 'Use job tools when the user wants ZilMate to keep working after chat, schedule a task, or monitor something.',
  });

  builder.addSection({
    id: 'security',
    content: 'Use specialized subagents for security (permission-aware OSINT investigations + penetration testing).',
  });

  builder.addSection({
    id: 'system',
    content: [
      'Use file-system tools for local file search, reading, writing, and folder management.',
      'Use shell tools to execute commands and Python scripts: handles node, python, npm, pip, builds, tests, etc.',
      'Use desktop tools for clipboard, screenshots, camera, and application launching.',
    ].join(' '),
  });

  // By default we return a balanced set. In a real dynamic scenario,
  // we could prune this based on the first few turns of conversation.
  return builder.build(['composio', 'automation', 'security', 'system']);
}

export async function createManagerAgent(runId: string = randomUUID(), options: { sessionId?: string } = {}) {
  const quickHelp = createQuickHelpAgent();
  const chat = createChatAgent();
  const post = createPostAgent();
  const image = createImageAgent();
  const research = createDocsResearchAgent(runId);
  const automationPlanner = createAutomationPlannerAgent();
  const personalAssistant = createPersonalAssistantAgent();
  const developerHelper = createDeveloperHelperAgent(runId);
  const security = createSecurityAgent(runId);
  const coding = createCodingAgent(runId);
  const goalManager = createGoalManagerAgent();
  const scratchpadTools = createScratchpadTools(runId);
  const composioTools = await createComposioTools(options.sessionId || 'default');

  return new ToolLoopAgent({
    model: models.manager,
    instructions: buildManagerInstructions(),
    tools: {
      quickHelp: subagentTool('quickHelp', 'Fast troubleshooting and usage guidance.', async (prompt, abortSignal) => {
        const result = await quickHelp.generate(agentInput(prompt, abortSignal));
        return result.text;
      }),
      chat: subagentTool('chat', 'Natural conversation about ZiloShift workflows and features.', async (prompt, abortSignal) => {
        const result = await chat.generate(agentInput(prompt, abortSignal));
        return result.text;
      }),
      post: subagentTool('post', 'Generate short WhatsApp/status/social post copy.', async (prompt, abortSignal) => {
        const result = await post.generate(agentInput(prompt, abortSignal));
        return result.text;
      }),
      image: subagentTool('image', 'Generate or edit image assets from prompts, local image paths, image URLs, and masks; return saved local file paths.', async (prompt, abortSignal) => {
        const result = await image.generate(agentInput(prompt, abortSignal));
        return result.text;
      }),
      research: subagentTool('research', 'Research docs or current web information and return sourced summaries.', async (prompt, abortSignal) => {
        const result = await research.generate(agentInput(prompt, abortSignal));
        return result.text;
      }),
      automationPlanner: subagentTool('automationPlanner', 'Plan background jobs, schedules, trigger workflows, monitoring, follow-ups, QStash, and webhook automations.', async (prompt, abortSignal) => {
        const result = await automationPlanner.generate(agentInput(prompt, abortSignal));
        return result.text;
      }),
      personalAssistant: subagentTool('personalAssistant', 'Daily planning, reminders, briefings, prioritization, follow-ups, summaries, and memory-aware assistant work.', async (prompt, abortSignal) => {
        const result = await personalAssistant.generate(agentInput(prompt, abortSignal));
        return result.text;
      }),
      developerHelper: subagentTool('developerHelper', 'Developer-focused help for ZilMate CLI, SDK, Next.js integration, publishing, QStash, Cloudflare tunnels, webhooks, and debugging.', async (prompt, abortSignal) => {
        const result = await developerHelper.generate(agentInput(prompt, abortSignal));
        return result.text;
      }),
      security: subagentTool('security', 'OSINT investigations (username/email/phone/domain lookups) and penetration testing (subdomain discovery, port scanning, vulnerability scanning, SQL injection, web fuzzing). Requires user authorization for active scanning.', async (prompt, abortSignal) => {
        const result = await security.generate(agentInput(prompt, abortSignal));
        return result.text;
      }),
      coding: subagentTool('coding', 'Software engineering in a git repo: status/diff/log, unified patches, tests, commits. Use for code edits and debugging — not SDK/docs questions.', async (prompt, abortSignal) => {
        const result = await coding.generate({
          ...agentInput(prompt, abortSignal),
          onStepFinish: (step) => {
            for (const toolName of codingStepTools(step)) {
              emitProgress({ type: 'subagent:step', label: toolName, agent: 'coding' });
            }
          },
        });
        return result.text;
      }, { agent: 'coding', trackSteps: true }),
      goalManager: subagentTool('goalManager', 'Break goals into actionable steps, timelines, dependencies, and optional scheduled follow-ups.', async (prompt, abortSignal) => {
        const result = await goalManager.generate(agentInput(prompt, abortSignal));
        return result.text;
      }),
      ...ziloDocsTools,
      ...memoryTools,
      ...timeTools,
      ...weatherTools,
      ...fileSystemTools,
      ...desktopTools,
      ...jobTools,
      ...triggerTools,
      ...scratchpadTools,
      ...composioTools,
      ...computerUseTools,
      ...shellTools,
      ...skillTools,
      ...personalContextTools,
      ...setupAssistantTools,
      ...workspaceTools,
      ...notebookTools,
      ...knowledgeTools,
      ...healTools,
      ...trustTools,
      ...updateTools,
      ...notifyTools,
      ...documentTools,
      ...askTools,
      ...situationalAwarenessTools,
      ...sessionContinuityTools,
    },
    stopWhen: stepCountIs(limits.managerSteps),
  });
}

function toolNamesFromStep(step: unknown) {
  const toolCalls = (step as { toolCalls?: Array<{ toolName?: string }> }).toolCalls || [];
  return toolCalls.map((call) => call.toolName).filter((name): name is string => Boolean(name));
}

export async function runManager(prompt: string, options: { progress?: (event: ProgressEvent) => void; runId?: string; sessionId?: string; confirm?: ConfirmationHandler; ask?: AskHandler } = {}) {
  return withProgressListener(options.progress, async () => {
    return withConfirmationHandler(options.confirm, async () => {
      return withAskHandler(options.ask, async () => {
      const runId = options.runId || randomUUID();
      emitProgress({ type: 'thinking', label: 'Thinking', detail: runId });
      const manager = await createManagerAgent(runId, options.sessionId ? { sessionId: options.sessionId } : {});

      // Proactively check dependencies in the background
      runProactiveDoctor().catch(() => undefined);

      const result = await manager.generate({
        prompt,
        onStepFinish: (step) => {
          const tools = toolNamesFromStep(step);
          if (tools.length > 0) {
            emitProgress({ type: 'step', label: 'Manager selected tools', detail: tools.map(describeTool).join(', ') });
          }
          if (step.usage) {
            trackUsage(options.sessionId || 'default', step.usage);
          }
        },
      });
      emitProgress({ type: 'done', label: 'Response ready' });
      return result.text;
      });
    });
  });
}

