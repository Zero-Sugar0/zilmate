import { emitProgress } from './progress.js';

export type TraceEvent = {
  id: string;
  type: 'agent' | 'tool' | 'job';
  name: string;
  status: 'start' | 'end' | 'error';
  timestamp: string;
  data?: any;
};

export class Telemetry {
  private static events: TraceEvent[] = [];

  static record(event: Omit<TraceEvent, 'id' | 'timestamp'>) {
    const fullEvent: TraceEvent = {
      ...event,
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
    };

    this.events.push(fullEvent);

    // Also emit as progress for real-time visibility
    emitProgress({
      type: event.status === 'error' ? 'tool:error' : 'step',
      label: `${event.type}:${event.name} ${event.status}`,
      ...(event.data ? { detail: JSON.stringify(event.data) } : {}),
    });
  }

  static getHistory() {
    return this.events;
  }

  static clear() {
    this.events = [];
  }
}
