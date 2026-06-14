import { tool } from 'ai';
import { z } from 'zod';
import { discoverSkills, readSkill, searchSkills, skillPathsHint } from '../skills/loader.js';
import { installRegistrySkill, saveSkillSearchLog, searchSkillsRegistry } from '../skills/registry.js';
import { emitProgress } from '../runtime/progress.js';

export const skillTools = {
  listSkills: tool({
    description: 'List installed/local agent skills (SKILL.md). Includes workspace/skills and .agents/skills paths.',
    inputSchema: z.object({}),
    execute: async () => {
      emitProgress({ type: 'fetch:start', label: 'Discovering local skills' });
      const skills = await discoverSkills();
      emitProgress({ type: 'fetch:end', label: 'Local skills discovered', detail: `${skills.length} skill(s)` });
      return { skills, searchPaths: skillPathsHint(), registry: 'https://skills.sh/' };
    },
  }),

  searchSkills: tool({
    description: 'Search local SKILL.md files by keyword.',
    inputSchema: z.object({
      query: z.string().min(2),
      limit: z.number().int().min(1).max(20).optional(),
    }),
    execute: async ({ query, limit }) => {
      emitProgress({ type: 'search:start', label: 'Searching local skills', detail: query });
      const skills = await searchSkills(query, limit ?? 5);
      emitProgress({ type: 'search:end', label: 'Local skill search complete', detail: `${skills.length} match(es)` });
      return { query, skills, scope: 'local' };
    },
  }),

  searchSkillsRegistry: tool({
    description: 'Search the open skills ecosystem (skills.sh / npx skills find) for installable skills — like find-skills workflow.',
    inputSchema: z.object({
      query: z.string().min(2),
      limit: z.number().int().min(1).max(15).optional(),
    }),
    execute: async ({ query, limit }) => {
      emitProgress({ type: 'search:start', label: 'Searching skills.sh registry', detail: query });
      const results = await searchSkillsRegistry(query, limit ?? 8);
      await saveSkillSearchLog(query, results);
      emitProgress({ type: 'search:end', label: 'Registry search complete', detail: `${results.length} result(s)` });
      return {
        query,
        results,
        installHint: 'Use installRegistrySkill with packageRef, e.g. owner/repo@skill-name',
        browse: 'https://skills.sh/',
      };
    },
  }),

  installRegistrySkill: tool({
    description: 'Install a skill from skills.sh via npx skills add into the ZilMate workspace skills folder.',
    inputSchema: z.object({
      packageRef: z.string().min(3).describe('e.g. vercel-labs/agent-skills@vercel-react-best-practices'),
      global: z.boolean().optional(),
    }),
    execute: async ({ packageRef, global }) => {
      emitProgress({ type: 'step', label: 'Installing skill', detail: packageRef });
      const result = await installRegistrySkill(packageRef, global ?? true);
      emitProgress({ type: 'step', label: 'Skill installed', detail: result.installPath });
      return result;
    },
  }),

  readSkill: tool({
    description: 'Load one local skill by id/name and return its full instructions. Follow the skill when it matches the user task.',
    inputSchema: z.object({
      skillId: z.string().min(1),
    }),
    execute: async ({ skillId }) => {
      emitProgress({ type: 'fetch:start', label: 'Reading skill', detail: skillId });
      const skill = await readSkill(skillId);
      if (!skill) throw new Error(`Skill not found: ${skillId}. Try searchSkillsRegistry or listSkills first.`);
      emitProgress({ type: 'fetch:end', label: 'Skill loaded', detail: skill.name });
      return skill;
    },
  }),
};
