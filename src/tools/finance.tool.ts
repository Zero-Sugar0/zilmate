import { tool } from 'ai';
import { z } from 'zod';
import yahooFinance from 'yahoo-finance2';
import { emitProgress } from '../runtime/progress.js';

export const financeTools = {
  getTickerQuote: tool({
    description: 'Get live stock/crypto ticker quotes, price, change, and market cap using Yahoo Finance.',
    inputSchema: z.object({
      symbol: z.string().describe('Ticker symbol, e.g. AAPL, BTC-USD, TSLA.'),
    }),
    execute: async ({ symbol }) => {
      emitProgress({ type: 'tool:start', label: 'Fetching ticker quote', detail: symbol });
      try {
        const quote = await yahooFinance.quote(symbol);
        emitProgress({ type: 'tool:end', label: 'Ticker quote retrieved' });
        return quote as any;
      } catch (error) {
        emitProgress({ type: 'tool:error', label: 'Ticker quote failed', detail: String(error) });
        throw error;
      }
    },
  }),

  getHistoricalData: tool({
    description: 'Get historical price data for a ticker over a period (daily, weekly, monthly).',
    inputSchema: z.object({
      symbol: z.string().describe('Ticker symbol.'),
      period1: z.string().describe('Start date (YYYY-MM-DD).'),
      period2: z.string().optional().describe('End date (YYYY-MM-DD), default is today.'),
      interval: z.enum(['1d', '1wk', '1mo']).optional().default('1d'),
    }),
    execute: async ({ symbol, period1, period2, interval }) => {
      emitProgress({ type: 'tool:start', label: 'Fetching historical data', detail: symbol });
      try {
        const history = await yahooFinance.historical(symbol, {
          period1,
          period2: period2 || new Date().toISOString().split('T')[0],
          interval: interval as any,
        });
        emitProgress({ type: 'tool:end', label: 'Historical data retrieved' });
        return history as any;
      } catch (error) {
        emitProgress({ type: 'tool:error', label: 'Historical data failed', detail: String(error) });
        throw error;
      }
    },
  }),

  searchCompany: tool({
    description: 'Search for ticker symbols and company information on Yahoo Finance.',
    inputSchema: z.object({
      query: z.string().describe('Company name or search term.'),
    }),
    execute: async ({ query }) => {
      emitProgress({ type: 'tool:start', label: 'Searching company', detail: query });
      try {
        const result = await yahooFinance.search(query);
        emitProgress({ type: 'tool:end', label: 'Company search complete' });
        return result as any;
      } catch (error) {
        emitProgress({ type: 'tool:error', label: 'Company search failed', detail: String(error) });
        throw error;
      }
    },
  }),

  getTickerSummary: tool({
    description: 'Get a comprehensive summary of a ticker including fundamentals, asset profile, and price history.',
    inputSchema: z.object({
      symbol: z.string().describe('Ticker symbol.'),
    }),
    execute: async ({ symbol }) => {
      emitProgress({ type: 'tool:start', label: 'Fetching ticker summary', detail: symbol });
      try {
        const summary = await yahooFinance.quoteSummary(symbol, {
          modules: ['price', 'summaryDetail', 'assetProfile', 'financialData'],
        });
        emitProgress({ type: 'tool:end', label: 'Ticker summary retrieved' });
        return summary as any;
      } catch (error) {
        emitProgress({ type: 'tool:error', label: 'Ticker summary failed', detail: String(error) });
        throw error;
      }
    },
  }),
};
