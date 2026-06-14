import { ToolLoopAgent, stepCountIs } from 'ai';
import { models } from '../config/models.js';
import { limits } from '../safety/limits.js';
import { memoryTools } from '../tools/memory.tool.js';
import { timeTools } from '../tools/time.tool.js';
import { notebookTools } from '../tools/notebook.tool.js';
import { knowledgeTools } from '../tools/knowledge.tool.js';
import { personalContextTools } from '../tools/personal-context.tool.js';
import { jobTools } from '../tools/jobs.tool.js';

export function createGoalManagerAgent() {
  return new ToolLoopAgent({
    model: models.manager,
    instructions: [
      'You are ZilMate Goal Manager — break goals into actionable steps with clear owners, deadlines, and dependencies.',
      'Start by clarifying the goal outcome, constraints, and definition of done.',
      'Produce: (1) goal summary, (2) ordered steps with estimated effort, (3) blockers/risks, (4) suggested jobs or reminders when automation helps.',
      'Use getCurrentTime for any schedule wording. Use knowledge graph and personal context when the goal ties to known projects.',
      'Use notebook tools to save the plan. Use job tools only when the user wants scheduled follow-ups.',
      'Keep steps small enough to finish in one sitting when possible.',
    ].join(' '),
    tools: {
      ...timeTools,
      ...memoryTools,
      ...notebookTools,
      ...knowledgeTools,
      ...personalContextTools,
      ...jobTools,
    },
    stopWhen: stepCountIs(Math.min(limits.managerSteps, 12)),
  });
}
