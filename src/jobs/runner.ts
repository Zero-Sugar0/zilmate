import { runManager } from '../agents/manager.js';
import { printProgress } from '../cli/format.js';
import type { ProgressEvent } from '../runtime/progress.js';
import { isRecurringSchedule, nextRunFromSchedule } from './schedule.js';
import { appendJobLog, getJob, listJobs, saveJob, updateJobStatus } from './store.js';
import type { RunJobOptions } from './types.js';
import { assessJobAnomaly, recordJobFingerprint } from './anomaly.js';

function now() {
  return new Date().toISOString();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function withoutTransientFields<T extends { error?: string; completedAt?: string; runAt?: string; nextRunAt?: string }>(job: T) {
  const { error: _error, completedAt: _completedAt, runAt: _runAt, nextRunAt: _nextRunAt, ...rest } = job;
  return rest;
}

export async function cancelJob(id: string) {
  const job = await updateJobStatus(id, 'cancelled', { completedAt: now() });
  if (job) await appendJobLog(id, 'info', 'Job cancelled.');
  return job;
}

export async function runJob(id: string, options: RunJobOptions = {}) {
  const job = await getJob(id);
  if (!job) throw new Error(`Job not found: ${id}`);
  if (job.status === 'cancelled') return job;

  const startedAt = now();
  const running = await saveJob({
    ...withoutTransientFields(job),
    status: 'running',
    attempts: job.attempts + 1,
    lastRunAt: startedAt,
  });
  await appendJobLog(job.id, 'info', `Running job attempt ${running.attempts}.`);

  recordJobFingerprint(job);
  const anomaly = await assessJobAnomaly(job);
  if (!anomaly.normal) {
    await appendJobLog(job.id, 'info', `Anomaly assessment: ${anomaly.reason}`, anomaly);
  }

  try {
    const text = await runManager(job.task, {
      sessionId: `job-${job.id}`,
      progress: async (event: ProgressEvent) => {
        await appendJobLog(job.id, 'progress', event.label, event);
      },
    });

    await appendJobLog(job.id, 'result', 'Job completed.', { text });

    if (options.rescheduleRecurring && isRecurringSchedule(job.schedule)) {
      const nextRunAt = nextRunFromSchedule(job.schedule);
      return saveJob({
        ...withoutTransientFields(running),
        status: 'queued',
        result: text,
        ...(nextRunAt ? { runAt: nextRunAt, nextRunAt } : {}),
        completedAt: now(),
      });
    }

    return saveJob({
      ...running,
      status: 'succeeded',
      result: text,
      completedAt: now(),
    });
  } catch (error) {
    const message = errorMessage(error);
    await appendJobLog(job.id, 'error', message);
    const shouldRetry = running.attempts < running.maxAttempts;
    const retryAt = shouldRetry ? new Date(Date.now() + Math.min(running.attempts, 10) * 60 * 1000).toISOString() : undefined;
    return saveJob({
      ...withoutTransientFields(running),
      status: shouldRetry ? 'queued' : 'failed',
      error: message,
      ...(retryAt ? { runAt: retryAt, nextRunAt: retryAt } : {}),
      ...(shouldRetry ? {} : { completedAt: now() }),
    });
  }
}

export async function runDueJobs() {
  const queued = await listJobs({ status: 'queued', limit: 100 });
  const due = queued.filter((job) => !job.runAt || new Date(job.runAt).getTime() <= Date.now());
  for (const job of due) {
    await runJob(job.id, { rescheduleRecurring: true });
  }
  return due.length;
}

export async function handleJobWebhook(input: { jobId: string; secret?: string }, expectedSecret?: string) {
  if (expectedSecret && input.secret !== expectedSecret) {
    throw new Error('Invalid ZilMate job webhook secret.');
  }
  return runJob(input.jobId, { rescheduleRecurring: true });
}

export async function startJobWorker(options: { intervalSeconds?: number; once?: boolean; quiet?: boolean } = {}) {
  const intervalMs = Math.max(1, options.intervalSeconds ?? 10) * 1000;
  if (!options.quiet) printProgress({ type: 'tool:start', label: 'ZilMate job worker started', detail: `${intervalMs / 1000}s interval` });

  do {
    const count = await runDueJobs();
    if (!options.quiet && count > 0) printProgress({ type: 'step', label: 'Processed queued jobs', detail: String(count) });
    if (options.once) break;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (true);
}
