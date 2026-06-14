import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { workspaceLayout } from '../workspace/paths.js';
import { initWorkspace } from '../workspace/init.js';

const execFileAsync = promisify(execFile);

export type RegistrySkill = {
  id: string;
  name: string;
  packageRef: string;
  url?: string;
  source: 'skills.sh' | 'npx-skills' | 'local';
};

function parseSkillsFindOutput(stdout: string): RegistrySkill[] {
  const results: RegistrySkill[] = [];
  const lines = stdout.split('\n');
  for (const line of lines) {
    const pkg = line.match(/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[A-Za-z0-9_.-]+)/);
    if (pkg) {
      const packageRef = pkg[1]!;
      const urlMatch = line.match(/https:\/\/skills\.sh\/[^\s]+/);
      results.push({
        id: packageRef.split('@').pop() || packageRef,
        name: packageRef,
        packageRef,
        ...(urlMatch ? { url: urlMatch[0] } : {}),
        source: 'npx-skills',
      });
    }
  }
  return results;
}

async function commandExists(command: string) {
  const probe = process.platform === 'win32' ? 'where.exe' : 'which';
  try {
    await execFileAsync(probe, [command], { windowsHide: true, timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function searchSkillsRegistry(query: string, limit = 8): Promise<RegistrySkill[]> {
  const results: RegistrySkill[] = [];

  try {
    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const { stdout } = await execFileAsync(npx, ['--yes', 'skills', 'find', query], {
      windowsHide: true,
      timeout: 60_000,
      env: { ...process.env, npm_config_yes: 'true' },
    });
    results.push(...parseSkillsFindOutput(stdout));
  } catch {
    // fall through to skills.sh fetch
  }

  if (results.length < limit) {
    try {
      const response = await fetch(`https://skills.sh/api/search?q=${encodeURIComponent(query)}`, {
        headers: { accept: 'application/json' },
      });
      if (response.ok) {
        const data = await response.json() as { results?: Array<{ slug?: string; name?: string; url?: string; package?: string }> };
        for (const item of data.results ?? []) {
          if (!item.slug && !item.package) continue;
          results.push({
            id: item.slug || item.name || 'skill',
            name: item.name || item.slug || 'skill',
            packageRef: item.package || item.slug || '',
            ...(item.url ? { url: item.url } : item.slug ? { url: `https://skills.sh/${item.slug}` } : {}),
            source: 'skills.sh',
          });
        }
      }
    } catch {
      // ignore network errors
    }
  }

  const seen = new Set<string>();
  return results.filter((item) => {
    const key = item.packageRef || item.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

export async function installRegistrySkill(packageRef: string, global = true) {
  await initWorkspace();
  const layout = workspaceLayout();
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const args = ['--yes', 'skills', 'add', packageRef, '-y'];
  if (global) args.push('-g');
  args.push('--path', layout.skills);

  const { stdout, stderr } = await execFileAsync(npx, args, {
    windowsHide: true,
    timeout: 120_000,
    env: { ...process.env, npm_config_yes: 'true' },
  });

  return {
    ok: true,
    packageRef,
    installPath: layout.skills,
    output: `${stdout}\n${stderr}`.trim(),
    browse: `https://skills.sh/`,
  };
}

export async function skillsRegistryDoctor() {
  const hasNpx = await commandExists(process.platform === 'win32' ? 'npx.cmd' : 'npx');
  return {
    name: 'Skills registry',
    ok: hasNpx,
    detail: hasNpx
      ? 'npx skills find/add available (skills.sh ecosystem)'
      : 'Install Node.js/npm to search skills.sh via npx skills',
  };
}

export async function saveSkillSearchLog(query: string, results: RegistrySkill[]) {
  const logPath = path.join(workspaceLayout().logs, 'skill-search.jsonl');
  await mkdir(path.dirname(logPath), { recursive: true });
  await writeFile(logPath, `${JSON.stringify({ query, results, at: new Date().toISOString() })}\n`, { flag: 'a' });
}
