import { createJob, getJob, getJobLogs, listJobs } from '../jobs/store.js';
import { cancelJob, runJob, startJobWorker } from '../jobs/runner.js';
import { registerQStashSchedule } from '../jobs/qstash.js';
import type { JobStatus } from '../jobs/types.js';
import { printJson, printPanel, printTable } from './format.js';
import chalk from 'chalk';
import { startJobWebhookServer } from '../jobs/webhook-server.js';
import { startCloudflareQuickTunnel } from './tunnel.js';
import { env } from '../config/env.js';

export async function createCliJob(task: string, options: { schedule?: string; runAt?: string; json?: boolean }) {
  const job = await createJob({
    task,
    ...(options.schedule ? { schedule: options.schedule } : {}),
    ...(options.runAt ? { runAt: options.runAt } : {}),
    source: options.schedule ? { type: 'schedule' } : { type: 'manual' },
  });
  const registered = await registerQStashSchedule(job);
  printJson(registered);
}

export async function listCliJobs(options: { status?: string; limit?: string }) {
  const status = options.status as JobStatus | undefined;
  const limit = Number.parseInt(options.limit ?? '', 10);
  const jobs = await listJobs({
    ...(status ? { status } : {}),
    limit: Number.isFinite(limit) ? limit : 25,
  });
  if (jobs.length === 0) {
    printPanel('Jobs', [['Status', 'No jobs found'], ['Create', 'zilmate jobs create "..."']]);
    return;
  }
  printTable(['ID', 'Status', 'Schedule', 'Last run', 'Next run', 'Task / Result'], jobs.map((job) => [
    job.id,
    job.status,
    job.schedule ?? '-',
    job.lastRunAt ?? '-',
    job.nextRunAt ?? job.runAt ?? '-',
    job.error ?? job.result ?? job.task,
  ]));
}

export async function showCliJob(id: string) {
  const job = await getJob(id);
  if (!job) throw new Error(`Job not found: ${id}`);
  printJson(job);
}

export async function showCliJobLogs(id: string) {
  printJson(await getJobLogs(id));
}

export async function runCliJob(id: string) {
  printJson(await runJob(id));
}

export async function cancelCliJob(id: string) {
  const job = await cancelJob(id);
  if (!job) throw new Error(`Job not found: ${id}`);
  printJson(job);
}

export async function startCliJobWorker(options: { interval?: string; once?: boolean; quiet?: boolean }) {
  const interval = Number.parseInt(options.interval ?? '', 10);
  if (!options.quiet) {
    printPanel('ZilMate Worker', [
      ['Status', 'running'],
      ['Interval', `${Number.isFinite(interval) ? interval : 10}s`],
      ['Mode', options.once ? 'once' : 'continuous'],
    ]);
  }
  await startJobWorker({
    intervalSeconds: Number.isFinite(interval) ? interval : 10,
    once: Boolean(options.once),
    quiet: Boolean(options.quiet),
  });
}

export async function startCliJobListener(options: { port?: string; tunnel?: boolean }) {
  const port = Number.parseInt(options.port ?? process.env.ZILMATE_WEBHOOK_PORT ?? '8787', 10) || 8787;
  const server = await startJobWebhookServer(port);
  printPanel('ZilMate Job Webhook', [
    ['Local', server.url],
    ['Path', '/jobs/webhook'],
    ['Secret', env.zilmateJobWebhookSecret ? 'configured' : 'none'],
    ['Tunnel', options.tunnel ? 'starting cloudflared…' : 'disabled'],
  ]);

  if (options.tunnel) {
    const tunnel = await startCloudflareQuickTunnel(server.url);
    const publicUrl = `${tunnel.url.replace(/\/$/, '')}/jobs/webhook`;
    console.log(chalk.green(`Public webhook: ${publicUrl}`));
    console.log(chalk.yellow('Update ZILMATE_PUBLIC_JOB_WEBHOOK_URL in .env if this URL changed.'));
  }

  console.log(chalk.gray('Press Ctrl+C to stop.'));
  await new Promise<void>((resolve) => {
    process.on('SIGINT', () => resolve());
    process.on('SIGTERM', () => resolve());
  });
  await server.close();
}
