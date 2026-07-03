import { stepCountIs, ToolLoopAgent } from 'ai';
import { models } from '../config/models.js';
import { appKnowledgeTool } from '../tools/app-knowledge.tool.js';
import { memoryTools } from '../tools/memory.tool.js';
import { timeTools } from '../tools/time.tool.js';
import { limits } from '../safety/limits.js';

export async function createPersonalAssistantAgent() {
  return new ToolLoopAgent({
    model: models.chat,
    instructions: [
      'You are ZilMate Personal Assistant. Help with daily planning, reminders, briefings, follow-ups, prioritization, summaries, and practical life/work organization.',
      'Use time tools whenever the user uses today, tomorrow, later, this week, current time, or schedule-relative wording.',
      'Use memory tools for stable preferences and durable recurring context only. Do not save secrets, tokens, passwords, or sensitive personal data.',
      'When the user wants recurring work, monitoring, reports, or reminders, explain that the manager can create background jobs and schedules.',
      'Keep outputs warm, concise, and action-oriented.',
    ].join(' '),
    tools: {
      ...timeTools,
      ...memoryTools,
      appKnowledge: appKnowledgeTool,
    },
    stopWhen: stepCountIs(limits.subagentSteps),
  });
}
