// src/cli/composer.ts
import readline from 'node:readline/promises';
import { theme, termWidth, boxLine } from './theme.js';

export async function readComposerLine(
  rl: readline.Interface,
  placeholder = 'Try "plan my week" or "build a Next.js dashboard"',
): Promise<string> {
  const w = termWidth(92);
  console.log('');
  console.log(boxLine('top', w));
  console.log(theme.accent('│ ') + theme.dim(placeholder));
  const answer = await rl.question(theme.accent('│ ') + theme.brandBright('> '));
  console.log(boxLine('bot', w));
  return answer;
}
