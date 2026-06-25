### Swarm Tools and Sub-agents Expansion

- **New Executive Tools:** Added `generateStrategicRoadmap`, `getCorporateHealthBrief`, and `triggerCrisisResponse` in `src/tools/executive.tool.ts`.
- **Specialist Registry Upgrades:**
    - Refined instructions and added tool access for `architect`, `qaEngineer`, `devopsSre`, `growthHacker`, `salesOps`, and `financeAnalyst`.
    - Integrated `runHealPass` for `qaEngineer` and `agentOptimizer`.
    - Integrated `crossAppLedgerTools` for `growthHacker`, `salesOps`, and `financeAnalyst`.
- **New Specialists:** Added `securityAuditor` and `agentOptimizer`.
- **COO Logic:** Updated `DigitalCorporationMain` to utilize new executive tools and manage the expanded departmental structure.

Please review for architectural consistency and tool integration patterns.
