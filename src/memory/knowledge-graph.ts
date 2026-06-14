import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { workspaceLayout } from '../workspace/paths.js';

export type KnowledgeNodeType = 'person' | 'org' | 'project' | 'topic' | 'goal' | 'tool' | 'other';

export type KnowledgeNode = {
  id: string;
  label: string;
  type: KnowledgeNodeType;
  parentId?: string;
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeGraph = {
  ownerName: string;
  nodes: KnowledgeNode[];
  updatedAt: string;
};

async function readGraph(): Promise<KnowledgeGraph> {
  const path = workspaceLayout().knowledgeGraph;
  if (!existsSync(path)) {
    return { ownerName: '', nodes: [], updatedAt: new Date().toISOString() };
  }
  try {
    return JSON.parse(await readFile(path, 'utf8')) as KnowledgeGraph;
  } catch {
    return { ownerName: '', nodes: [], updatedAt: new Date().toISOString() };
  }
}

async function writeGraph(graph: KnowledgeGraph) {
  graph.updatedAt = new Date().toISOString();
  await writeFile(workspaceLayout().knowledgeGraph, JSON.stringify(graph, null, 2), 'utf8');
}

export async function getKnowledgeGraph() {
  return readGraph();
}

export async function setOwnerName(name: string) {
  const graph = await readGraph();
  graph.ownerName = name.trim();
  await writeGraph(graph);
  return graph;
}

export async function upsertKnowledgeNode(input: {
  label: string;
  type: KnowledgeNodeType;
  parentId?: string;
  notes?: string;
  tags?: string[];
}) {
  const graph = await readGraph();
  const label = input.label.trim();
  const existing = graph.nodes.find((node) => node.label.toLowerCase() === label.toLowerCase());
  const now = new Date().toISOString();

  if (existing) {
    existing.type = input.type;
    if (input.parentId !== undefined) existing.parentId = input.parentId;
    if (input.notes !== undefined) existing.notes = input.notes;
    if (input.tags !== undefined) existing.tags = input.tags;
    existing.updatedAt = now;
    await writeGraph(graph);
    return existing;
  }

  const node: KnowledgeNode = {
    id: `kg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label,
    type: input.type,
    ...(input.parentId ? { parentId: input.parentId } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.tags ? { tags: input.tags } : {}),
    createdAt: now,
    updatedAt: now,
  };
  graph.nodes.push(node);
  await writeGraph(graph);
  return node;
}

export async function searchKnowledgeGraph(query: string, limit = 15) {
  const q = query.trim().toLowerCase();
  const graph = await readGraph();
  return graph.nodes
    .filter((node) =>
      node.label.toLowerCase().includes(q)
      || node.notes?.toLowerCase().includes(q)
      || node.tags?.some((tag) => tag.toLowerCase().includes(q)))
    .slice(0, limit);
}

export async function getKnowledgeTree(rootLabel?: string) {
  const graph = await readGraph();
  const root = rootLabel?.trim()
    ? graph.nodes.find((node) => node.label.toLowerCase() === rootLabel.toLowerCase())
    : graph.nodes.find((node) => node.type === 'person' && graph.ownerName && node.label.toLowerCase() === graph.ownerName.toLowerCase());

  const childrenOf = (parentId: string) => graph.nodes.filter((node) => node.parentId === parentId);

  const build = (node: KnowledgeNode): Record<string, unknown> => ({
    id: node.id,
    label: node.label,
    type: node.type,
    notes: node.notes,
    children: childrenOf(node.id).map(build),
  });

  if (!root) {
    return {
      ownerName: graph.ownerName,
      roots: graph.nodes.filter((node) => !node.parentId).map(build),
    };
  }

  return build(root);
}

export async function linkKnowledgeNodes(parentLabel: string, childLabel: string, childType: KnowledgeNodeType = 'project') {
  const graph = await readGraph();
  let parent = graph.nodes.find((node) => node.label.toLowerCase() === parentLabel.toLowerCase());
  if (!parent) {
    parent = await upsertKnowledgeNode({ label: parentLabel, type: 'person' });
  }
  const child = await upsertKnowledgeNode({
    label: childLabel,
    type: childType,
    parentId: parent.id,
  });
  return { parent, child };
}
