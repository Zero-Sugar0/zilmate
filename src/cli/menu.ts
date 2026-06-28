import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { getComposioStatus } from '../tools/composio.tool.js';
import { listMemories } from '../memory/long-term.js';
import { runDoctor } from './doctor.js';
import { printDoctorChecks } from './health.js';
import { createCliJob, listCliJobs } from './jobs.js';
import { printAppsStatus } from './apps.js';
import { printMemoryTable } from './memory.js';
import { printPanel, printZilMateBanner } from './format.js';
import { runSetup, runChatSetup } from './setup.js';
import { startInteractiveChat } from './interactive.js';
import { hasGatewayAuth, hasChatIntegration } from '../config/env.js';
import { printWelcomeScreen } from './welcome.js';
import { printVoiceConfig, runVoiceDoctor } from './voice.js';
import { runVoiceSetup, setVoiceEnabled } from './setup.js';
import { runSelfUpdate } from './update.js';
import { listCameraDevicesCli, runCameraDoctorCli } from './camera.js';
import { selectOne, confirmPrompt, type PromptOption } from './prompt.js';
import { queryWiki, addWikiFact } from '../memory/corporate-wiki.js';
import { readJson } from '../memory/local-store.js';
import { sandboxDevTools } from '../tools/sandbox-dev.tool.js';
import chalk from 'chalk';


async function promptText(message: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  try {
    return (await rl.question(message)).trim();
  } finally {
    rl.close();
  }
}

export async function startMainMenu() {
  try {
    let firstCheck = true;
    while (true) {
      printZilMateBanner('Main Menu');

      if (!hasGatewayAuth()) {
        printPanel('Setup needed', [
          ['Gateway', 'missing'],
          ['Next', 'Run setup to configure AI Gateway, or exit'],
        ]);
        if (firstCheck) {
          firstCheck = false;
          const runSetupNow = await confirmPrompt('It looks like your AI Gateway key is missing. Would you like to run the interactive setup wizard now?', true);
          if (runSetupNow) {
            await runSetup();
            continue;
          }
        }
      }

      const mainOptions: PromptOption[] = [
        { id: '1', label: 'Talk to ZilMate', description: 'Interactive chat' },
        { id: '2', label: 'Create a job', description: 'Queue a background task' },
        { id: '3', label: 'View jobs', description: 'List background jobs' },
        { id: '4', label: 'Setup/config', description: 'Configure ZilMate environment' },
        { id: '5', label: 'Check health', description: 'Run system doctor checks' },
        { id: '6', label: 'Connect apps', description: 'Show Composio toolkits status' },
        { id: '7', label: 'Manage memory', description: 'List long-term memories' },
        { id: '8', label: 'Trigger workflows', description: 'Composio trigger details' },
        { id: '9', label: 'Voice setup/status', description: 'Configure realtime voice' },
        { id: '10', label: 'Chat channels (Slack/TG)', description: 'Configure messaging integrations' },
        { id: '11', label: 'Update ZilMate', description: 'Check for CLI/SDK updates' },
        { id: '12', label: 'Camera tools', description: 'Diagnose or use laptop camera' },
        { id: '13', label: 'Corporate Wiki & Sandbox', description: 'Manage corporate wiki or run sandbox dev checks' },
        { id: '0', label: 'Exit' },
      ];

      const selection = await selectOne('Choose an action', mainOptions);
      if (!selection || selection.id === '0') break;

      const choice = selection.id;

      if (choice === '1') {
        if (!hasGatewayAuth()) {
          const setup = await confirmPrompt('AI Gateway key is missing. Run setup now?', true);
          if (setup) {
            await runSetup();
            return;
          }
          continue;
        }
        await startInteractiveChat();
        return;
      }
      if (choice === '2') {
        const task = await promptText('Job task: ');
        if (task) {
          const schedule = await promptText('Schedule (blank for once): ');
          await createCliJob(task, schedule ? { schedule } : {});
        }
      } else if (choice === '3') {
        await listCliJobs({});
      } else if (choice === '4') {
        await runSetup();
        return;
      } else if (choice === '5') {
        printDoctorChecks(await runDoctor({ interactive: true }));
      } else if (choice === '6') {
        printAppsStatus(await getComposioStatus());
      } else if (choice === '7') {
        printMemoryTable(await listMemories());
      } else if (choice === '8') {
        console.log('Try: zilmate triggers types gmail');
        console.log('Try: zilmate triggers list');
        console.log('Try: zilmate triggers listen');
      } else if (choice === '9') {
        printVoiceConfig();
        const voiceOptions: PromptOption[] = [
          { id: '1', label: 'Run voice setup', description: 'Start realtime voice setup' },
          { id: '2', label: 'Enable voice', description: 'Turn on realtime voice in .env' },
          { id: '3', label: 'Disable voice', description: 'Turn off realtime voice in .env' },
          { id: '4', label: 'Voice doctor', description: 'Check Deepgram and ffmpeg readiness' },
          { id: '0', label: 'Back' },
        ];
        const voiceChoice = await selectOne('Voice Actions', voiceOptions);
        if (voiceChoice) {
          if (voiceChoice.id === '1') {
            await runVoiceSetup();
            return;
          }
          if (voiceChoice.id === '2') await setVoiceEnabled(true);
          if (voiceChoice.id === '3') await setVoiceEnabled(false);
          if (voiceChoice.id === '4') await runVoiceDoctor();
        }
      } else if (choice === '10') {
        const chatOptions: PromptOption[] = [
          { id: '1', label: 'Run chat setup', description: 'Configure Slack, Telegram, or iMessage' },
          { id: '2', label: 'Start chat listener', description: 'Start listening for external chat messages' },
          { id: '0', label: 'Back' },
        ];
        const chatChoice = await selectOne('Chat Actions', chatOptions);
        if (chatChoice) {
          if (chatChoice.id === '1') {
            await runChatSetup();
            return;
          }
          if (chatChoice.id === '2') {
            if (!hasChatIntegration()) {
               console.log('Chat integration not configured. Run chat setup first.');
            } else {
               console.log('To start the listener, run: zilmate chat listen');
               console.log('This will connect to Slack/Telegram and wait for messages.');
            }
          }
        }
      } else if (choice === '11') {
        const confirm = await confirmPrompt('Update ZilMate from npm now?', false);
        if (confirm) {
          await runSelfUpdate();
          return;
        }
      } else if (choice === '12') {
        const cameraOptions: PromptOption[] = [
          { id: '1', label: 'Camera doctor', description: 'Verify camera and ffmpeg setup' },
          { id: '2', label: 'List camera devices', description: 'Detect available video inputs' },
          { id: '0', label: 'Back' },
        ];
        const cameraChoice = await selectOne('Camera Actions', cameraOptions);
        if (cameraChoice) {
          if (cameraChoice.id === '1') await runCameraDoctorCli();
          if (cameraChoice.id === '2') await listCameraDevicesCli();
        }
      } else if (choice === '13') {
        const wikiOptions: PromptOption[] = [
          { id: '1', label: 'Query corporate wiki', description: 'Search shared knowledge database' },
          { id: '2', label: 'Publish fact to wiki', description: 'Index a delivery or API contract' },
          { id: '3', label: 'List local fallback facts', description: 'Read corporate-wiki-fallback.json' },
          { id: '4', label: 'Run sandbox dev check', description: 'Trigger compiler & test suite' },
          { id: '0', label: 'Back' },
        ];
        const wikiChoice = await selectOne('Wiki & Sandbox Actions', wikiOptions);
        if (wikiChoice) {
          if (wikiChoice.id === '1') {
            const query = await promptText('Enter semantic query: ');
            if (query) {
              console.log(chalk.cyan(`Searching Corporate Wiki for: "${query}"...\n`));
              const results = await queryWiki(query, 5);
              if (results.length === 0) {
                console.log(chalk.yellow('No matching facts found.'));
              } else {
                for (const fact of results) {
                  console.log(chalk.bold(chalk.green(`Match: ${fact.id} (Score: ${(fact.similarity * 100).toFixed(1)}%)`)));
                  console.log(chalk.gray(`Content: ${fact.content}`));
                  if (fact.metadata) {
                    console.log(chalk.gray(`Metadata: ${JSON.stringify(fact.metadata)}`));
                  }
                  console.log();
                }
              }
            }
          } else if (wikiChoice.id === '2') {
            const content = await promptText('Enter fact content (min 10 chars): ');
            if (content && content.length >= 10) {
              const category = await promptText('Enter category (e.g. market-research, api-contract): ');
              console.log(chalk.cyan('Publishing to Corporate Wiki...'));
              await addWikiFact(content, { category: category || 'general' });
              console.log(chalk.green('✅ Intelligence published successfully!'));
            } else if (content) {
              console.log(chalk.yellow('Fact too short! Must be at least 10 characters.'));
            }
          } else if (wikiChoice.id === '3') {
            try {
              const items = await readJson<any[]>('corporate-wiki-fallback.json', []);
              if (items.length === 0) {
                console.log(chalk.yellow('Local fallback database is empty.'));
              } else {
                console.log(chalk.cyan(`Found ${items.length} local fallback fact(s):\n`));
                for (const item of items) {
                  console.log(chalk.bold(chalk.green(`ID: ${item.id}`)));
                  console.log(chalk.gray(`Timestamp: ${item.timestamp}`));
                  console.log(chalk.gray(`Content: ${item.content}`));
                  if (item.metadata) {
                    console.log(chalk.gray(`Metadata: ${JSON.stringify(item.metadata)}`));
                  }
                  console.log();
                }
              }
            } catch (err: any) {
              console.log(chalk.red(`Failed to read local fallback wiki: ${err.message}`));
            }
          } else if (wikiChoice.id === '4') {
            console.log(chalk.cyan('Launching Sandbox Development Loop (Compile & Test)...'));
            console.log(chalk.gray('Please wait, running TypeScript compilation and Playwright test suite...'));
            try {
              const result = await sandboxDevTools.executeSandboxDevLoop.execute!({
                compileCommand: 'npm run build',
                testCommand: 'npx playwright test',
              }, undefined as any) as any;
              
              if (result.success) {
                console.log(chalk.green('\n✅ Sandbox run passed perfectly!'));
                console.log(chalk.gray(result.diagnostics));
              } else {
                console.log(chalk.red(`\n❌ Sandbox validation failed during ${result.stage} stage!`));
                console.log(chalk.yellow(result.diagnostics));
              }
            } catch (err: any) {
              console.log(chalk.red(`\n❌ Sandbox runner crashed: ${err.message}`));
            }
          }
        }
      }
      await promptText('\nPress Enter to continue...');
    }
  } catch (error) {
    console.error('Menu navigation failed:', error);
  }
}

export async function startDefaultLauncher() {
  await printWelcomeScreen();
  await startMainMenu();
}
