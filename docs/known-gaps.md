# Known Gaps & Needs Clarification

This file tracks uncertainties, missing features, and areas where documentation may not perfectly match the implementation.

## Implementation Uncertainties

-   **Testing Infrastructure**: While testing is mentioned, the specific test framework configuration (e.g., `jest.config.js`) was not found in the initial root scan.
-   **MCP Support**: MCP is mentioned in prompts but the implementation of custom MCP tool registration needs further inspection in `src/runtime/registry.ts`.
-   **Billing/Usage Limits**: There is a `usage.ts` in observability, but hard billing caps or multi-tenant quota management implementation details are sparse.

## Missing Documentation in Codebase

-   **Deployment Runbooks**: No specific `Dockerfile` or `terraform` files were found, making specific cloud deployment steps inferred from code patterns.
-   **OAuth Security**: The security of tokens stored by Composio is documented by the provider, but ZilMate's internal session security for `ZILMATE_USER_ID` is not fully detailed.

## Dead Code / TODOs

-   **ZiloDocs**: References to "ZiloShift" specific docs in `src/doc/` seem to be placeholders or playbooks for a specific internal product.
-   **Agent Limits**: `limits.managerSteps` and other safety caps are defined but the mechanism for the user to override them per-run is not yet implemented in the CLI flags.

## Mismatches

-   **Model List**: The `models.ts` file contains many models; the CLI `models` command summary may lag behind the actual environment variable overrides.
-   **Tool Schemas**: Some tools in `src/tools/` have complex schemas that may not be fully utilized by all agents in the specialist registry.
