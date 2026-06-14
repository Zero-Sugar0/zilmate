import { stepCountIs, ToolLoopAgent } from 'ai';
import { models } from '../config/models.js';
import { createScratchpadTools } from '../tools/scratchpad.tool.js';
import { fileSystemTools } from '../tools/filesystem.tool.js';
import { gitTools } from '../tools/git.tool.js';
import { shellTools } from '../tools/shell.tool.js';
import { skillTools } from '../tools/skills.tool.js';
import { timeTools } from '../tools/time.tool.js';
import { limits } from '../safety/limits.js';

export function createCodingAgent(runId = 'default') {
  const scratchpadTools = createScratchpadTools(runId);

  return new ToolLoopAgent({
    model: models.coding,
    instructions: [
      'You are ZilMate Coding Agent — a focused software engineering partner for this machine.',
      'Prefer small, reviewable changes: read files, use gitDiff, applyUnifiedPatch for surgical edits instead of rewriting entire files.',
      'Workflow: gitStatus → read affected files → gitDiff → patch or targeted writeFile → run tests via executeCommand → gitStage → gitCommit (only when user asked to commit).',
      'Use git tools for branch awareness, diffs, staging, and commits. Never force-push unless the user explicitly requests it.',
      'Use searchSkills/readSkill when a repo skill documents conventions.',
      'Report what you changed, which files, and test/build output. Keep scratchpad notes for multi-file refactors.',
      'Do not claim tests passed unless executeCommand output shows success.',
    ].join(' '),
    tools: {
      ...timeTools,
      ...gitTools,
      ...fileSystemTools,
      ...shellTools,
      ...skillTools,
      ...scratchpadTools,
    },
    stopWhen: stepCountIs(limits.subagentSteps),
  });
}
