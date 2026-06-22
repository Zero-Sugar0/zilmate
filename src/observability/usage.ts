import { type ProgressEvent, emitProgress } from '../runtime/progress.js';
import type { LanguageModelUsage } from 'ai';

export type SessionMetrics = {
  tokens: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  estimatedCost: number;
  requestCount: number;
};

const sessionStore = new Map<string, SessionMetrics>();

// Roughly estimated costs per 1k tokens (blended average for common models)
const COST_PER_1K_TOKENS = 0.002;

export function trackUsage(sessionId: string, usage: LanguageModelUsage) {
  const current = sessionStore.get(sessionId) || {
    tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    estimatedCost: 0,
    requestCount: 0,
  };

  const prompt = usage.inputTokens ?? 0;
  const completion = usage.outputTokens ?? 0;
  const total = usage.totalTokens ?? (prompt + completion);

  current.tokens.promptTokens += prompt;
  current.tokens.completionTokens += completion;
  current.tokens.totalTokens += total;
  current.requestCount += 1;

  // Simple linear cost estimation
  current.estimatedCost = (current.tokens.totalTokens / 1000) * COST_PER_1K_TOKENS;

  sessionStore.set(sessionId, current);

  emitProgress({
    type: 'step',
    label: 'Usage tracked',
    detail: `Tokens: ${total} (Session total: ${current.tokens.totalTokens}, Est. Cost: $${current.estimatedCost.toFixed(4)})`,
  });
}

export function getSessionMetrics(sessionId: string): SessionMetrics {
  return sessionStore.get(sessionId) || {
    tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    estimatedCost: 0,
    requestCount: 0,
  };
}
