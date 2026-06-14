import http from 'node:http';
import { handleJobWebhook } from './runner.js';
import { env } from '../config/env.js';

export type JobWebhookServer = {
  port: number;
  url: string;
  close: () => Promise<void>;
};

function readBody(req: http.IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export async function startJobWebhookServer(port = Number(process.env.ZILMATE_WEBHOOK_PORT || 8787)): Promise<JobWebhookServer> {
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, service: 'zilmate-jobs' }));
        return;
      }

      if (req.method !== 'POST' || !req.url?.startsWith('/jobs/webhook')) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }

      const body = await readBody(req);
      const payload = JSON.parse(body || '{}') as { jobId?: string; secret?: string };
      if (!payload.jobId) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing jobId' }));
        return;
      }

      const job = await handleJobWebhook(
        {
          jobId: payload.jobId,
          ...(payload.secret ? { secret: payload.secret } : {}),
        },
        env.zilmateJobWebhookSecret || undefined,
      );

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, job }));
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });

  return {
    port,
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}
