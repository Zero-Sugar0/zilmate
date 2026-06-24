import { type Tool, ToolLoopAgent, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import { models } from '../config/models.js';
import { limits } from '../safety/limits.js';
import { ReportGenerator } from './swarm/reports.js';
import { createComposioTools } from '../tools/composio.tool.js';
import { getControlState } from '../tools/swarm-ops.tool.js';

export type SwarmDepartment = 'Strategy' | 'Engineering' | 'Growth' | 'Revenue' | 'Operations' | 'Security' | 'Data';

export interface SwarmAgentConfig {
  name: string;
  department: SwarmDepartment;
  instructions: string;
  tools: Record<string, Tool<any, any>>;
  composioToolkits?: string[]; // Optional specific toolkits for this agent
  projectPath?: string; // Scoped working directory for this agent's task
}

export class SwarmAgent {
  private agent: ToolLoopAgent<any, any, any> | null = null;
  private reportGenerator = ReportGenerator.getInstance();

  constructor(private config: SwarmAgentConfig) {}

  async init(sessionId: string = 'default') {
    const composioTools = await createComposioTools(sessionId);

    // Memory Namespacing: Every department has its own scoped runId
    const deptRunId = `${sessionId}:${this.config.department.toLowerCase()}`;

    this.agent = new ToolLoopAgent({
      model: models.chat,
      instructions: [
        `You are ${this.config.name}, in the ${this.config.department} department.`,
        `SESSION CONTEXT: Your current departmental session is "${deptRunId}".`,
        this.config.projectPath ? `PROJECT FOLDER: You are assigned to work within "${this.config.projectPath}". Always create project assets here.` : '',
        this.config.instructions,
        `You have access to a vast array of external tools via Composio. Use them for real-world tasks.`,
        `MEMORY ISOLATION: Your scratchpad and notebooks are scoped to the ${this.config.department} department. You cannot see raw data from other departments unless it is shared by the COO.`,
        `When you complete a significant task or plan, use the updateStatusReport tool to document your work.`,
      ].filter(Boolean).join('\n'),
      tools: {
        ...this.config.tools,
        ...composioTools,
        updateStatusReport: tool({
          description: 'Update your departmental status report (.md file).',
          inputSchema: z.object({
            status: z.enum(['doing', 'done', 'planning']),
            content: z.string().min(10).describe('Detailed Markdown content of your progress or findings.'),
          }),
          execute: async ({ status, content }) => {
            const filePath = await this.reportGenerator.saveReport(this.config.name, content, status);
            return { status: 'Report updated', filePath };
          },
        }),
      },
      stopWhen: stepCountIs(limits.subagentSteps),
    });
  }

  async run(prompt: string, abortSignal?: AbortSignal, sessionId: string = 'default') {
    // Check Operational Control State (Pause/Resume)
    const deptRunId = `${sessionId}:${this.config.department.toLowerCase()}`;
    const controlState = await getControlState(deptRunId);

    if (controlState === 'PAUSED') {
      return `[SUSPENDED] The ${this.config.department} department is currently PAUSED. Please resume it using the resumeDepartment tool before proceeding.`;
    }

    if (!this.agent) {
      await this.init(sessionId);
    }
    const result = await this.agent!.generate({
      prompt,
      ...(abortSignal ? { abortSignal } : {})
    } as any);
    return result.text;
  }
}

export type SwarmMessage = {
  from: string;
  to: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  metadata?: any;
};

export class SwarmOrchestrator {
  private static instance: SwarmOrchestrator;
  private departments: Map<string, string[]> = new Map([
    ['strategy', ['strategyHead', 'productManager', 'marketAnalyst', 'uxResearcher']],
    ['engineering', ['ctoEngineering', 'architect', 'fullStackCoder', 'qaEngineer', 'devopsSre', 'creativeDirector']],
    ['growth', ['cmoGrowth', 'growthHacker', 'seoExpert', 'contentWriter', 'socialMediaManager', 'adsManager']],
    ['revenue', ['croRevenue', 'enterpriseSales', 'channelManager', 'affiliateManager', 'contractAnalyst', 'revOps']],
    ['operations', ['opsHead', 'financeAnalyst', 'customerSuccess', 'legalCounsel', 'logisticsLead', 'hrRecruiter']],
    ['security', ['cisoSecurity', 'redTeam', 'blueTeam', 'complianceOfficer', 'iamArchitect', 'incidentResponse']],
    ['data', ['cdoData', 'dataScientist', 'biReporter']],
  ]);

  private constructor() {}

  static getInstance(): SwarmOrchestrator {
    if (!SwarmOrchestrator.instance) {
      SwarmOrchestrator.instance = new SwarmOrchestrator();
    }
    return SwarmOrchestrator.instance;
  }

  async classifyTask(task: string): Promise<{ department: string; subagent: string; reasoning: string }> {
    const { generateObject } = await import('ai');
    const { object } = await generateObject({
      model: models.manager,
      schema: z.object({
        department: z.enum(['strategy', 'engineering', 'growth', 'revenue', 'operations', 'security', 'data', 'general']),
        subagent: z.string(),
        reasoning: z.string(),
      }),
      prompt: `Analyze this business task and assign it to the most relevant department Head or specialist:
      Task: ${task}

      Available Departments: ${Array.from(this.departments.keys()).join(', ')}
      Available Subagents: ${Array.from(this.departments.values()).flat().join(', ')}

      HINT: Favor Department Heads (strategyHead, ctoEngineering, cmoGrowth, croRevenue, opsHead, cisoSecurity, cdoData) for broad or complex goals.`,
    });

    return object as any;
  }

  formatAgentRequest(message: SwarmMessage): string {
    return `[Swarm Message] From: ${message.from} | Priority: ${message.priority}\n\nTask: ${message.content}`;
  }
}
