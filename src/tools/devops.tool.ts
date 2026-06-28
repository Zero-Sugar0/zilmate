import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';
import { tool } from 'ai';
import { z } from 'zod';
import { emitProgress } from '../runtime/progress.js';
import { resolveWorkspaceRoot } from '../workspace/paths.js';

const execFileAsync = promisify(execFile);

async function commandExists(command: string) {
  const probe = process.platform === 'win32' ? 'where.exe' : 'which';
  try {
    await execFileAsync(probe, [command], { windowsHide: true, timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function parseEnvContent(content: string): Set<string> {
  const keys = new Set<string>();
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=/);
    if (match && match[1]) {
      keys.add(match[1].trim());
    }
  }
  return keys;
}

export const devopsTools = {
  listDockerContainers: tool({
    description: 'List all running and stopped Docker containers with their IDs, names, status, and ports. Works on Windows, macOS, and Linux.',
    inputSchema: z.object({
      all: z.boolean().optional().default(true).describe('If true, lists all containers (running and stopped). If false, lists only running containers.'),
    }),
    execute: async ({ all }) => {
      emitProgress({ type: 'fetch:start', label: 'Listing Docker containers' });
      const hasDocker = await commandExists('docker');
      if (!hasDocker) {
        emitProgress({ type: 'fetch:end', label: 'Docker list failed', detail: 'Docker CLI not found' });
        return { error: 'Docker CLI not found. Please ensure Docker is installed and in your system PATH.' };
      }

      try {
        const args = ['ps', '--format', '{{json .}}'];
        if (all) {
          args.push('-a');
        }

        const { stdout } = await execFileAsync('docker', args, { windowsHide: true, timeout: 10000 });
        const lines = stdout.trim().split('\n').filter(Boolean);
        const containers = lines.map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return { raw: line };
          }
        });

        emitProgress({ type: 'fetch:end', label: 'Docker containers listed', detail: `Found ${containers.length} container(s)` });
        return { containers };
      } catch (error: any) {
        emitProgress({ type: 'tool:error', label: 'Docker list failed', detail: error.message });
        return {
          error: 'Failed to list containers. Is the Docker daemon running?',
          rawError: error.message,
        };
      }
    },
  }),

  getDockerContainerLogs: tool({
    description: 'Retrieve stdout and stderr logs from a specified Docker container. Works on Windows, macOS, and Linux.',
    inputSchema: z.object({
      container: z.string().min(1).describe('The ID or name of the Docker container.'),
      tail: z.number().int().min(1).max(2000).optional().default(100).describe('Number of lines to show from the end of the logs.'),
    }),
    execute: async ({ container, tail }) => {
      emitProgress({ type: 'fetch:start', label: 'Fetching Docker logs', detail: container });
      const hasDocker = await commandExists('docker');
      if (!hasDocker) {
        emitProgress({ type: 'fetch:end', label: 'Docker logs failed', detail: 'Docker CLI not found' });
        return { error: 'Docker CLI not found.' };
      }

      try {
        const { stdout, stderr } = await execFileAsync(
          'docker',
          ['logs', '--tail', String(tail), container],
          { windowsHide: true, timeout: 15000 }
        );

        emitProgress({ type: 'fetch:end', label: 'Docker logs retrieved', detail: container });
        return {
          container,
          logs: stdout + stderr,
        };
      } catch (error: any) {
        emitProgress({ type: 'tool:error', label: 'Docker logs failed', detail: error.message });
        return {
          error: `Failed to retrieve logs for container "${container}".`,
          rawError: error.message,
        };
      }
    },
  }),

  controlDockerContainer: tool({
    description: 'Start, stop, restart, or hard terminate (kill) a specified Docker container. Works on Windows, macOS, and Linux.',
    inputSchema: z.object({
      container: z.string().min(1).describe('The ID or name of the Docker container.'),
      action: z.enum(['start', 'stop', 'restart', 'kill']).describe('The action to perform on the container.'),
    }),
    execute: async ({ container, action }) => {
      emitProgress({ type: 'tool:start', label: `${action.charAt(0).toUpperCase() + action.slice(1)}ing Docker container`, detail: container });
      const hasDocker = await commandExists('docker');
      if (!hasDocker) {
        emitProgress({ type: 'tool:error', label: 'Docker control failed', detail: 'Docker CLI not found' });
        return { error: 'Docker CLI not found.' };
      }

      try {
        await execFileAsync('docker', [action, container], { windowsHide: true, timeout: 20000 });
        emitProgress({ type: 'tool:end', label: `Docker container ${action}ed`, detail: container });
        return { success: true, container, action };
      } catch (error: any) {
        emitProgress({ type: 'tool:error', label: `Docker ${action} failed`, detail: error.message });
        return {
          success: false,
          error: `Failed to ${action} container "${container}".`,
          rawError: error.message,
        };
      }
    },
  }),

  validateEnv: tool({
    description: 'Compare the keys in `.env` and `.env.example` in the workspace root to check for missing or extra settings. Does NOT expose secret values for security.',
    inputSchema: z.object({}),
    execute: async () => {
      emitProgress({ type: 'fetch:start', label: 'Validating env files' });
      const root = resolveWorkspaceRoot();
      const envPath = path.join(root, '.env');
      const examplePath = path.join(root, '.env.example');

      const envExists = existsSync(envPath);
      const exampleExists = existsSync(examplePath);

      if (!envExists && !exampleExists) {
        emitProgress({ type: 'fetch:end', label: 'Env validation done', detail: 'No .env or .env.example files found' });
        return { error: 'Neither .env nor .env.example files were found in the workspace root.' };
      }

      let envKeys = new Set<string>();
      let exampleKeys = new Set<string>();

      if (envExists) {
        try {
          const content = await readFile(envPath, 'utf8');
          envKeys = parseEnvContent(content);
        } catch (error: any) {
          return { error: `Failed to read .env file: ${error.message}` };
        }
      }

      if (exampleExists) {
        try {
          const content = await readFile(examplePath, 'utf8');
          exampleKeys = parseEnvContent(content);
        } catch (error: any) {
          return { error: `Failed to read .env.example file: ${error.message}` };
        }
      }

      const missingInEnv = [...exampleKeys].filter((key) => !envKeys.has(key));
      const missingInExample = [...envKeys].filter((key) => !exampleKeys.has(key));
      const presentInBoth = [...envKeys].filter((key) => exampleKeys.has(key));

      emitProgress({
        type: 'fetch:end',
        label: 'Env validation complete',
        detail: `Missing in .env: ${missingInEnv.length}, Extra: ${missingInExample.length}`,
      });

      return {
        envExists,
        exampleExists,
        missingInEnv,
        missingInExample,
        presentInBoth,
      };
    },
  }),

  manageDockerCompose: tool({
    description: 'Orchestrate multi-container applications using Docker Compose (up, down, build, restart, ps, logs). Works on Windows, macOS, and Linux.',
    inputSchema: z.object({
      action: z.enum(['up', 'down', 'build', 'restart', 'ps', 'logs']).describe('The docker-compose action to perform.'),
      composeFile: z.string().optional().describe('Optional custom compose file name (e.g., "docker-compose.prod.yml"). Default is docker-compose.yml.'),
      services: z.array(z.string()).optional().describe('Optional list of specific services to apply the action to (e.g. ["db", "redis"]).'),
    }),
    execute: async ({ action, composeFile, services }) => {
      emitProgress({ type: 'tool:start', label: `Running docker-compose ${action}` });

      const hasDocker = await commandExists('docker');
      const hasDockerCompose = await commandExists('docker-compose');

      if (!hasDocker && !hasDockerCompose) {
        emitProgress({ type: 'tool:error', label: 'Docker Compose failed', detail: 'No Docker CLI or docker-compose found' });
        return { error: 'Docker is not installed or available in your system PATH.' };
      }

      try {
        let composeCmd = 'docker';
        let baseArgs = ['compose'];
        try {
          await execFileAsync('docker', ['compose', 'version'], { windowsHide: true, timeout: 5000 });
        } catch {
          if (hasDockerCompose) {
            composeCmd = 'docker-compose';
            baseArgs = [];
          } else {
            return { error: 'Neither modern "docker compose" plugin nor "docker-compose" legacy binary is available.' };
          }
        }

        const args = [...baseArgs];

        if (composeFile) {
          const root = resolveWorkspaceRoot();
          const resolvedComposePath = path.isAbsolute(composeFile) ? composeFile : path.join(root, composeFile);
          if (!existsSync(resolvedComposePath)) {
            return { error: `Specified compose file not found at: ${composeFile}` };
          }
          args.push('-f', resolvedComposePath);
        }

        args.push(action);

        if (action === 'up') {
          args.push('-d');
        } else if (action === 'logs') {
          args.push('--tail', '100');
        }

        if (services && services.length > 0) {
          args.push(...services);
        }

        emitProgress({ type: 'step', label: `Executing: ${composeCmd} ${args.join(' ')}` });

        const { stdout, stderr } = await execFileAsync(composeCmd, args, { windowsHide: true, timeout: 120000 });

        emitProgress({ type: 'tool:end', label: `Docker-compose ${action} complete` });
        return {
          success: true,
          action,
          command: `${composeCmd} ${args.join(' ')}`,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        };
      } catch (error: any) {
        emitProgress({ type: 'tool:error', label: `Docker-compose ${action} failed`, detail: error.message });
        return {
          success: false,
          error: `Docker Compose action "${action}" failed.`,
          rawError: error.message,
        };
      }
    },
  }),

  runDockerContainer: tool({
    description: 'Start a new Docker container with custom port mappings, environment variables, volumes, networks, restart policies, and memory ceilings. Works on Windows, macOS, and Linux.',
    inputSchema: z.object({
      image: z.string().min(1).describe('The Docker image to run (e.g. "postgres:15-alpine", "redis:alpine").'),
      name: z.string().optional().describe('Optional name for the container (must be unique).'),
      ports: z.array(z.string()).optional().describe('Optional port mappings (e.g., ["5432:5432", "6379:6379"]).'),
      env: z.array(z.string()).optional().describe('Optional environment variables (e.g., ["POSTGRES_PASSWORD=secret", "REDIS_PASSWORD=my-pass"]).'),
      volumes: z.array(z.string()).optional().describe('Optional volume mappings (e.g., ["pgdata:/var/lib/postgresql/data"]).'),
      restartPolicy: z.enum(['no', 'always', 'unless-stopped', 'on-failure']).optional().describe('Optional restart policy (no, always, unless-stopped, on-failure). Default is "no".'),
      network: z.string().optional().describe('Optional Docker network to connect to.'),
      autoRemove: z.boolean().optional().default(false).describe('If true, appends --rm to auto-remove container on exit. Default is false.'),
      memoryLimit: z.string().optional().describe('Optional memory limits (e.g., "512m", "1g").'),
    }),
    execute: async ({ image, name, ports, env, volumes, restartPolicy, network, autoRemove, memoryLimit }) => {
      emitProgress({ type: 'tool:start', label: 'Starting Docker container', detail: image });

      const hasDocker = await commandExists('docker');
      if (!hasDocker) {
        emitProgress({ type: 'tool:error', label: 'Docker run failed', detail: 'Docker CLI not found' });
        return { error: 'Docker CLI not found. Please ensure Docker is installed and running.' };
      }

      try {
        const args = ['run', '-d'];

        if (autoRemove) {
          args.push('--rm');
        }

        if (restartPolicy) {
          args.push('--restart', restartPolicy);
        }

        if (network) {
          args.push('--network', network);
        }

        if (memoryLimit) {
          args.push('-m', memoryLimit);
        }

        if (name) {
          if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
            return { error: 'Invalid container name. Only alphanumeric characters, hyphens, and underscores are allowed.' };
          }
          args.push('--name', name);
        }

        if (ports) {
          for (const port of ports) {
            args.push('-p', port);
          }
        }

        if (env) {
          for (const ev of env) {
            args.push('-e', ev);
          }
        }

        if (volumes) {
          for (const vol of volumes) {
            args.push('-v', vol);
          }
        }

        args.push(image);

        emitProgress({ type: 'step', label: `Executing: docker ${args.join(' ')}` });

        const { stdout } = await execFileAsync('docker', args, { windowsHide: true, timeout: 30000 });
        const containerId = stdout.trim();

        emitProgress({ type: 'tool:end', label: 'Docker container started', detail: containerId.slice(0, 12) });
        return {
          success: true,
          image,
          containerId,
          name: name || null,
        };
      } catch (error: any) {
        emitProgress({ type: 'tool:error', label: 'Docker run failed', detail: error.message });
        return {
          success: false,
          error: `Failed to run Docker container for image "${image}".`,
          rawError: error.message,
        };
      }
    },
  }),

  execDockerCommand: tool({
    description: 'Execute a terminal command inside a running Docker container securely. Supports custom users and working directories. Works on Windows, macOS, and Linux.',
    inputSchema: z.object({
      container: z.string().min(1).describe('The ID or name of the running container.'),
      command: z.array(z.string()).min(1).describe('The command and argument array to run (e.g., ["npm", "run", "db:migrate"]).'),
      user: z.string().optional().describe('Optional username or UID to execute as (e.g., "root" or "postgres").'),
      workdir: z.string().optional().describe('Optional working directory path inside the container.'),
    }),
    execute: async ({ container, command, user, workdir }) => {
      emitProgress({ type: 'tool:start', label: 'Running container command', detail: `${container}: ${command.join(' ')}` });

      const hasDocker = await commandExists('docker');
      if (!hasDocker) {
        emitProgress({ type: 'tool:error', label: 'Docker exec failed', detail: 'Docker CLI not found' });
        return { error: 'Docker CLI not found.' };
      }

      try {
        const args = ['exec'];

        if (user) {
          args.push('--user', user);
        }

        if (workdir) {
          args.push('--workdir', workdir);
        }

        args.push(container);
        args.push(...command);

        emitProgress({ type: 'step', label: `Executing: docker ${args.join(' ')}` });

        const { stdout, stderr } = await execFileAsync('docker', args, { windowsHide: true, timeout: 60000 });

        emitProgress({ type: 'tool:end', label: 'Container command execution successful' });
        return {
          success: true,
          container,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        };
      } catch (error: any) {
        emitProgress({ type: 'tool:error', label: 'Container command execution failed', detail: error.message });
        return {
          success: false,
          error: `Failed to execute command inside container "${container}".`,
          rawError: error.message,
        };
      }
    },
  }),
};
