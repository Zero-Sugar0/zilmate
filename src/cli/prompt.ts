import readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import chalk from 'chalk';

export type PromptOption = {
  id: string;
  label: string;
  description?: string;
};

function clearLines(count: number) {
  for (let i = 0; i < count; i += 1) {
    readline.moveCursor(output, 0, -1);
    readline.clearLine(output, 0);
  }
}

function renderSelect(title: string, options: PromptOption[], cursor: number, selected: Set<number>, multi: boolean) {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan(title));
  lines.push(chalk.gray(multi ? '↑↓ move · space toggle · enter confirm' : '↑↓ move · enter select · q cancel'));
  lines.push('');
  options.forEach((option, index) => {
    const active = index === cursor;
    const picked = selected.has(index);
    const pointer = active ? chalk.cyan('›') : ' ';
    const box = multi ? (picked ? chalk.green('[x]') : '[ ]') : (active ? chalk.green('●') : '○');
    const label = active ? chalk.bold.white(option.label) : option.label;
    const desc = option.description ? chalk.gray(` — ${option.description}`) : '';
    lines.push(`${pointer} ${box} ${label}${desc}`);
  });
  return lines;
}

async function readKey(): Promise<string> {
  return new Promise((resolve) => {
    readline.emitKeypressEvents(input);
    if (input.isTTY) input.setRawMode(true);
    const onKey = (_str: string, key: readline.Key) => {
      input.off('keypress', onKey);
      if (input.isTTY) input.setRawMode(false);
      if (key.ctrl && key.name === 'c') {
        resolve('SIGINT');
        return;
      }
      if (key.name === 'return') resolve('enter');
      else if (key.name === 'space') resolve('space');
      else if (key.name === 'up') resolve('up');
      else if (key.name === 'down') resolve('down');
      else if (key.name === 'q') resolve('q');
      else resolve(key.name || '');
    };
    input.on('keypress', onKey);
  });
}

export async function selectOne(title: string, options: PromptOption[], defaultIndex = 0): Promise<PromptOption | null> {
  if (!input.isTTY || !output.isTTY || options.length === 0) return options[defaultIndex] ?? null;
  let cursor = Math.min(defaultIndex, options.length - 1);
  const selected = new Set<number>([cursor]);

  while (true) {
    const lines = renderSelect(title, options, cursor, selected, false);
    lines.forEach((line) => console.log(line));
    const key = await readKey();
    clearLines(lines.length);
    if (key === 'SIGINT' || key === 'q') return null;
    if (key === 'up') cursor = cursor <= 0 ? options.length - 1 : cursor - 1;
    else if (key === 'down') cursor = cursor >= options.length - 1 ? 0 : cursor + 1;
    else if (key === 'enter') return options[cursor] ?? null;
  }
}

export async function selectMany(title: string, options: PromptOption[], preselected: number[] = []): Promise<PromptOption[]> {
  if (!input.isTTY || !output.isTTY || options.length === 0) return [];
  let cursor = 0;
  const selected = new Set<number>(preselected);

  while (true) {
    const lines = renderSelect(title, options, cursor, selected, true);
    lines.forEach((line) => console.log(line));
    const key = await readKey();
    clearLines(lines.length);
    if (key === 'SIGINT' || key === 'q') return [];
    if (key === 'up') cursor = cursor <= 0 ? options.length - 1 : cursor - 1;
    else if (key === 'down') cursor = cursor >= options.length - 1 ? 0 : cursor + 1;
    else if (key === 'space') {
      if (selected.has(cursor)) selected.delete(cursor);
      else selected.add(cursor);
    } else if (key === 'enter') {
      return [...selected].sort((a, b) => a - b).map((index) => options[index]!).filter(Boolean);
    }
  }
}

export async function confirmPrompt(message: string, defaultYes = false): Promise<boolean> {
  if (!input.isTTY) return defaultYes;
  const suffix = defaultYes ? 'Y/n' : 'y/N';
  const rl = readline.createInterface({ input, output });
  const answer = await new Promise<string>((resolve) => {
    rl.question(`${message} (${suffix}) `, resolve);
  });
  rl.close();
  const normalized = answer.trim().toLowerCase();
  if (!normalized) return defaultYes;
  return normalized === 'y' || normalized === 'yes';
}
