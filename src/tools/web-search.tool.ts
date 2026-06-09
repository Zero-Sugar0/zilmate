import { tavily } from '@tavily/core';
import { tool } from 'ai';
import { z } from 'zod';
import { requireTavily } from '../config/env.js';
import { clampText, limits } from '../safety/limits.js';
import { emitProgress } from '../runtime/progress.js';

export type WebSearchResult = {
  title: string;
  url: string;
  content: string;
};

type TavilyClient = ReturnType<typeof tavily>;

type SearchOptions = {
  maxResults?: number | undefined;
  searchDepth?: 'basic' | 'advanced' | undefined;
  includeAnswer?: boolean | undefined;
  includeRawContent?: false | 'markdown' | 'text' | undefined;
  includeDomains?: string[] | undefined;
  excludeDomains?: string[] | undefined;
  topic?: 'general' | 'news' | 'finance' | undefined;
  timeRange?: 'day' | 'week' | 'month' | 'year' | undefined;
};

function client(): TavilyClient {
  return tavily({ apiKey: requireTavily() });
}

function compactResult(item: { title?: string; url?: string; content?: string; rawContent?: string; score?: number; publishedDate?: string }) {
  return {
    title: item.title || item.url || 'Untitled',
    url: item.url || '',
    content: clampText(item.content || '', 1200),
    rawContent: item.rawContent ? clampText(item.rawContent, 2500) : undefined,
    score: item.score,
    publishedDate: item.publishedDate,
  };
}

function pruneUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

export async function searchWeb(query: string, maxResults = limits.researchResults): Promise<WebSearchResult[]> {
  emitProgress({ type: 'search:start', label: 'Searching the web', detail: query });
  const result = await client().search(query, {
    maxResults,
    searchDepth: 'basic',
    includeAnswer: false,
  });
  const results = (result.results || []).map((item) => ({
    title: item.title || item.url || 'Untitled',
    url: item.url,
    content: item.content || '',
  }));
  emitProgress({ type: 'search:end', label: 'Web search complete', detail: `${results.length} result${results.length === 1 ? '' : 's'}` });
  return results;
}

async function runWebSearch(query: string, options: SearchOptions = {}) {
  const maxResults = options.maxResults ?? limits.researchResults;
  emitProgress({ type: 'search:start', label: 'Searching the web', detail: query });
  const result = await client().search(query, pruneUndefined({
    maxResults,
    searchDepth: options.searchDepth ?? 'basic',
    includeAnswer: options.includeAnswer ?? false,
    includeRawContent: options.includeRawContent ?? false,
    includeDomains: options.includeDomains,
    excludeDomains: options.excludeDomains,
    topic: options.topic,
    timeRange: options.timeRange,
  }) as Parameters<TavilyClient['search']>[1]);

  const results = (result.results || []).map((item) => compactResult(item));
  emitProgress({ type: 'search:end', label: 'Web search complete', detail: `${results.length} result${results.length === 1 ? '' : 's'}` });
  return {
    answer: result.answer ? clampText(result.answer, 1600) : undefined,
    results,
  };
}

export const webSearchTool = tool({
  description: 'Fast Tavily web search for current docs or facts. Prefer local Zilo docs first for ZiloShift product behavior.',
  inputSchema: z.object({
    query: z.string().min(3),
    maxResults: z.number().int().min(1).max(10).optional(),
    searchDepth: z.enum(['basic', 'advanced']).optional(),
    includeAnswer: z.boolean().optional(),
    includeRawContent: z.enum(['markdown', 'text']).optional(),
    includeDomains: z.array(z.string()).max(8).optional(),
    excludeDomains: z.array(z.string()).max(8).optional(),
    topic: z.enum(['general', 'news', 'finance']).optional(),
    timeRange: z.enum(['day', 'week', 'month', 'year']).optional(),
  }),
  execute: async ({ includeRawContent, ...input }) => runWebSearch(input.query, {
    ...input,
    includeRawContent: includeRawContent ?? false,
  }),
});

export const webExtractTool = tool({
  description: 'Deeply extract content from known URLs. Use after finding official or trusted URLs; max 5 URLs.',
  inputSchema: z.object({
    urls: z.array(z.string().url()).min(1).max(5),
    query: z.string().min(3).optional(),
    extractDepth: z.enum(['basic', 'advanced']).optional(),
    format: z.enum(['markdown', 'text']).optional(),
    chunksPerSource: z.number().int().min(1).max(5).optional(),
  }),
  execute: async ({ urls, query, extractDepth, format, chunksPerSource }) => {
    emitProgress({ type: 'fetch:start', label: 'Extracting web pages', detail: urls.join(', ') });
    const result = await client().extract(urls, pruneUndefined({
      query,
      extractDepth: extractDepth ?? 'basic',
      format: format ?? 'markdown',
      chunksPerSource,
    }) as Parameters<TavilyClient['extract']>[1]);

    const results = (result.results || []).map((item) => ({
      url: item.url,
      title: item.title || item.url,
      rawContent: clampText(item.rawContent || '', 5000),
    }));
    const failedResults = (result.failedResults || []).map((item) => ({ url: item.url, error: item.error }));
    emitProgress({ type: 'fetch:end', label: 'Web extract complete', detail: `${results.length} page${results.length === 1 ? '' : 's'}` });
    return { results, failedResults };
  },
});

export const webMapTool = tool({
  description: 'Map URLs on a documentation site before crawling. Use to discover relevant pages without extracting all content.',
  inputSchema: z.object({
    url: z.string().url(),
    instructions: z.string().min(3).max(500).optional(),
    maxDepth: z.number().int().min(1).max(3).optional(),
    limit: z.number().int().min(1).max(50).optional(),
    allowExternal: z.boolean().optional(),
  }),
  execute: async ({ url, instructions, maxDepth, limit, allowExternal }) => {
    emitProgress({ type: 'search:start', label: 'Mapping website', detail: url });
    const result = await client().map(url, pruneUndefined({
      instructions,
      maxDepth: maxDepth ?? 2,
      limit: limit ?? 20,
      allowExternal: allowExternal ?? false,
    }) as Parameters<TavilyClient['map']>[1]);

    const results = (result.results || []).slice(0, limit ?? 20);
    emitProgress({ type: 'search:end', label: 'Website map complete', detail: `${results.length} URL${results.length === 1 ? '' : 's'}` });
    return { baseUrl: url, results };
  },
});

export const webCrawlTool = tool({
  description: 'Crawl a small docs section with strict limits. Use only when search/extract is not enough.',
  inputSchema: z.object({
    url: z.string().url(),
    instructions: z.string().min(3).max(700).optional(),
    maxDepth: z.number().int().min(1).max(2).optional(),
    maxBreadth: z.number().int().min(1).max(20).optional(),
    limit: z.number().int().min(1).max(10).optional(),
    allowExternal: z.boolean().optional(),
  }),
  execute: async ({ url, instructions, maxDepth, maxBreadth, limit, allowExternal }) => {
    emitProgress({ type: 'fetch:start', label: 'Crawling docs section', detail: url });
    const result = await client().crawl(url, pruneUndefined({
      instructions,
      maxDepth: maxDepth ?? 1,
      maxBreadth: maxBreadth ?? 8,
      limit: limit ?? 5,
      allowExternal: allowExternal ?? false,
      extractDepth: 'basic',
      format: 'markdown',
      chunksPerSource: 2,
      timeout: 90,
    }) as Parameters<TavilyClient['crawl']>[1]);

    const crawlResult = result as unknown as { results?: Array<{ url: string; title?: string; rawContent?: string }>; failedResults?: Array<{ url: string; error?: string }> };
    const results = (crawlResult.results || []).map((item) => ({
      url: item.url,
      title: item.title || item.url,
      content: clampText(item.rawContent || '', 2500),
    }));
    const failedResults = (crawlResult.failedResults || []).map((item) => ({ url: item.url, error: item.error }));
    emitProgress({ type: 'fetch:end', label: 'Docs crawl complete', detail: `${results.length} page${results.length === 1 ? '' : 's'}` });
    return { results, failedResults };
  },
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const deepResearchTool = tool({
  description: 'Run a Tavily deep research task for broad synthesis. Heavier and slower; use only when explicitly useful.',
  inputSchema: z.object({
    input: z.string().min(10),
    model: z.enum(['mini', 'pro']).optional(),
    timeoutSeconds: z.number().int().min(30).max(180).optional(),
    pollIntervalSeconds: z.number().int().min(5).max(20).optional(),
  }),
  execute: async ({ input, model, timeoutSeconds, pollIntervalSeconds }) => {
    const timeoutMs = (timeoutSeconds ?? 90) * 1000;
    const pollMs = (pollIntervalSeconds ?? 10) * 1000;
    emitProgress({ type: 'search:start', label: 'Starting deep research', detail: input });
    const start = await client().research(input, {
      model: model ?? 'mini',
      citationFormat: 'numbered',
      timeout: 45,
    });

    const researchStart = start as { requestId?: string };
    const requestId = researchStart.requestId;
    if (!requestId) throw new Error('Tavily research did not return a requestId.');

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await sleep(pollMs);
      emitProgress({ type: 'step', label: 'Checking deep research status', detail: requestId });
      const result = await client().getResearch(requestId);
      const researchResult = result as { status: string; content?: string; sources?: Array<{ title?: string; url: string }> };
      if (researchResult.status === 'completed') {
        const sources = (researchResult.sources || []).map((source) => ({
          title: source.title || source.url,
          url: source.url,
        }));
        emitProgress({ type: 'search:end', label: 'Deep research complete', detail: `${sources.length} source${sources.length === 1 ? '' : 's'}` });
        return {
          requestId,
          status: researchResult.status,
          content: clampText(researchResult.content || '', 9000),
          sources,
        };
      }
      if (researchResult.status === 'failed') {
        throw new Error(`Tavily research failed for request ${requestId}.`);
      }
    }

    emitProgress({ type: 'search:end', label: 'Deep research still running', detail: requestId });
    return {
      requestId,
      status: 'running',
      message: `Research is still running after ${Math.round(timeoutMs / 1000)} seconds. Ask again with this requestId or use a longer timeout.`,
    };
  },
});

