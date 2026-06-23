import { type Tool } from 'ai';

export type ToolModule = Record<string, Tool<any, any>>;

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, Tool<any, any>> = new Map();

  private constructor() {}

  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  register(name: string, tool: Tool<any, any>) {
    this.tools.set(name, tool);
  }

  registerModule(module: ToolModule) {
    for (const [name, tool] of Object.entries(module)) {
      this.register(name, tool);
    }
  }

  getTool(name: string): Tool<any, any> | undefined {
    return this.tools.get(name);
  }

  getAllTools(): Record<string, Tool<any, any>> {
    const result: Record<string, Tool<any, any>> = {};
    for (const [name, tool] of this.tools.entries()) {
      result[name] = tool;
    }
    return result;
  }

  getToolsByGroup(prefix: string): Record<string, Tool<any, any>> {
    const result: Record<string, Tool<any, any>> = {};
    for (const [name, tool] of this.tools.entries()) {
      if (name.startsWith(prefix)) {
        result[name] = tool;
      }
    }
    return result;
  }
}
