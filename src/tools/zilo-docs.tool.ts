import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tool } from 'ai';
import { z } from 'zod';
import { clampText } from '../safety/limits.js';
import { emitProgress } from '../runtime/progress.js';

const projectRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const docsRoot = path.join(projectRoot, 'src', 'doc');

type ZiloDocMeta = {
  key: string;
  filename: string;
  title: string;
  description: string;
};

const ziloDocs = [
  {
    key: 'readme',
    filename: 'README.md',
    title: 'ZiloShift Support Docs Overview',
    description: 'Core support principles, triage questions, risk warnings, and how to use the playbooks.',
  },
  {
    key: 'worker-support-playbook',
    filename: 'worker-support-playbook.md',
    title: 'Worker Support Playbook',
    description: 'Worker onboarding, shift discovery, applications, attendance, payouts, profile, and tone guidance.',
  },
  {
    key: 'venue-support-playbook',
    filename: 'venue-support-playbook.md',
    title: 'Venue Support Playbook',
    description: 'Venue setup, billing, posting, applicants, trust signals, completion, and account support.',
  },
  {
    key: 'payments-and-payouts',
    filename: 'payments-and-payouts.md',
    title: 'Payments and Payouts',
    description: 'Market payment providers, venue billing, worker payouts, profile promotion, refunds, and disputes.',
  },
  {
    key: 'verification-and-trust',
    filename: 'verification-and-trust.md',
    title: 'Verification and Trust',
    description: 'Worker, venue, Ghana owner, business, payout, and support verification guidance.',
  },
  {
    key: 'shift-lifecycle-and-disputes',
    filename: 'shift-lifecycle-and-disputes.md',
    title: 'Shift Lifecycle and Disputes',
    description: 'Shift posting, applying, accepting, clocking, completion, disputes, and escalation guidance.',
  },
  {
    key: 'admin-tools-and-sms-campaigns',
    filename: 'admin-tools-and-sms-campaigns.md',
    title: 'Admin Tools and SMS Campaigns',
    description: 'Admin dashboard, user management, coupons, SMS campaigns, and operational guardrails.',
  },
  {
    key: 'support-macros',
    filename: 'support-macros.md',
    title: 'Support Macros',
    description: 'Reusable replies for workers, venues, payments, verification, disputes, and SMS issues.',
  },
  {
    key: 'escalation-checklist',
    filename: 'escalation-checklist.md',
    title: 'Escalation Checklist',
    description: 'When to escalate support cases and what facts to collect before handing off.',
  },
] satisfies ZiloDocMeta[];

const docsByKey = new Map(ziloDocs.map((doc) => [doc.key, doc]));

async function readZiloDocContent(key: string) {
  const doc = docsByKey.get(key);
  if (!doc) {
    const known = ziloDocs.map((item) => item.key).join(', ');
    throw new Error(`Unknown Zilo doc key "${key}". Known keys: ${known}`);
  }

  const filePath = path.join(docsRoot, doc.filename);
  const content = await readFile(filePath, 'utf8');
  return { ...doc, content };
}

function normalize(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function scoreDoc(content: string, terms: string[]) {
  const normalized = normalize(content);
  return terms.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0);
}

function createSnippet(content: string, terms: string[], maxLength = 650) {
  const lower = content.toLowerCase();
  const firstIndex = terms
    .map((term) => lower.indexOf(term.toLowerCase()))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  const start = Math.max(0, (firstIndex ?? 0) - 180);
  const snippet = content.slice(start, start + maxLength).replace(/\s+/g, ' ').trim();
  return start > 0 ? `...${snippet}` : snippet;
}

export const ziloDocsTools = {
  listZiloDocs: tool({
    description: 'List local ZiloShift support/product documentation available for on-demand reading.',
    inputSchema: z.object({}),
    execute: async () => {
      emitProgress({ type: 'tool:start', label: 'Listing Zilo docs' });
      const docs = ziloDocs.map(({ key, title, description }) => ({ key, title, description }));
      emitProgress({ type: 'tool:end', label: 'Zilo docs listed', detail: `${docs.length} document${docs.length === 1 ? '' : 's'}` });
      return docs;
    },
  }),
  readZiloDoc: tool({
    description: 'Read one allowlisted local ZiloShift support/product doc by key. Use this after listZiloDocs or searchZiloDocs.',
    inputSchema: z.object({
      key: z.string().min(2),
      maxChars: z.number().int().min(500).max(12000).optional(),
    }),
    execute: async ({ key, maxChars }) => {
      emitProgress({ type: 'fetch:start', label: 'Reading Zilo doc', detail: key });
      const doc = await readZiloDocContent(key);
      emitProgress({ type: 'fetch:end', label: 'Zilo doc ready', detail: doc.title });
      return {
        key: doc.key,
        title: doc.title,
        description: doc.description,
        content: clampText(doc.content, maxChars ?? 6000),
      };
    },
  }),
  searchZiloDocs: tool({
    description: 'Search local ZiloShift docs and return compact snippets. Prefer this before web search for ZiloShift product behavior.',
    inputSchema: z.object({
      query: z.string().min(2),
      maxResults: z.number().int().min(1).max(8).optional(),
    }),
    execute: async ({ query, maxResults }) => {
      emitProgress({ type: 'search:start', label: 'Searching Zilo docs', detail: query });
      const terms = normalize(query).split(' ').filter((term) => term.length > 2);
      const docs = await Promise.all(ziloDocs.map((doc) => readZiloDocContent(doc.key)));
      const results = docs
        .map((doc) => ({
          key: doc.key,
          title: doc.title,
          description: doc.description,
          score: scoreDoc(`${doc.title}\n${doc.description}\n${doc.content}`, terms),
          snippet: createSnippet(doc.content, terms),
        }))
        .filter((doc) => doc.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults ?? 5)
        .map(({ key, title, description, snippet }) => ({ key, title, description, snippet }));

      emitProgress({ type: 'search:end', label: 'Zilo docs search complete', detail: `${results.length} match${results.length === 1 ? '' : 'es'}` });
      return results;
    },
  }),
};
