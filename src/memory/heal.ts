import { appendFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { generateText } from 'ai';
import { models } from '../config/models.js';
import { appendNotebookMarkdown, readNotebookMarkdown, listNotebookEntries } from './notebook.js';
import { remember, recall, listMemories } from './long-term.js';
import { upsertKnowledgeNode, getKnowledgeGraph, setOwnerName, linkKnowledgeNodes } from './knowledge-graph.js';
import {
  loadPersonalContext,
  savePersonalContext,
  addUrgencyRule,
  addWorkflow,
  upsertProject,
  upsertContact,
} from './personal-context.js';
import { loadTurns, type ChatTurn } from './history.js';
import { listJobs } from '../jobs/store.js';
import { workspaceLayout } from '../workspace/paths.js';

export type HealInput = {
  sessionSummary: string;
  sessionId?: string;
  recentFailures?: string[];
  recentSuccesses?: string[];
  deep?: boolean;
};

export type HealResult = {
  summary: string;
  savedMemories: string[];
  savedContext: string[];
  actionItems: string[];
  frictionPoints: string[];
  notebookPath: string;
  passes: number;
};

async function appendHealLog(entry: Record<string, unknown>) {
  const logPath = workspaceLayout().healLog;
  await appendFile(logPath, `${JSON.stringify({ ...entry, at: new Date().toISOString() })}\n`, 'utf8');
}

function formatTurns(turns: ChatTurn[]) {
  return turns.slice(-20).map((turn) => `${turn.role}: ${turn.content.slice(0, 500)}`).join('\n');
}

async function gatherHealContext(sessionId?: string) {
  const [context, graph, notebook, notes, memories, jobs] = await Promise.all([
    loadPersonalContext(),
    getKnowledgeGraph(),
    readNotebookMarkdown().catch(() => ''),
    listNotebookEntries(8),
    listMemories(),
    listJobs({ limit: 15 }),
  ]);

  let turns: ChatTurn[] = [];
  if (sessionId) {
    turns = await loadTurns(sessionId);
  }

  const recentHeal = existsSync(workspaceLayout().healLog)
    ? (await readFile(workspaceLayout().healLog, 'utf8')).trim().split('\n').slice(-5)
    : [];

  return {
    context,
    graph,
    notebookExcerpt: notebook.slice(-4000),
    notes,
    memories: memories.slice(0, 20),
    jobs: jobs.map((job) => ({ id: job.id, status: job.status, task: job.task.slice(0, 200), error: job.error })),
    turns,
    recentHeal,
  };
}

type HealAnalysis = {
  summary: string;
  memories: string[];
  personalContext: Array<{ key: string; value: string; kind?: string }>;
  knowledgeNodes: Array<{ label: string; type: string; parentLabel?: string; notes?: string }>;
  workflows: string[];
  contacts: Array<{ name: string; email?: string; role?: string; vip?: boolean; notes?: string }>;
  actionItems: string[];
  frictionPoints: string[];
  ownerName?: string;
};

async function analyzeHealPass(input: HealInput, ctx: Awaited<ReturnType<typeof gatherHealContext>>, pass: number) {
  const prompt = `You are ZilMate Heal Engine (pass ${pass}). Perform a deep retrospective and extract durable intelligence.

Session summary:
${input.sessionSummary}

Successes:
${(input.recentSuccesses ?? []).join('\n') || '(none)'}

Failures / friction:
${(input.recentFailures ?? []).join('\n') || '(none)'}

Recent conversation:
${formatTurns(ctx.turns) || '(no session turns loaded)'}

Personal context owner: ${ctx.context.ownerName || '(unset)'}
Projects: ${ctx.context.projects.map((p) => `${p.name}(${p.status})`).join(', ') || '(none)'}
VIP contacts: ${ctx.context.contacts.filter((c) => c.vip).map((c) => c.name).join(', ') || '(none)'}
Urgency rules: ${ctx.context.urgencyRules.join(' | ') || '(none)'}

Knowledge graph owner: ${ctx.graph.ownerName || '(unset)'}; nodes: ${ctx.graph.nodes.length}
Notebook excerpt:
${ctx.notebookExcerpt || '(empty)'}

Recent memories (${ctx.memories.length}):
${ctx.memories.map((m) => `- ${m.text}`).join('\n') || '(none)'}

Recent jobs:
${ctx.jobs.map((j) => `- ${j.id} ${j.status}: ${j.task}${j.error ? ` ERR=${j.error}` : ''}`).join('\n') || '(none)'}

Prior heal passes:
${ctx.recentHeal.join('\n') || '(none)'}

Return JSON only:
{
  "summary": "what worked, what failed, what to change next time",
  "memories": ["new durable facts not already in memory"],
  "personalContext": [{"key":"...","value":"...","kind":"owner|urgency|project|workflow"}],
  "knowledgeNodes": [{"label":"...","type":"person|org|project|goal|topic","parentLabel":"optional","notes":"..."}],
  "workflows": ["repeatable workflow the user prefers"],
  "contacts": [{"name":"...","email":"...","role":"...","vip":true,"notes":"..."}],
  "actionItems": ["concrete next steps"],
  "frictionPoints": ["things that broke or annoyed the user"],
  "ownerName": "optional"
}`;

  const result = await generateText({ model: models.manager, prompt });
  try {
    const match = result.text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) as HealAnalysis : { summary: result.text.trim(), memories: [], personalContext: [], knowledgeNodes: [], workflows: [], contacts: [], actionItems: [], frictionPoints: [] };
  } catch {
    return { summary: result.text.trim(), memories: [], personalContext: [], knowledgeNodes: [], workflows: [], contacts: [], actionItems: [], frictionPoints: [] };
  }
}

async function applyHealAnalysis(parsed: HealAnalysis, existingContext: Awaited<ReturnType<typeof loadPersonalContext>>) {
  const savedMemories: string[] = [];
  const savedContext: string[] = [];
  const existingMemoryTexts = new Set((await listMemories()).slice(0, 50).map((m) => m.text.toLowerCase()));

  for (const text of parsed.memories ?? []) {
    const trimmed = text.trim();
    if (!trimmed || existingMemoryTexts.has(trimmed.toLowerCase())) continue;
    await remember(trimmed, ['heal']);
    savedMemories.push(trimmed);
  }

  for (const item of parsed.personalContext ?? []) {
    if (!item.key?.trim() || !item.value?.trim()) continue;
    const key = item.key.trim();
    const value = item.value.trim();
    const kind = item.kind?.toLowerCase() || '';

    if (kind === 'owner' || key.toLowerCase() === 'ownername') {
      if (existingContext.ownerName !== value) {
        const ctx = await loadPersonalContext();
        ctx.ownerName = value;
        await savePersonalContext(ctx);
        await setOwnerName(value);
        savedContext.push('ownerName');
      }
      continue;
    }
    if (kind === 'urgency' || key.toLowerCase().includes('urgency')) {
      await addUrgencyRule(value);
      savedContext.push(`urgency:${value.slice(0, 40)}`);
      continue;
    }
    if (kind === 'workflow') {
      await addWorkflow(value);
      savedContext.push(`workflow:${value.slice(0, 40)}`);
      continue;
    }

    const project = existingContext.projects.find((p) => p.name.toLowerCase() === key.toLowerCase());
    if (!project || project.description !== value) {
      await upsertProject({
        name: key,
        status: 'active',
        description: value,
        tags: ['heal'],
        ...(project?.id ? { id: project.id } : {}),
      });
      savedContext.push(`project:${key}`);
    }
  }

  for (const contact of parsed.contacts ?? []) {
    if (!contact.name?.trim()) continue;
    await upsertContact({
      name: contact.name.trim(),
      vip: contact.vip ?? false,
      ...(contact.email ? { email: contact.email } : {}),
      ...(contact.role ? { role: contact.role } : {}),
      ...(contact.notes ? { notes: contact.notes } : {}),
    });
    savedContext.push(`contact:${contact.name}`);
  }

  for (const workflow of parsed.workflows ?? []) {
    if (workflow.trim()) await addWorkflow(workflow.trim());
  }

  if (parsed.ownerName?.trim()) {
    await setOwnerName(parsed.ownerName.trim());
  }

  for (const node of parsed.knowledgeNodes ?? []) {
    if (!node.label?.trim()) continue;
    await upsertKnowledgeNode({
      label: node.label.trim(),
      type: (node.type as 'project') || 'topic',
      ...(node.notes ? { notes: node.notes } : {}),
    });
    if (node.parentLabel) {
      await linkKnowledgeNodes(node.parentLabel, node.label, (node.type as 'project') || 'project');
    }
  }

  return { savedMemories, savedContext };
}

export async function runHeal(input: HealInput): Promise<HealResult> {
  const ctx = await gatherHealContext(input.sessionId);
  const passes = input.deep === false ? 1 : 2;
  let combined: HealAnalysis = {
    summary: '',
    memories: [],
    personalContext: [],
    knowledgeNodes: [],
    workflows: [],
    contacts: [],
    actionItems: [],
    frictionPoints: [],
  };

  for (let pass = 1; pass <= passes; pass += 1) {
    const parsed = await analyzeHealPass(input, ctx, pass);
    combined = {
      summary: parsed.summary || combined.summary,
      memories: [...new Set([...combined.memories, ...(parsed.memories ?? [])])],
      personalContext: [...combined.personalContext, ...(parsed.personalContext ?? [])],
      knowledgeNodes: [...combined.knowledgeNodes, ...(parsed.knowledgeNodes ?? [])],
      workflows: [...new Set([...combined.workflows, ...(parsed.workflows ?? [])])],
      contacts: [...combined.contacts, ...(parsed.contacts ?? [])],
      actionItems: [...new Set([...combined.actionItems, ...(parsed.actionItems ?? [])])],
      frictionPoints: [...new Set([...combined.frictionPoints, ...(parsed.frictionPoints ?? [])])],
      ...(parsed.ownerName ? { ownerName: parsed.ownerName } : {}),
    };
  }

  const existingContext = await loadPersonalContext();
  const { savedMemories, savedContext } = await applyHealAnalysis(combined, existingContext);

  const summary = combined.summary?.trim() || 'Heal pass completed.';
  const actionBlock = combined.actionItems.length
    ? `\n\n### Action items\n${combined.actionItems.map((item) => `- ${item}`).join('\n')}`
    : '';
  const frictionBlock = combined.frictionPoints.length
    ? `\n\n### Friction\n${combined.frictionPoints.map((item) => `- ${item}`).join('\n')}`
    : '';

  await appendNotebookMarkdown('Heal pass', `${summary}${actionBlock}${frictionBlock}`);
  await appendHealLog({
    summary,
    savedMemories,
    savedContext,
    actionItems: combined.actionItems,
    frictionPoints: combined.frictionPoints,
    input,
    passes,
  });

  if (input.sessionId) {
    const related = await recall(input.sessionSummary, 3);
    for (const memory of related) {
      if (!savedMemories.some((m) => m.includes(memory.text.slice(0, 30)))) {
        await remember(`[heal-linked] ${memory.text}`, ['heal', 'linked']);
      }
    }
  }

  return {
    summary,
    savedMemories,
    savedContext,
    actionItems: combined.actionItems,
    frictionPoints: combined.frictionPoints,
    notebookPath: workspaceLayout().notebook,
    passes,
  };
}

export async function readRecentHealLog(limit = 10) {
  const logPath = workspaceLayout().healLog;
  if (!existsSync(logPath)) return [];
  const lines = (await readFile(logPath, 'utf8')).trim().split('\n').filter(Boolean);
  return lines.slice(-limit).map((line) => JSON.parse(line) as Record<string, unknown>);
}
