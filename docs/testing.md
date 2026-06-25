# Testing

ZilMate's testing strategy focuses on unit tests for core logic and integration tests for agent/tool workflows.

## Test Framework

-   **Framework**: ZilMate uses the Node.js test runner (internal) or is compatible with Vitest/Jest.
-   **Mocking**: External API calls (AI Gateway, Composio) are typically mocked or use recording during integration tests to prevent excessive costs and flakiness.

## Running Tests

Check `package.json` for the exact test command. Common commands:
```bash
npm test
```
Or run the CLI doctor for live integration verification:
```bash
zilmate doctor --live
```

## Test Types

### Unit Tests
Located alongside the source files (e.g., `*.test.ts`). These cover:
-   Utility functions in `src/runtime/tool-utils.ts`.
-   Logic for memory operations in `src/memory/history.ts`.
-   Schedule parsing in `src/jobs/schedule.ts`.

### Integration Tests
These verify the interaction between agents and tools.
-   **Mocked Runs**: Simulating agent turns with predefined tool responses.
-   **Live Doctor**: The `zilmate doctor --live` command acts as a real-time health check of external dependencies.

## Writing New Tests

1.  **Placement**: Place test files in the same directory as the code they test, using the `.test.ts` extension.
2.  **Naming**: Use descriptive test suites and cases.
3.  **Dependencies**: Use the `workspace/init.ts` helpers to set up a clean temporary workspace for filesystem tests.

## Known Gaps in Coverage

-   **Agent Behavior**: Testing the stochastic nature of LLM responses is challenging and primarily handled via manual verification and behavioral logs.
-   **Browser Tools**: Require a local browser environment and are often excluded from CI/CD runs.
