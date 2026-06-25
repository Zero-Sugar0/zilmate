# ZilMate Documentation

Welcome to the ZilMate documentation hub. ZilMate is a powerful agentic system designed for ZiloShift operational workflows, featuring a hierarchical swarm architecture, background job processing, and extensive tool integrations.

## Contents

- [Architecture](architecture.md) - Deep dive into the system design and components.
- [Getting Started](getting-started.md) - How to set up and run ZilMate locally.
- [Repository Map](repository-map.md) - Guide to the codebase structure.
- [Agents](agents.md) - Documentation of all agents and specialized subagents.
- [Orchestration](orchestration.md) - How tasks are planned and executed.
- [Tools](tools.md) - Internal tool system and available capabilities.
- [Integrations](integrations.md) - External services and APIs (Composio, Tavily, etc.).
- [API Reference](api.md) - SDK and CLI interface documentation.
- [Authentication](auth.md) - Security and auth flows.
- [Data Model](data-model.md) - Persistence and schemas.
- [Workflows](workflows.md) - End-to-end business and technical flows.
- [Execution Lifecycle](execution-lifecycle.md) - The lifecycle of a run or job.
- [Configuration & Environment](config-and-env.md) - Environment variables and settings.
- [Deployment](deployment.md) - How to deploy ZilMate.
- [Observability & Debugging](observability-and-debugging.md) - Monitoring and troubleshooting.
- [Testing](testing.md) - Testing strategy and how to run tests.
- [Examples](examples.md) - Real-world code snippets and usage patterns.
- [Glossary](glossary.md) - Project-specific terminology.
- [Known Gaps](known-gaps.md) - Uncertainties and areas for improvement.

## Quick Start Summary

ZilMate uses a **Manager Agent** (CEO) that delegates to a **Digital Corporation** (COO), which in turn orchestrates **7 Departmental Heads** and **30+ Specialists**. This hierarchical structure allows for complex business task execution with high precision.

For developers, the system is primarily interacted with via the CLI (`zilmate`) or the SDK (`src/server.ts`).

Related Documentation:
- [Chat Integration](CHAT_INTEGRATION.md)
