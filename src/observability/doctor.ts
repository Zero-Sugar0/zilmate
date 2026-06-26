import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { emitProgress } from '../runtime/progress.js';
import { createMCPTools } from '../tools/mcp.tool.js';

const execFileAsync = promisify(execFile);

export async function checkDependency(command: string): Promise<boolean> {
  const probe = process.platform === 'win32' ? 'where.exe' : 'which';
  try {
    await execFileAsync(probe, [command]);
    return true;
  } catch {
    return false;
  }
}

export async function runProactiveDoctor() {
  // Proactively warm up MCP servers once per session
  createMCPTools().catch(() => undefined);

  const dependencies = [
    { name: 'ffmpeg', critical: false },
    { name: 'nmap', critical: false },
    { name: 'python', critical: false },
    { name: 'git', critical: false },
  ];

  for (const dep of dependencies) {
    const found = await checkDependency(dep.name);
    if (!found) {
      emitProgress({
        type: 'step',
        label: 'Dependency check',
        detail: `Missing optional dependency: ${dep.name}. Some tools may be unavailable.`,
      });
    }
  }
}
