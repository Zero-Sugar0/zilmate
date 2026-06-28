import { Supermemory } from 'supermemory';
import { Index } from '@upstash/vector';
import { readJson, writeJson } from './local-store.js';
import { env } from '../config/env.js';
import { emitProgress } from '../runtime/progress.js';

export interface WikiFact {
  id: string;
  content: string;
  metadata?: any;
  similarity: number;
}

/**
 * Publishes a key deliverable or strategic fact to the shared corporate wiki.
 */
export async function addWikiFact(content: string, metadata: any = {}): Promise<void> {
  const provider = env.corporateWikiProvider || (env.supermemoryApiKey ? 'supermemory' : env.upstashVectorRestUrl ? 'upstash' : 'local-file');
  const tag = metadata.containerTag || 'corporate-wiki';

  if (provider === 'supermemory' && env.supermemoryApiKey) {
    try {
      emitProgress({ type: 'step', label: `Publishing fact to SuperMemory: "${content.substring(0, 60)}..."` });
      const client = new Supermemory({ apiKey: env.supermemoryApiKey });
      await client.add({
        content,
        containerTag: tag,
        metadata: { ...metadata, publishedAt: new Date().toISOString() }
      });
      return;
    } catch (err: any) {
      emitProgress({ type: 'step', label: `SuperMemory error: ${err.message}. Falling back to local.` });
    }
  }

  if (provider === 'upstash' && env.upstashVectorRestUrl && env.upstashVectorRestToken) {
    try {
      emitProgress({ type: 'step', label: `Publishing fact to Upstash Vector: "${content.substring(0, 60)}..."` });
      const index = new Index({
        url: env.upstashVectorRestUrl,
        token: env.upstashVectorRestToken,
      });
      const id = `wiki-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await index.upsert({
        id,
        data: content,
        metadata: {
          ...metadata,
          content,
          publishedAt: new Date().toISOString()
        }
      });
      return;
    } catch (err: any) {
      emitProgress({ type: 'step', label: `Upstash Vector error: ${err.message}. Falling back to local.` });
    }
  }

  // Local-file fallback
  emitProgress({ type: 'step', label: 'Publishing fact to local corporate-wiki-fallback.json' });
  const items = await readJson<any[]>('corporate-wiki-fallback.json', []);
  const newItem = {
    id: `wiki-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    content,
    metadata,
    timestamp: new Date().toISOString(),
  };
  items.push(newItem);
  await writeJson('corporate-wiki-fallback.json', items);
}

/**
 * Queries the shared corporate wiki for relevant strategic facts or deliverables.
 */
export async function queryWiki(query: string, limit: number = 5): Promise<WikiFact[]> {
  const provider = env.corporateWikiProvider || (env.supermemoryApiKey ? 'supermemory' : env.upstashVectorRestUrl ? 'upstash' : 'local-file');
  const tag = 'corporate-wiki';

  if (provider === 'supermemory' && env.supermemoryApiKey) {
    try {
      emitProgress({ type: 'step', label: `Querying SuperMemory wiki for: "${query}"` });
      const client = new Supermemory({ apiKey: env.supermemoryApiKey });
      const response = await client.search.memories({
        q: query,
        containerTag: tag,
        limit,
      });
      
      if (response && response.results && response.results.length > 0) {
        return response.results.map((res: any) => ({
          id: res.id,
          content: res.memory || res.content || res.chunk || '',
          metadata: res.metadata,
          similarity: res.similarity ?? res.score ?? 0.5,
        }));
      }
      return [];
    } catch (err: any) {
      emitProgress({ type: 'step', label: `SuperMemory query failed: ${err.message}. Querying local fallback.` });
    }
  }

  if (provider === 'upstash' && env.upstashVectorRestUrl && env.upstashVectorRestToken) {
    try {
      emitProgress({ type: 'step', label: `Querying Upstash Vector wiki for: "${query}"` });
      const index = new Index({
        url: env.upstashVectorRestUrl,
        token: env.upstashVectorRestToken,
      });
      const response = await index.query({
        data: query,
        topK: limit,
        includeMetadata: true,
        includeData: true,
      });

      if (response && response.length > 0) {
        return response.map((res: any) => ({
          id: res.id,
          content: res.data || res.metadata?.content || '',
          metadata: res.metadata,
          similarity: res.score ?? 0.5,
        }));
      }
      return [];
    } catch (err: any) {
      emitProgress({ type: 'step', label: `Upstash Vector query failed: ${err.message}. Querying local fallback.` });
    }
  }

  // Local fallback query
  emitProgress({ type: 'step', label: `Querying local corporate-wiki-fallback.json for: "${query}"` });
  const items = await readJson<any[]>('corporate-wiki-fallback.json', []);
  const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (queryTerms.length === 0) {
    return items.slice(0, limit).map(item => ({
      id: item.id,
      content: item.content,
      metadata: item.metadata,
      similarity: 1.0,
    }));
  }

  const results = items
    .map(item => {
      let score = 0;
      const contentLower = (item.content || '').toLowerCase();
      for (const term of queryTerms) {
        if (contentLower.includes(term)) {
          score += 1;
        }
      }
      return { item, score };
    })
    .filter(res => res.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(res => ({
      id: res.item.id,
      content: res.item.content,
      metadata: res.item.metadata,
      similarity: res.score / queryTerms.length,
    }));

  return results;
}
