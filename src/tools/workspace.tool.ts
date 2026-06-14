import { tool } from 'ai';
import { z } from 'zod';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { initWorkspace } from '../workspace/init.js';
import { workspaceLayout, resolveWorkspaceRoot } from '../workspace/paths.js';
import { discoverSkills } from '../skills/loader.js';
import { emitProgress } from '../runtime/progress.js';

export const workspaceTools = {
  getWorkspaceInfo: tool({
    description: 'Show ZilMate workspace paths (notebook, skills, outputs, logs). Use before saving files or installing skills.',
    inputSchema: z.object({}),
    execute: async () => {
      const layout = workspaceLayout();
      const skills = await discoverSkills();
      return {
        root: layout.root,
        paths: layout,
        skillCount: skills.length,
        exists: existsSync(layout.root),
      };
    },
  }),

  initWorkspace: tool({
    description: 'Create or repair the ZilMate workspace folder structure (notebook, skills, outputs, logs).',
    inputSchema: z.object({}),
    execute: async () => {
      emitProgress({ type: 'step', label: 'Initializing ZilMate workspace' });
      const layout = await initWorkspace();
      return { ok: true, root: layout.root };
    },
  }),

  installSkill: tool({
    description: 'Install a skill into the workspace skills folder so ZilMate can read it later. Provide SKILL.md content or a source path on disk.',
    inputSchema: z.object({
      name: z.string().min(2).describe('Skill folder name, e.g. my-workflow'),
      description: z.string().min(3),
      body: z.string().min(10).describe('Markdown instructions after frontmatter'),
      sourcePath: z.string().optional().describe('Optional existing SKILL.md path to copy'),
    }),
    execute: async ({ name, description, body, sourcePath }) => {
      await initWorkspace();
      const layout = workspaceLayout();
      const skillDir = path.join(layout.skills, name.replace(/[^\w.-]+/g, '-'));
      await mkdir(skillDir, { recursive: true });
      const target = path.join(skillDir, 'SKILL.md');

      if (sourcePath && existsSync(sourcePath)) {
        const { copyFile } = await import('node:fs/promises');
        await copyFile(sourcePath, target);
      } else {
        const content = `---\nname: ${name}\ndescription: ${description}\n---\n\n${body.trim()}\n`;
        await writeFile(target, content, 'utf8');
      }

      emitProgress({ type: 'step', label: 'Skill installed', detail: target });
      return { path: target, skillDir, hint: 'Run listSkills or searchSkills to verify discovery.' };
    },
  }),
};

export function workspaceRootForAgent() {
  return resolveWorkspaceRoot();
}
