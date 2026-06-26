import { createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import { tool } from 'ai';
import { z } from 'zod';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import { workspaceLayout } from '../workspace/paths.js';
import { emitProgress } from '../runtime/progress.js';
import { env } from '../config/env.js';

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

const activeClients: Map<string, { client: any; tools: Record<string, any> }> = new Map();

function getDefaultMCPServers(): MCPServerConfig[] {
  const layout = workspaceLayout();
  const home = homedir();

  return [
    {
      name: 'sequential-thinking',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
      enabled: true
    },
    {
      name: 'memory',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
      enabled: true
    },
    {
      name: 'filesystem',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', layout.root, home],
      enabled: true
    },
    {
      name: 'git',
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'git-mcp-server'],
      enabled: true
    },
    {
      name: 'fetch',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch'],
      enabled: false // Disabled by default until we find a stable npm package
    },
    {
      name: 'playwright',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@playwright/mcp'],
      enabled: true
    },
    {
      name: 'brave-search',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@brave/brave-search-mcp-server'],
      env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY || '' },
      enabled: Boolean(process.env.BRAVE_API_KEY)
    },
    {
      name: 'wolfram-alpha',
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'wolfram-mcp'],
      env: { WOLFRAM_ALPHA_APP_ID: process.env.WOLFRAM_ALPHA_APP_ID || '' },
      enabled: Boolean(process.env.WOLFRAM_ALPHA_APP_ID)
    },
    {
      name: 'sqlite',
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'mcp-server-sqlite', path.join(layout.data, 'mcp.db')],
      enabled: true
    },
    {
      name: 'postgres',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@henkey/postgres-mcp-server'],
      env: { DATABASE_URL: process.env.DATABASE_URL || '' },
      enabled: Boolean(process.env.DATABASE_URL)
    },
    {
      name: 'docker',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@thelord/mcp-server-docker-npx'],
      enabled: true
    },
    {
      name: 'kubernetes',
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'mcp-server-kubernetes'],
      enabled: true
    },
    {
      name: 'obsidian',
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'obsidian-mcp-server'],
      enabled: true
    }
  ];
}

async function loadMCPConfig(): Promise<MCPConfig> {
  const layout = workspaceLayout();
  let config: MCPConfig = { servers: [] };

  if (existsSync(layout.mcpConfig)) {
    try {
      const raw = await readFile(layout.mcpConfig, 'utf8');
      config = JSON.parse(raw);
    } catch (error) {
      emitProgress({ type: 'tool:error', label: 'MCP config load failed', detail: String(error) });
    }
  }

  // Merge with defaults
  const defaults = getDefaultMCPServers();
  for (const def of defaults) {
    if (!config.servers.some(s => s.name === def.name)) {
      config.servers.push(def);
    }
  }

  return config;
}

async function saveMCPConfig(config: MCPConfig) {
  const layout = workspaceLayout();
  const dir = path.dirname(layout.mcpConfig);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(layout.mcpConfig, JSON.stringify(config, null, 2));
}

export async function createMCPTools(): Promise<Record<string, any>> {
  const config = await loadMCPConfig();
  const allTools: Record<string, any> = {};

  for (const server of config.servers) {
    if (!server.enabled) continue;

    // Reuse existing client and tools if already active
    if (activeClients.has(server.name)) {
      Object.assign(allTools, activeClients.get(server.name)!.tools);
      continue;
    }

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
        const serverTools = await client.tools();
        activeClients.set(server.name, { client, tools: serverTools });
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
  for (const [name, entry] of activeClients.entries()) {
    try {
      await entry.client.close();
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
      return { status: `MCP server "${params.name}" added successfully. Use /mcp restart or restart the chat to activate.` };
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
          await activeClients.get(name)!.client.close();
          activeClients.delete(name);
        } catch {}
      }
      return { status: `MCP server "${name}" removed.` };
    }
  })
};
