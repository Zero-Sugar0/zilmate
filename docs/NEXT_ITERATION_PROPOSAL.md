# ZilMate Next Iteration Proposal (v2.0 Refactor)

This document outlines the strategic and technical roadmap for the next evolution of ZilMate, addressing clarity on configuration, infrastructure, UX, and swarm governance.

## 1. Declarative Configuration Layer
**Proposal:** Introduce `agents.yaml` and `workflows.yaml`.

*   **Rationale:** Currently, agent registries and tool mappings are hardcoded in TypeScript. Moving these to YAML allows for:
    *   **Hot-Reloading:** Adjusting agent behavior or tool permissions without re-compiling.
    *   **Clarity:** A single source of truth for the Swarm hierarchy and department mappings.
    *   **Sub-agent Mappings:** Defining which specialists belong to which Head in a structured format.
*   **Implementation:** Create a `ConfigLoader` in `src/config/` that parses these files and populates the `specialistRegistry`.

## 2. Infrastructure & CI/CD
**Proposal:** Add GitHub Actions, Devcontainer, and Layered Config.

*   **CI/CD:** Add `.github/workflows/ci.yml` to run linting, build verification, and automated tests (e.g., verifying the `doctor` diagnostics pass).
*   **Devcontainer:** Add `.devcontainer/devcontainer.json` to standardize the development environment, ensuring all dependencies (Node 20+, Playwright, FFmpeg) are pre-installed.
*   **Layered Config:** Support `.env`, `config.yaml`, and CLI flags in a prioritized hierarchy.

## 3. Modular System Architecture
**Proposal:** Move towards a "Core + Plugin" model and unify agent registries.

*   **Namespaced Tools:** Group tools into functional plugins (e.g., `@zilmate/plugin-finance`).
*   **Department Interfaces:** Formalize the `SwarmDepartment` as a module that exports its own Head and Specialists, reducing the bloat in the main registry.
*   **Unified Agents:** Consolidate standalone agents (e.g., `src/agents/finance.agent.ts`) with Swarm specialists to ensure consistent behavior and tool access across the entire system.

## 4. UX & Observability Enhancements
**Proposal:** Richer step display and structured plan visualization.

*   **Plan View:** Before execution, the Manager/COO should output a structured JSON plan. The Web CLI and Terminal should render this as a "Checklist" that updates in real-time.
*   **Gantt 2.0:** Improve the trace dashboard to show "Delegation Trees" clearly, showing how a task flowed from CEO -> COO -> Department Head -> Specialist.
*   **Progress Heartbeats:** Emit regular status updates (e.g., "Engineering Head is reviewing Coder's output") to avoid "dead air" during long-running tasks.

## 5. Loop Prevention & Governance
**Proposal:** Enforce delegation depth and session timeouts.

*   **Delegation Depth:** Add a `depth` counter to the `SwarmAgent.run()` method. If `depth > 3`, force an escalation back to the user or Manager.
*   **Session TTL:** Implement a maximum execution time for any single user request to prevent runaway token usage.
*   **Turn Limits:** Explicitly track "loops" (e.g., the same tool called with the same arguments twice) and trigger a "Self-Heal" or "Halt" state.

## 6. Reliable E2E Execution
**Proposal:** Checkpoints and State Recovery.

*   **Persistent Task State:** Save the state of a workflow to disk after every successful sub-task. If a later step fails, the swarm can "resume" from the last valid checkpoint.
*   **Validation Steps:** Every delegation should end with a "Review" step by the delegator (e.g., the CTO reviews the Coder's work before returning to the COO).

## 7. Strict Tool Boundaries (Privilege Isolation)
**Proposal:** Implement Role-Based Access Control (RBAC) for Tools.

*   **Isolation:** The Manager (CEO) should *not* have direct access to `financeTools` or `pentestTools`. It must delegate to the appropriate Agent.
*   **Trust Tokens:** Introduce a "Trust Handshake". When the Manager delegates to Finance, it passes a scoped permission token that allows the Finance Agent to use specific tools for that session.

## 8. Finance Department Expansion
**Proposal:** Split Finance into specialized sub-agents under the Finance Head.

*   **Current State:** A single `FinanceAgent` or `financeAnalyst` handles everything.
*   **Target State:**
    *   **Finance Head (CFO):** Strategy, delegation, and final approval of financial reports.
    *   **Treasury Specialist:** Managing virtual cards, ledger balances, and Stripe integration.
    *   **Accounting Specialist:** Tracking token costs, ROI analysis, and budget auditing.
    *   **Compliance Specialist:** Auditing transactions against business rules and regulatory requirements.

---

## Prioritized Roadmap

1.  **Phase 1 (Foundation):** GitHub Actions, Devcontainer, and YAML-based Registry.
2.  **Phase 2 (Security):** Tool boundary enforcement (RBAC) and Delegation Depth limits.
3.  **Phase 3 (UX):** Structured Plan visualization and improved Telemetry.
4.  **Phase 4 (Expansion):** Modular Finance sub-agents and Departmental refactor.
