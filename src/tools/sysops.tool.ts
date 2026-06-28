import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';
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

function getCpuTicks() {
  const cpus = os.cpus();
  let user = 0;
  let nice = 0;
  let sys = 0;
  let idle = 0;
  let irq = 0;
  for (const cpu of cpus) {
    user += cpu.times.user;
    nice += cpu.times.nice;
    sys += cpu.times.sys;
    idle += cpu.times.idle;
    irq += cpu.times.irq;
  }
  const total = user + nice + sys + idle + irq;
  return { idle, total };
}

async function sampleCpuUsage(): Promise<number> {
  const start = getCpuTicks();
  await new Promise(resolve => setTimeout(resolve, 150));
  const end = getCpuTicks();
  const idleDelta = end.idle - start.idle;
  const totalDelta = end.total - start.total;
  if (totalDelta === 0) return 0;
  const usage = 100 * (1 - idleDelta / totalDelta);
  return Math.round(usage * 10) / 10;
}

async function getDiskSpace(workspaceRoot: string) {
  try {
    if (process.platform === 'win32') {
      const driveLetter = path.parse(workspaceRoot).root.replace(':\\', '').replace(':', '') || 'C';
      const script = `
        Get-Volume -DriveLetter "${driveLetter}" -ErrorAction SilentlyContinue | ForEach-Object {
          [PSCustomObject]@{
            size = $_.Size
            free = $_.SizeRemaining
          }
        } | ConvertTo-Json -Compress
      `;
      const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true, timeout: 5000 });
      const cleaned = stdout.trim();
      if (cleaned) {
        const parsed = JSON.parse(cleaned);
        const totalGb = parsed.size / (1024 * 1024 * 1024);
        const freeGb = parsed.free / (1024 * 1024 * 1024);
        return {
          totalGb: Math.round(totalGb * 10) / 10,
          freeGb: Math.round(freeGb * 10) / 10,
          usedGb: Math.round((totalGb - freeGb) * 10) / 10,
        };
      }
      
      const { stdout: fsStdout } = await execFileAsync('wmic', ['logicaldisk', 'where', `DeviceID="${driveLetter}:"`, 'get', 'FreeSpace,Size', '/format:list'], { windowsHide: true, timeout: 5000 });
      const lines = fsStdout.split('\n');
      let free = 0;
      let size = 0;
      for (const line of lines) {
        if (line.startsWith('FreeSpace=')) free = parseInt(line.split('=')[1] || '0', 10);
        if (line.startsWith('Size=')) size = parseInt(line.split('=')[1] || '0', 10);
      }
      if (size > 0) {
        const totalGb = size / (1024 * 1024 * 1024);
        const freeGb = free / (1024 * 1024 * 1024);
        return {
          totalGb: Math.round(totalGb * 10) / 10,
          freeGb: Math.round(freeGb * 10) / 10,
          usedGb: Math.round((totalGb - freeGb) * 10) / 10,
        };
      }
    } else {
      const { stdout } = await execFileAsync('df', ['-k', workspaceRoot], { timeout: 5000 });
      const lines = stdout.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1]!.trim().split(/\s+/).filter(Boolean);
        const totalKb = parseInt(parts[1] || '0', 10);
        const usedKb = parseInt(parts[2] || '0', 10);
        const freeKb = parseInt(parts[3] || '0', 10);
        return {
          totalGb: Math.round((totalKb / (1024 * 1024)) * 10) / 10,
          freeGb: Math.round((freeKb / (1024 * 1024)) * 10) / 10,
          usedGb: Math.round((usedKb / (1024 * 1024)) * 10) / 10,
        };
      }
    }
  } catch (err) {
    // Fall back to 0
  }
  return { totalGb: 0, freeGb: 0, usedGb: 0 };
}

export const sysopsTools = {
  listOpenPorts: tool({
    description: 'List all open/listening TCP ports on the local system, including PIDs and process names. Works on Windows, macOS, and Linux.',
    inputSchema: z.object({}),
    execute: async () => {
      emitProgress({ type: 'fetch:start', label: 'Listing open ports' });

      try {
        if (process.platform === 'win32') {
          const script = `
            Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
              $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
              [PSCustomObject]@{
                localAddress = $_.LocalAddress
                localPort    = $_.LocalPort
                state        = $_.State.ToString()
                pid          = $_.OwningProcess
                processName  = if ($proc) { $proc.Name } else { "Unknown" }
              }
            } | ConvertTo-Json -Compress
          `;

          const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true, timeout: 10000 });
          const cleaned = stdout.trim();
          if (!cleaned) {
            emitProgress({ type: 'fetch:end', label: 'Open ports listed', detail: 'None found' });
            return { ports: [] };
          }

          let parsed = JSON.parse(cleaned);
          if (!Array.isArray(parsed)) {
            parsed = [parsed];
          }

          emitProgress({ type: 'fetch:end', label: 'Open ports listed', detail: `Found ${parsed.length} ports` });
          return { ports: parsed };
        } else {
          let ports: Array<{ localAddress: string; localPort: number; pid: number; processName: string }> = [];

          if (await commandExists('lsof')) {
            const { stdout } = await execFileAsync('lsof', ['-iTCP', '-sTCP:LISTEN', '-P', '-n'], { timeout: 10000 });
            const lines = stdout.trim().split('\n').slice(1);

            for (const line of lines) {
              const parts = line.split(/\s+/).filter(Boolean);
              if (parts.length >= 9) {
                const processName = parts[0] || 'Unknown';
                const pid = parseInt(parts[1] || '0', 10);
                const nameCol = parts[8] || '';
                const lastColon = nameCol.lastIndexOf(':');
                let localPort = 0;
                let localAddress = '*';

                if (lastColon !== -1) {
                  localAddress = nameCol.slice(0, lastColon);
                  localPort = parseInt(nameCol.slice(lastColon + 1), 10) || 0;
                }

                ports.push({ localAddress, localPort, pid, processName });
              }
            }
          } else if (await commandExists('netstat')) {
            const { stdout } = await execFileAsync('netstat', ['-lntp'], { timeout: 10000 });
            const lines = stdout.trim().split('\n').filter(l => l.includes('LISTEN'));

            for (const line of lines) {
              const parts = line.split(/\s+/).filter(Boolean);
              if (parts.length >= 6) {
                const localCol = parts[3] || '';
                const lastColon = localCol.lastIndexOf(':');
                const localPort = lastColon !== -1 ? parseInt(localCol.slice(lastColon + 1), 10) || 0 : 0;
                const localAddress = lastColon !== -1 ? localCol.slice(0, lastColon) : localCol;
                
                const pidCol = parts[6] || '';
                const [pidStr, processName] = pidCol.split('/');
                const pid = parseInt(pidStr || '0', 10);

                ports.push({
                  localAddress,
                  localPort,
                  pid,
                  processName: processName || 'Unknown',
                });
              }
            }
          }

          emitProgress({ type: 'fetch:end', label: 'Open ports listed', detail: `Found ${ports.length} ports` });
          return { ports };
        }
      } catch (error: any) {
        emitProgress({ type: 'tool:error', label: 'List open ports failed', detail: error.message });
        return { error: 'Failed to list open ports.', rawError: error.message };
      }
    },
  }),

  pingHost: tool({
    description: 'Send ICMP Echo requests to a host to check network latency and packet loss. Works on Windows, macOS, and Linux.',
    inputSchema: z.object({
      host: z.string().min(1).describe('The hostname or IP address to ping (e.g., "google.com", "8.8.8.8").'),
    }),
    execute: async ({ host }) => {
      emitProgress({ type: 'fetch:start', label: 'Pinging host', detail: host });

      try {
        const isWin = process.platform === 'win32';
        const cmd = 'ping';
        const args = isWin ? ['-n', '3', host] : ['-c', '3', host];

        const { stdout } = await execFileAsync(cmd, args, { windowsHide: true, timeout: 10000 });

        emitProgress({ type: 'fetch:end', label: 'Ping complete', detail: host });
        return {
          host,
          success: true,
          output: stdout.trim(),
        };
      } catch (error: any) {
        emitProgress({ type: 'tool:error', label: 'Ping failed', detail: error.message });
        return {
          host,
          success: false,
          error: `Ping to "${host}" failed or timed out.`,
          rawError: error.message,
        };
      }
    },
  }),

  traceRoute: tool({
    description: 'Trace the routing path packets take to reach a host. Works on Windows (tracert), macOS, and Linux (traceroute).',
    inputSchema: z.object({
      host: z.string().min(1).describe('The hostname or IP address to trace route to.'),
    }),
    execute: async ({ host }) => {
      emitProgress({ type: 'fetch:start', label: 'Tracing route', detail: host });

      try {
        const isWin = process.platform === 'win32';
        const cmd = isWin ? 'tracert' : 'traceroute';
        const args = isWin ? ['-h', '15', host] : ['-m', '15', host];

        const { stdout } = await execFileAsync(cmd, args, { windowsHide: true, timeout: 30000 });

        emitProgress({ type: 'fetch:end', label: 'Traceroute complete', detail: host });
        return {
          host,
          output: stdout.trim(),
        };
      } catch (error: any) {
        emitProgress({ type: 'tool:error', label: 'Traceroute failed', detail: error.message });
        return {
          host,
          error: `Traceroute to "${host}" failed or timed out.`,
          rawError: error.message,
        };
      }
    },
  }),

  getDatabaseSchema: tool({
    description: 'Inspect a SQLite database file and return its schema tables and definitions. Multi-OS with built-in SQLite CLI and Python fallbacks.',
    inputSchema: z.object({
      databasePath: z.string().min(1).describe('Relative or absolute path to the SQLite database file in the workspace.'),
    }),
    execute: async ({ databasePath }) => {
      emitProgress({ type: 'fetch:start', label: 'Querying DB schema', detail: databasePath });

      const root = resolveWorkspaceRoot();
      const resolvedPath = path.isAbsolute(databasePath) ? databasePath : path.join(root, databasePath);

      if (!existsSync(resolvedPath)) {
        emitProgress({ type: 'fetch:end', label: 'DB schema failed', detail: 'File not found' });
        return { error: `Database file not found at path: ${databasePath}` };
      }

      if (await commandExists('sqlite3')) {
        try {
          const { stdout } = await execFileAsync('sqlite3', [resolvedPath, '.schema'], { windowsHide: true, timeout: 10000 });
          emitProgress({ type: 'fetch:end', label: 'DB schema retrieved', detail: databasePath });
          return {
            databasePath,
            method: 'sqlite3-cli',
            schema: stdout.trim() || 'Database is empty (no tables found).',
          };
        } catch {}
      }

      const pythonCmd = await commandExists('python') ? 'python' : (await commandExists('python3') ? 'python3' : null);
      if (pythonCmd) {
        try {
          const script = `
import sqlite3, sys, json
try:
    conn = sqlite3.connect(sys.argv[1])
    cursor = conn.cursor()
    cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='table';")
    tables = [{'name': r[0], 'sql': r[1]} for r in cursor.fetchall() if r[1]]
    print(json.dumps({'success': True, 'tables': tables}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
          `;

          const { stdout } = await execFileAsync(pythonCmd, ['-c', script, resolvedPath], { windowsHide: true, timeout: 10000 });
          const parsed = JSON.parse(stdout.trim());
          if (parsed.success) {
            const schemaLines = parsed.tables.map((t: any) => `${t.sql};`).join('\n\n');
            emitProgress({ type: 'fetch:end', label: 'DB schema retrieved', detail: databasePath });
            return {
              databasePath,
              method: 'python-sqlite3',
              schema: schemaLines || 'Database is empty (no tables found).',
              tables: parsed.tables.map((t: any) => t.name),
            };
          }
        } catch {}
      }

      emitProgress({ type: 'tool:error', label: 'DB schema failed', detail: 'No SQLite readers found' });
      return {
        error: 'Failed to inspect database schema. Please install the `sqlite3` CLI utility or `python` on your system to enable inspection.',
      };
    },
  }),

  runDatabaseQuery: tool({
    description: 'Execute raw SQL queries against a local SQLite database in the workspace. Transaction-safe, with capped result limits. Works on Windows, macOS, and Linux.',
    inputSchema: z.object({
      databasePath: z.string().min(1).describe('Relative or absolute path to the SQLite database file in the workspace.'),
      sql: z.string().min(1).describe('The SQL query or statement to run (e.g., "SELECT * FROM users LIMIT 10").'),
    }),
    execute: async ({ databasePath, sql }) => {
      emitProgress({ type: 'tool:start', label: 'Executing DB query', detail: databasePath });

      const root = resolveWorkspaceRoot();
      const resolvedPath = path.isAbsolute(databasePath) ? databasePath : path.join(root, databasePath);

      if (!existsSync(resolvedPath)) {
        emitProgress({ type: 'tool:error', label: 'DB query failed', detail: 'File not found' });
        return { error: `Database file not found at path: ${databasePath}` };
      }

      let query = sql.trim();
      if (!query.endsWith(';')) {
        query += ';';
      }

      if (query.toUpperCase().startsWith('SELECT') && !query.toUpperCase().includes('LIMIT')) {
        query = query.slice(0, -1) + ' LIMIT 100;';
      }

      const pythonCmd = await commandExists('python') ? 'python' : (await commandExists('python3') ? 'python3' : null);
      if (pythonCmd) {
        try {
          const script = `
import sqlite3, sys, json
try:
    conn = sqlite3.connect(sys.argv[1])
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(sys.argv[2])
    
    if cursor.description:
        rows = cursor.fetchall()
        results = [dict(row) for row in rows]
        print(json.dumps({'success': True, 'type': 'query', 'results': results}))
    else:
        conn.commit()
        print(json.dumps({'success': True, 'type': 'execute', 'rows_affected': cursor.rowcount}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
          `;

          const { stdout } = await execFileAsync(pythonCmd, ['-c', script, resolvedPath, query], { windowsHide: true, timeout: 15000 });
          const parsed = JSON.parse(stdout.trim());
          if (parsed.success) {
            emitProgress({ type: 'tool:end', label: 'DB query successful', detail: parsed.type });
            return parsed;
          } else {
            emitProgress({ type: 'tool:error', label: 'DB query failed', detail: parsed.error });
            return { error: `SQL execution error: ${parsed.error}` };
          }
        } catch (err: any) {
          // Fall back
        }
      }

      if (await commandExists('sqlite3')) {
        try {
          const { stdout } = await execFileAsync('sqlite3', ['-header', '-json', resolvedPath, query], { windowsHide: true, timeout: 15000 });
          emitProgress({ type: 'tool:end', label: 'DB query successful (sqlite3)' });
          try {
            const results = JSON.parse(stdout.trim() || '[]');
            return { success: true, type: 'query', results };
          } catch {
            return {
              success: true,
              type: 'raw',
              output: stdout.trim() || 'Statement executed successfully (no results).',
            };
          }
        } catch (cliError: any) {
          emitProgress({ type: 'tool:error', label: 'DB query failed', detail: cliError.message });
          return { error: `SQL execution error: ${cliError.message}` };
        }
      }

      emitProgress({ type: 'tool:error', label: 'DB query failed', detail: 'No SQLite executors found' });
      return {
        error: 'Failed to execute query. Please install the `sqlite3` CLI utility or `python` on your system to enable SQLite operations.',
      };
    },
  }),

  listSystemProcesses: tool({
    description: 'List active system processes with PIDs, names, CPU, and Memory usage metrics. Works on Windows, macOS, and Linux.',
    inputSchema: z.object({
      sortBy: z.enum(['cpu', 'memory', 'pid']).optional().default('memory').describe('Metric to sort processes by.'),
      limit: z.number().int().min(1).max(500).optional().default(30).describe('Maximum number of processes to return.'),
      filterName: z.string().optional().describe('Filter processes by containing name (case-insensitive).'),
    }),
    execute: async ({ sortBy, limit, filterName }) => {
      emitProgress({ type: 'fetch:start', label: 'Listing system processes' });

      try {
        let processes: Array<{ pid: number; name: string; cpu: number; memory: number }> = [];

        if (process.platform === 'win32') {
          const script = `
            Get-Process -ErrorAction SilentlyContinue | ForEach-Object {
              [PSCustomObject]@{
                pid = $_.Id
                name = $_.ProcessName
                cpu = if ($_.CPU) { [Math]::Round($_.CPU, 1) } else { 0 }
                memory = [Math]::Round($_.WorkingSet64 / 1MB, 1)
              }
            } | ConvertTo-Json -Compress
          `;

          const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true, timeout: 10000 });
          const cleaned = stdout.trim();
          if (cleaned) {
            let parsed = JSON.parse(cleaned);
            if (!Array.isArray(parsed)) {
              parsed = [parsed];
            }
            processes = parsed.map((p: any) => ({
              pid: p.pid || 0,
              name: p.name || 'Unknown',
              cpu: p.cpu || 0,
              memory: p.memory || 0,
            }));
          }
        } else {
          const { stdout } = await execFileAsync('ps', ['-A', '-o', 'pid,pcpu,pmem,comm'], { timeout: 10000 });
          const lines = stdout.trim().split('\n').slice(1);

          for (const line of lines) {
            const parts = line.trim().split(/\s+/).filter(Boolean);
            if (parts.length >= 4) {
              const pid = parseInt(parts[0] || '0', 10);
              const cpu = parseFloat(parts[1] || '0');
              const memory = parseFloat(parts[2] || '0');
              const namePath = parts.slice(3).join(' ');
              const name = path.basename(namePath);
              processes.push({ pid, name, cpu, memory });
            }
          }
        }

        if (filterName) {
          const lowerFilter = filterName.toLowerCase();
          processes = processes.filter((p) => p.name.toLowerCase().includes(lowerFilter));
        }

        processes.sort((a, b) => {
          if (sortBy === 'cpu') return b.cpu - a.cpu;
          if (sortBy === 'memory') return b.memory - a.memory;
          return b.pid - a.pid;
        });

        const results = processes.slice(0, limit);

        emitProgress({ type: 'fetch:end', label: 'System processes listed', detail: `Returned ${results.length} process(es)` });
        return { processes: results };
      } catch (error: any) {
        emitProgress({ type: 'tool:error', label: 'List processes failed', detail: error.message });
        return { error: 'Failed to list system processes.', rawError: error.message };
      }
    },
  }),

  killSystemProcess: tool({
    description: 'Terminate a local system process by process ID (PID), process name, or net port attachment. Works on Windows, macOS, and Linux.',
    inputSchema: z.object({
      pid: z.number().int().min(1).optional().describe('The process ID to kill.'),
      name: z.string().optional().describe('The process name to kill (e.g. "node", "chrome"). Will kill all matching instances.'),
      port: z.number().int().min(1).max(65535).optional().describe('Kill whatever process is currently listening on this local port (e.g. 3000, 8080).'),
      force: z.boolean().optional().default(true).describe('If true, sends a SIGKILL or force taskkill.'),
    }),
    execute: async ({ pid, name, port, force }) => {
      if (!pid && !name && !port) {
        return { error: 'Either "pid", "name", or "port" must be provided to kill a process.' };
      }

      emitProgress({ type: 'tool:start', label: 'Killing system process', detail: pid ? `PID ${pid}` : name ? `name "${name}"` : `port :${port}` });

      try {
        const isWin = process.platform === 'win32';
        let targetPids: number[] = [];

        // If port is specified, scan for the listening PID(s)
        if (port) {
          emitProgress({ type: 'step', label: `Scanning process occupying port ${port}` });
          if (isWin) {
            const script = `
              Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
                $_.OwningProcess
              } | ConvertTo-Json -Compress
            `;
            const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true, timeout: 5000 });
            const cleaned = stdout.trim();
            if (cleaned) {
              const parsed = JSON.parse(cleaned);
              targetPids = Array.isArray(parsed) ? parsed.map(Number) : [Number(parsed)];
            }
          } else {
            if (await commandExists('lsof')) {
              const { stdout } = await execFileAsync('lsof', ['-t', '-i', `:${port}`], { timeout: 5000 });
              targetPids = stdout.trim().split(/\s+/).map(Number).filter(Boolean);
            } else if (await commandExists('netstat')) {
              const { stdout } = await execFileAsync('netstat', ['-lntp'], { timeout: 5000 });
              const lines = stdout.trim().split('\n');
              for (const line of lines) {
                if (line.includes(`:${port}`) && line.includes('LISTEN')) {
                  const parts = line.split(/\s+/).filter(Boolean);
                  const pidCol = parts[6] || '';
                  const pidVal = parseInt(pidCol.split('/')[0] || '0', 10);
                  if (pidVal) targetPids.push(pidVal);
                }
              }
            }
          }

          if (targetPids.length === 0) {
            emitProgress({ type: 'tool:error', label: 'Kill process failed', detail: `No process owns port ${port}` });
            return { success: false, error: `No process detected listening on port ${port}.` };
          }
          emitProgress({ type: 'step', label: `Resolved port ${port} to PID(s): ${targetPids.join(', ')}` });
        }

        // If we resolved PIDs from port or got one directly, kill them
        if (pid) {
          targetPids.push(pid);
        }

        if (targetPids.length > 0) {
          const uniquePids = [...new Set(targetPids)];
          for (const targetPid of uniquePids) {
            if (isWin) {
              const args = force ? ['/F', '/PID', String(targetPid)] : ['/PID', String(targetPid)];
              await execFileAsync('taskkill', args, { windowsHide: true, timeout: 5000 });
            } else {
              const args = force ? ['-9', String(targetPid)] : [String(targetPid)];
              await execFileAsync('kill', args, { timeout: 5000 });
            }
          }
          emitProgress({ type: 'tool:end', label: 'Process killed successfully', detail: `PID(s): ${uniquePids.join(', ')}` });
          return { success: true, killedPids: uniquePids };
        } else if (name) {
          if (isWin) {
            const exeName = name.toLowerCase().endsWith('.exe') ? name : `${name}.exe`;
            const args = force ? ['/F', '/IM', exeName] : ['/IM', exeName];
            await execFileAsync('taskkill', args, { windowsHide: true, timeout: 5000 });
          } else {
            if (await commandExists('pkill')) {
              const args = force ? ['-9', '-f', name] : ['-f', name];
              await execFileAsync('pkill', args, { timeout: 5000 });
            } else {
              const args = force ? ['-9', name] : [name];
              await execFileAsync('killall', args, { timeout: 5000 });
            }
          }
          emitProgress({ type: 'tool:end', label: 'Processes killed successfully', detail: name });
          return { success: true, name };
        }

        return { error: 'Invalid arguments' };
      } catch (error: any) {
        emitProgress({ type: 'tool:error', label: 'Kill process failed', detail: error.message });
        return {
          success: false,
          error: `Failed to terminate process.`,
          rawError: error.message,
        };
      }
    },
  }),

  getSystemMetrics: tool({
    description: 'Retrieve real-time telemetry metrics of the host machine (CPU usage, memory allocation, workspace disk space, and OS meta-data). Works on Windows, macOS, and Linux.',
    inputSchema: z.object({}),
    execute: async () => {
      emitProgress({ type: 'fetch:start', label: 'Collecting system metrics' });

      try {
        const platform = process.platform;
        const arch = os.arch();
        const release = os.release();
        const uptime = os.uptime();
        const osName = os.type();

        // 1. CPU Metrics
        emitProgress({ type: 'step', label: 'Sampling CPU utilization' });
        const cpuUsage = await sampleCpuUsage();

        // 2. Memory Metrics
        const totalMemGb = Math.round((os.totalmem() / (1024 * 1024 * 1024)) * 10) / 10;
        const freeMemGb = Math.round((os.freemem() / (1024 * 1024 * 1024)) * 10) / 10;
        const usedMemGb = Math.round((totalMemGb - freeMemGb) * 10) / 10;

        // 3. Disk Metrics for Workspace Root
        const wsRoot = resolveWorkspaceRoot();
        emitProgress({ type: 'step', label: 'Querying workspace disk allocation' });
        const disk = await getDiskSpace(wsRoot);

        const metrics = {
          os: {
            name: osName,
            platform,
            release,
            architecture: arch,
            uptimeSeconds: uptime,
            uptimeHours: Math.round((uptime / 3600) * 10) / 10,
          },
          cpu: {
            activeUtilizationPercent: cpuUsage,
            cores: os.cpus().length,
            model: os.cpus()[0]?.model || 'Unknown',
          },
          memory: {
            totalGb: totalMemGb,
            freeGb: freeMemGb,
            usedGb: usedMemGb,
            utilizationPercent: Math.round(((totalMemGb - freeMemGb) / totalMemGb) * 1000) / 10,
          },
          disk: {
            workspacePath: wsRoot,
            totalGb: disk.totalGb,
            freeGb: disk.freeGb,
            usedGb: disk.usedGb,
            utilizationPercent: disk.totalGb > 0 ? Math.round((disk.usedGb / disk.totalGb) * 1000) / 10 : 0,
          },
        };

        emitProgress({ type: 'fetch:end', label: 'System metrics collected' });
        return { success: true, metrics };
      } catch (error: any) {
        emitProgress({ type: 'tool:error', label: 'System metrics collection failed', detail: error.message });
        return { success: false, error: 'Failed to retrieve system metrics.', rawError: error.message };
      }
    },
  }),
};
