# Agents

ZilMate utilizes a hierarchical agent system ranging from a central orchestrator to highly specialized business units.

## The Manager Agent (CEO)

-   **Source**: `src/agents/manager.ts`
-   **Purpose**: The primary interface for the user. It handles general requests, decomposes complex tasks, and delegates to specialized subagents or the Digital Corporation swarm.
-   **Capabilities**: Full access to all internal tools and subagent tools.
-   **Trigger**: CLI `talk`, `manager` commands, or SDK `manager()` calls.

## Digital Corporation (COO)

-   **Source**: `src/agents/swarm/main.ts`
-   **Purpose**: Acts as the operations manager for the swarm. It routes business objectives to the correct department.
-   **Delegation Logic**: Uses the `SwarmOrchestrator` (`src/runtime/swarm.ts`) to classify tasks into Strategy, Engineering, Growth, Revenue, Operations, Security, or Data.

## Departmental Specialists

Defined in `src/agents/swarm/registry.ts`, these agents are designed for specific business roles.

### Engineering Department
-   **Architect**: System design and tech stack decisions.
-   **Full Stack Coder**: Implements features and fixes bugs.
-   **QA Engineer**: Writes tests and performs audits.
-   **DevOps SRE**: Infrastructure and deployment automation.

### Growth Department
-   **Growth Hacker**: Funnel optimization and A/B testing.
-   **SEO Expert**: Technical SEO and keyword strategy.
-   **Content Writer**: Blog posts, newsletters, and social copy.
-   **Social Media Manager**: Community engagement and distribution.
-   **Ads Manager**: Paid growth and ROAS tracking.

### Operations Department
-   **Finance Analyst**: MRR tracking, P&L reporting, and financial briefs.
-   **Customer Success**: Support ticket resolution and retention.
-   **Legal Counsel**: Compliance, risk assessment, and contract audits.
-   **Logistics Lead**: Supply chain and fulfillment optimization.
-   **HR Recruiter**: Talent sourcing and agent performance audits.

### Data Department
-   **Data Scientist**: SQL analysis and predictive modeling.
-   **BI Reporter**: Executive dashboards and status synthesis.

### Other Specialized Agents
-   **Quick Help**: Fast troubleshooting and ZiloShift app guidance (`src/agents/quick-help.agent.ts`).
-   **Security Agent**: OSINT and penetration testing (`src/agents/security.agent.ts`).
-   **Automation Planner**: Workflow design and background job scheduling (`src/agents/automation-planner.agent.ts`).
-   **Coding Agent**: Git-aware software engineering loop (`src/agents/coding.agent.ts`).

## Agent Configuration

Each swarm agent is configured with:
-   **Instructions**: Role-specific SOPs and KPIs.
-   **Tools**: A subset of internal tools relevant to the role.
-   **Composio Toolkits**: Access to specific external apps (e.g., `stripe`, `github`, `hubspot`).

## Reporting

Swarm agents use the `updateStatusReport` tool to document their progress in the `swarm-reports/` directory within the workspace.
