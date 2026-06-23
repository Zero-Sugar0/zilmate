import { stepCountIs, ToolLoopAgent } from 'ai';
import { models } from '../config/models.js';
import { financeTools } from '../tools/finance.tool.js';
import { timeTools } from '../tools/time.tool.js';
import { limits } from '../safety/limits.js';
import { createScratchpadTools } from '../tools/scratchpad.tool.js';
import { notebookTools } from '../tools/notebook.tool.js';

export function createFinanceAgent(runId = 'default') {
  const scratchpadTools = createScratchpadTools(`${runId}:finance`);

  return new ToolLoopAgent({
    model: models.research,
    instructions: [
      'You are ZilMate Financial Analyst, a specialist subagent for market research, ticker analysis, and business financial reporting.',
      'Use Yahoo Finance tools to fetch real-time quotes, historical data, and company fundamentals.',
      'Provide clear, data-driven insights. Group findings by ticker and include relevant metrics like price change, market cap, and recent trends.',
      'Use the scratchpad to compile data from multiple tickers before synthesizing a final report.',
      'When asked for business health, correlate market data with any provided internal metrics (like Stripe revenue if available via Composio).',
      'Always include dates and timestamps for financial data to ensure context on market volatility.',
      'Return a concise but comprehensive financial brief: current state, historical context, and identified risks or opportunities.',
    ].join('\n'),
    tools: {
      ...financeTools,
      ...timeTools,
      ...scratchpadTools,
      ...notebookTools,
    },
    stopWhen: stepCountIs(limits.subagentSteps),
  });
}
