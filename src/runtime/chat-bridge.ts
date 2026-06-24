import { createZilMate } from '../index.js';
import { env, hasChatIntegration } from '../config/env.js';
import { emitProgress } from './progress.js';

/**
 * The ChatBridge provides a high-level integration between external chat adapters
 * (Slack, Telegram, etc.) and the ZilMate Manager.
 *
 * In a real production deployment, you would use the @vercel/chat SDK to populate
 * the adapters and use this bridge to route messages.
 */
export async function handleChatMessage(input: {
  text: string;
  authorId: string;
  platform: 'slack' | 'telegram' | 'teams' | 'discord';
  threadId?: string;
  onReply: (text: string) => Promise<void>;
  onStep?: (label: string) => void;
}) {
  const sessionId = `chat-${input.platform}-${input.authorId}`;

  emitProgress({
    type: 'thinking',
    label: `Processing ${input.platform} message`,
    detail: `User ${input.authorId}`
  });

  const zilmate = createZilMate({
    sessionId,
    onProgress: (event) => {
      if (event.type === 'step' && input.onStep) {
        input.onStep(event.label);
      }
    },
  });

  try {
    const { text } = await zilmate.manager({ message: input.text });
    await input.onReply(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await input.onReply(`ZilMate error: ${message}`);
    throw error;
  }
}

/**
 * Proactive reporting core.
 * Use this to push messages from background jobs to your chat channels.
 */
export async function pushChatNotification(input: {
  message: string;
  platform: 'slack' | 'telegram';
  recipientId: string;
}) {
  if (!hasChatIntegration()) {
    throw new Error('Chat integration is not configured or enabled.');
  }

  // Implementation logic for pushing to specific platform APIs
  // e.g. using fetch for Telegram Bot API or Slack WebClient
  console.log(`Pushing to ${input.platform} [${input.recipientId}]: ${input.message}`);

  // Example for Telegram:
  // if (input.platform === 'telegram' && env.telegramBotToken) {
  //   await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ chat_id: input.recipientId, text: input.message }),
  //   });
  // }
}
