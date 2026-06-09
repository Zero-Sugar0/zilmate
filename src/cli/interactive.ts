import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { randomUUID } from 'node:crypto';
import { requireGatewayAuth } from '../config/env.js';
import { runManager } from '../agents/manager.js';
import { loadTurns, saveTurns, type ChatTurn } from '../memory/history.js';
import { memoryBackendName } from '../memory/redis.js';
import { printAssistant, printProgress, printStatus, printTitle, printUserPrompt } from './format.js';

function transcript(turns: ChatTurn[]) {
  if (turns.length === 0) return '';
  return turns
    .slice(-10)
    .map((turn) => `${turn.role === 'user' ? 'User' : 'ZilMate'}: ${turn.content}`)
    .join('\n');
}

export async function startInteractiveChat(sessionId = 'default') {
  requireGatewayAuth();
  const rl = readline.createInterface({ input, output });
  let turns = await loadTurns(sessionId);
  const runId = randomUUID();

  printTitle('ZilMate interactive chat', 'Persistent manager chat with subagent delegation');
  printStatus('Session:', sessionId);
  printStatus('Memory:', memoryBackendName());
  printStatus('Run:', runId);
  console.log('Type /exit to quit, /clear to clear this session, or /help for commands.\n');

  try {
    while (true) {
      let answer: string;
      try {
        answer = await rl.question(printUserPrompt());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/readline was closed|aborted/i.test(message)) break;
        throw error;
      }
      const message = answer.trim();
      if (!message) continue;
      if (message === '/exit' || message === '/quit') break;
      if (message === '/help') {
        console.log('Commands: /exit, /quit, /clear, /help');
        continue;
      }
      if (message === '/clear') {
        turns = [];
        await saveTurns(sessionId, turns);
        console.log('Session cleared.');
        continue;
      }

      const context = transcript(turns);
      const prompt = context
        ? `Conversation so far:\n${context}\n\nNew user message:\n${message}\n\nAnswer as ZilMate. Delegate to subagents when useful and return a concise final answer.`
        : `${message}\n\nAnswer as ZilMate. Delegate to subagents when useful and return a concise final answer.`;

      const response = await runManager(prompt, { progress: printProgress });
      printAssistant(response);

      turns.push(
        { role: 'user', content: message, createdAt: new Date().toISOString() },
        { role: 'assistant', content: response, createdAt: new Date().toISOString() },
      );
      await saveTurns(sessionId, turns);
    }
  } finally {
    rl.close();
  }
}



