import { createDigitalCorporationMain } from '../agents/swarm/main.js';
import { printMarkdown, printProgress, printError, printTable } from './format.js';
import { createTerminalConfirmation } from './confirm.js';
import { listSpecialists, createSwarmSpecialist } from '../agents/swarm/registry.js';
import chalk from 'chalk';

export async function runSwarmCli(task: string, options: { session: string }) {
  if (task === 'dashboard' || task === 'status') {
    return printSwarmDashboard();
  }

  try {
    const mainAgent = await createDigitalCorporationMain(options.session);

    const result = await mainAgent.generate({
      prompt: task,
      onStepFinish: (step) => {
        if (step.toolCalls && step.toolCalls.length > 0) {
          const names = step.toolCalls.map(c => c.toolName).join(', ');
          printProgress({ type: 'step', label: 'Swarm COO orchestrating', detail: names });
        }
      }
    });

    printMarkdown(result.text);
  } catch (error) {
    printError(`Swarm execution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function printSwarmDashboard() {
  console.log(chalk.bold.cyan('\nDigital Corporation Swarm Dashboard (v3.0)'));
  console.log(chalk.gray('Status: ACTIVE · Tier: Enterprise · Hierarchy: 3-Tier Swarm\n'));

  const specialists = listSpecialists();
  const headers = ['Department', 'Role', 'Agent (Head/Specialist)', 'Mission / Capabilities'];
  const rows: string[][] = [];

  specialists.forEach(key => {
    const agent = createSwarmSpecialist(key);
    const config = (agent as any).config;
    const isHead = key.toLowerCase().includes('head') || key.toLowerCase().includes('cto') || key.toLowerCase().includes('cmo') || key.toLowerCase().includes('cro') || key.toLowerCase().includes('ciso') || key.toLowerCase().includes('cdo');

    rows.push([
      config.department,
      isHead ? chalk.bold.yellow('HEAD') : 'Specialist',
      config.name,
      config.instructions.split('\n')[0]
    ]);
  });

  printTable(headers, rows);

  console.log(chalk.gray(`\nRun ${chalk.cyan('zilmate swarm <task>')} to delegate a business objective.`));
}
