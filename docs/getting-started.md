# Getting Started

Follow these steps to set up and run ZilMate in your local environment.

## Prerequisites

-   **Node.js**: Version 18 or higher.
-   **npm**: For dependency management.
-   **ffmpeg** (Optional): Required for camera and voice features.
-   **Playwright** (Optional): Required for browser automation. Run `npx playwright install chromium`.
-   **rembg** (Optional): Required for image background removal. Run `pip install rembg`.

## Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd zilo-manager
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Build the project:
    ```bash
    npm run build
    ```

## Configuration

1.  Run the interactive setup:
    ```bash
    ./index.js setup
    ```
    This will help you configure your AI Gateway key and other optional integrations.

2.  Alternatively, copy `.env.example` to `.env` and fill in the required keys:
    -   `AI_GATEWAY_API_KEY`
    -   `TAVILY_API_KEY` (Optional, for web research)
    -   `COMPOSIO_API_KEY` (Optional, for external apps)

## Common Commands

-   **Start Interactive Chat**: `./index.js talk`
-   **Run a Task via Manager**: `./index.js manager "task description"`
-   **Start Swarm Task**: `./index.js swarm "business goal"`
-   **Check System Health**: `./index.js doctor`
-   **Run Background Jobs**: `./index.js jobs worker`

## Running Tests

Documentation on testing is available in [testing.md](testing.md). To run the standard test suite:
```bash
npm test
```

## Verification

After setup, run the doctor command to verify your environment is ready:
```bash
./index.js doctor
```
Ensure that the AI Gateway and other critical services are marked as **OK**.
