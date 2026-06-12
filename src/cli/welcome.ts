import { getResolvedConfigSummary } from './doctor.js';
import { printPanel, printTable, printZilMateBanner, statusText } from './format.js';
import { compareVersions, latestNpmVersion } from './update.js';

export async function printWelcomeScreen() {
  const config = await getResolvedConfigSummary();
  printZilMateBanner(`v${config.version ?? 'unknown'}`);
  try {
    const latest = await latestNpmVersion();
    if (config.version && compareVersions(config.version, latest) < 0) {
      printPanel('Update available', [
        ['Current', config.version],
        ['Latest', latest],
        ['Run', 'zilmate update'],
      ]);
    }
  } catch {
    // The launcher should stay useful offline or when npm is blocked.
  }
  printPanel('Configured Features', [
    ['Gateway', statusText(config.auth.aiGateway, 'ready')],
    ['Composio', statusText(config.auth.composio && config.auth.zilmateUserId, 'ready')],
    ['Tavily', statusText(config.auth.tavily, 'ready')],
    ['Redis', statusText(config.auth.redisUrl && config.auth.redisToken, 'ready')],
    ['Jobs', statusText(config.auth.jobs, 'enabled')],
    ['QStash', statusText(config.auth.qstash && config.auth.jobWebhookUrl, 'ready')],
    ['Trigger workflows', statusText(config.auth.triggerWorkflows, 'enabled')],
    ['Voice', statusText(config.auth.voice && config.auth.deepgram, 'ready')],
  ]);

  printTable(['Command', 'What it does'], [
    ['zilmate talk', 'Start the interactive assistant'],
    ['zilmate menu', 'Open the guided main menu'],
    ['zilmate', 'Open status plus the guided launcher'],
    ['zilmate update', 'Update CLI and SDK from npm'],
    ['zilmate setup', 'Configure required and optional features'],
    ['zilmate doctor', 'Check health and missing config'],
    ['zilmate jobs', 'View the job dashboard'],
    ['zilmate voice doctor', 'Check realtime voice readiness'],
    ['zilmate camera doctor', 'Check camera readiness'],
    ['zilmate apps status', 'Check Composio app connections'],
  ]);
}
