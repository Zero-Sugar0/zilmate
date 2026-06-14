import { tool } from 'ai';
import { z } from 'zod';
import {
  getKnowledgeGraph,
  getKnowledgeTree,
  linkKnowledgeNodes,
  searchKnowledgeGraph,
  setOwnerName,
  upsertKnowledgeNode,
} from '../memory/knowledge-graph.js';

const nodeType = z.enum(['person', 'org', 'project', 'topic', 'goal', 'tool', 'other']);

export const knowledgeTools = {
  getKnowledgeGraph: tool({
    description: 'Load the personal knowledge graph (people, projects, goals, relationships).',
    inputSchema: z.object({}),
    execute: async () => getKnowledgeGraph(),
  }),

  setKnowledgeOwner: tool({
    description: 'Set the user/owner name at the root of the knowledge graph (e.g. Treffley).',
    inputSchema: z.object({ name: z.string().min(1) }),
    execute: async ({ name }) => {
      const graph = await setOwnerName(name);
      await upsertKnowledgeNode({ label: name, type: 'person' });
      return graph;
    },
  }),

  upsertKnowledgeNode: tool({
    description: 'Add or update a node in the knowledge graph (project, org, goal, topic).',
    inputSchema: z.object({
      label: z.string().min(1),
      type: nodeType,
      parentLabel: z.string().optional(),
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
    execute: async ({ label, type, parentLabel, notes, tags }) => {
      if (parentLabel) {
        return linkKnowledgeNodes(parentLabel, label, type === 'person' ? 'project' : type);
      }
      return upsertKnowledgeNode({
        label,
        type,
        ...(notes ? { notes } : {}),
        ...(tags ? { tags } : {}),
      });
    },
  }),

  searchKnowledgeGraph: tool({
    description: 'Search knowledge graph nodes by label, notes, or tags.',
    inputSchema: z.object({ query: z.string().min(2), limit: z.number().int().min(1).max(30).optional() }),
    execute: async ({ query, limit }) => searchKnowledgeGraph(query, limit ?? 15),
  }),

  getKnowledgeTree: tool({
    description: 'Return hierarchical tree from owner or a named root node.',
    inputSchema: z.object({ rootLabel: z.string().optional() }),
    execute: async ({ rootLabel }) => getKnowledgeTree(rootLabel),
  }),
};
