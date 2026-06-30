import { AsyncLocalStorage } from 'node:async_hooks';
import { isConfirmationActive } from './confirm.js';

export interface AgentContext {
  agentKey: string;
  name: string;
  department: string;
}

export const agentContextStorage = new AsyncLocalStorage<AgentContext>();

export type ProgressEvent = {
  type:
    | 'thinking'
    | 'step'
    | 'tool:start'
    | 'tool:end'
    | 'tool:error'
    | 'search:start'
    | 'search:end'
    | 'fetch:start'
    | 'fetch:end'
    | 'done'
    | 'subagent:start'
    | 'subagent:step'
    | 'subagent:end'
    | 'specialist:start'
    | 'specialist:end';
  label: string;
  detail?: string;
  agent?: string;
  /** Department name for swarm specialist events (e.g. 'Engineering', 'Growth') */
  department?: string;
  /** Elapsed milliseconds — set on :end events to show timing badges */
  durationMs?: number;
};

let listener: ((event: ProgressEvent) => void) | undefined;

export function emitProgress(event: ProgressEvent) {
  // We allow 'tool:error' and 'step' events even during confirmation
  // to ensure background failures or state updates are visible.
  if (isConfirmationActive() && !['tool:error', 'step'].includes(event.type)) return;

  // Auto-enrich the event with current specialist context if available
  const store = agentContextStorage.getStore();
  if (store) {
    if (!event.agent) event.agent = store.agentKey;
    if (!event.department) event.department = store.department;
  }

  listener?.(event);
}

export async function withProgressListener<T>(progress: ((event: ProgressEvent) => void) | undefined, run: () => Promise<T>) {
  const previous = listener;
  listener = progress;
  try {
    return await run();
  } finally {
    listener = previous;
  }
}

