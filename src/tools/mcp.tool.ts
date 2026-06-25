import { createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import { type Tool, tool } from 'ai';
import { z } from 'zod';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { workspaceLayout } from '../workspace/paths.js';
import { emitProgress } from '../runtime/progress.js';

export type MCPServerConfig = {
  name: string;
  type: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  enabled: boolean;
};

export type MCPConfig = {
  servers: MCPServerConfig[];
};

const activeClients: Map<string, any> = new Map();

async function loadMCPConfig(): Promise<MCPConfig> {
  const layout = workspaceLayout();
  if (!existsSync(layout.mcpConfig)) {
    return { servers: [] };
  }
  try {
    const raw = await readFile(layout.mcpConfig, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    emitProgress({ type: 'tool:error', label: 'MCP config load failed', detail: String(error) });
    return { servers: [] };
  }
}

async function saveMCPConfig(config: MCPConfig) {
  const layout = workspaceLayout();
  const dir = path.dirname(layout.mcpConfig);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(layout.mcpConfig, JSON.stringify(config, null, 2));
}

export async function createMCPTools(): Promise<Record<string, Tool<any, any>>> {
  const config = await loadMCPConfig();
  const allTools: Record<string, Tool<any, any>> = {};

  for (const server of config.servers) {
    if (!server.enabled) continue;

    try {
      emitProgress({ type: 'tool:start', label: `Initializing MCP server: ${server.name}` });

      let client;
      if (server.type === 'stdio') {
        const transport = new Experimental_StdioMCPTransport({
          command: server.command!,
          args: server.args || [],
          env: { ...process.env, ...server.env } as Record<string, string>,
        });
        client = await createMCPClient({ transport });
      } else if (server.type === 'http' || server.type === 'sse') {
        client = await createMCPClient({
          transport: {
            type: server.type,
            url: server.url!,
            headers: server.headers as Record<string, string> | undefined,
          }
        } as any);
      }

      if (client) {
        activeClients.set(server.name, client);
        const serverTools = await client.tools();
        Object.assign(allTools, serverTools);
        emitProgress({ type: 'tool:end', label: `MCP server ready: ${server.name}`, detail: `${Object.keys(serverTools).length} tools loaded` });
      }
    } catch (error) {
      emitProgress({ type: 'tool:error', label: `MCP server failed: ${server.name}`, detail: String(error) });
    }
  }

  return allTools;
}

export async function closeMCPClients() {
  for (const [name, client] of activeClients.entries()) {
    try {
      await client.close();
    } catch (error) {
      console.error(`Failed to close MCP client ${name}:`, error);
    }
  }
  activeClients.clear();
}

export const mcpManagementTools = {
  addMCPServer: tool({
    description: 'Add a new MCP server configuration. Supported types: stdio, http, sse.',
    inputSchema: z.object({
      name: z.string().describe('Unique name for the server'),
      type: z.enum(['stdio', 'http', 'sse']),
      command: z.string().optional().describe('Command to run (for stdio)'),
      args: z.array(z.string()).optional().describe('Arguments for the command (for stdio)'),
      env: z.record(z.string(), z.string()).optional().describe('Environment variables (for stdio)'),
      url: z.string().optional().describe('URL for the server (for http/sse)'),
      headers: z.record(z.string(), z.string()).optional().describe('HTTP headers (for http/sse)'),
    }),
    execute: async (params) => {
      const config = await loadMCPConfig();
      if (config.servers.some(s => s.name === params.name)) {
        return { error: `Server with name "${params.name}" already exists.` };
      }
      const newServer: MCPServerConfig = { ...params, enabled: true } as any;
      config.servers.push(newServer);
      await saveMCPConfig(config);
      return { status: `MCP server "${params.name}" added successfully. You may need to restart the agent to use it.` };
    }
  }),
  listMCPServers: tool({
    description: 'List all configured MCP servers and their status.',
    inputSchema: z.object({}),
    execute: async () => {
      const config = await loadMCPConfig();
      return {
        servers: config.servers.map(s => ({
          name: s.name,
          type: s.type,
          enabled: s.enabled,
          active: activeClients.has(s.name)
        }))
      };
    }
  }),
  removeMCPServer: tool({
    description: 'Remove an MCP server configuration.',
    inputSchema: z.object({
      name: z.string().describe('Name of the server to remove'),
    }),
    execute: async ({ name }) => {
      const config = await loadMCPConfig();
      const initialLength = config.servers.length;
      config.servers = config.servers.filter(s => s.name !== name);
      if (config.servers.length === initialLength) {
        return { error: `Server "${name}" not found.` };
      }
      await saveMCPConfig(config);
      if (activeClients.has(name)) {
        try {
          await activeClients.get(name).close();
          activeClients.delete(name);
        } catch {}
      }
      return { status: `MCP server "${name}" removed.` };
    }
  })
};
