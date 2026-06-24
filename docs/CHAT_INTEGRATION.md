# ZilMate Chat Integration Guide

This document outlines how to integrate ZilMate into third-party chat platforms like Slack, Telegram, Microsoft Teams, and iMessage, enabling both reactive (responding to mentions) and proactive (reporting events) capabilities.

## 1. Professional Setup & Diagnostics

As the project owner, I've integrated Chat as a first-class citizen in the ZilMate lifecycle. You don't need to manually hack config files; the CLI handles it for you.

### Interactive Setup
Run the main setup and look for the **Chat Channels** section:
```bash
zilmate setup
```
Or configure chat specifically:
```bash
zilmate setup chat
```

You will be prompted for:
*   **SLACK_BOT_TOKEN** / **SLACK_SIGNING_SECRET**
*   **TELEGRAM_BOT_TOKEN**

### Health Checks
Verify your chat configuration at any time with:
```bash
zilmate doctor
```
The doctor will report which channels are active and if any tokens are missing.

## 2. Unified Integration with @vercel/chat (Chat SDK)

ZilMate's server SDK is designed to plug directly into the [Chat SDK](https://github.com/vercel/chat) ecosystem. This provides a single interface for multiple adapters.

### Installation
```bash
npm install chat @chat-adapter/slack @chat-adapter/telegram
```

### Implementation Example
Use the `handleChatMessage` bridge (`src/runtime/chat-bridge.ts`) to connect ZilMate's Manager to your chat adapters.

```typescript
import { Chat } from "chat";
import { createSlackAdapter } from "@chat-adapter/slack";
import { handleChatMessage } from "./runtime/chat-bridge.js";

const bot = new Chat({
  adapters: {
    slack: createSlackAdapter(),
  },
});

bot.onNewMention(async (thread, message) => {
  await handleChatMessage({
    text: message.text,
    authorId: message.author.id,
    platform: 'slack',
    onReply: (text) => thread.post(text),
    onStep: (label) => thread.post(`_Thinking: ${label}_`)
  });
});
```

## 3. Proactive Reporting (The "Powerful" Part)

ZilMate can act autonomously by reporting business events back to your chat channels.

### A. Event Triggers (via Composio)
ZilMate's `orchestrateComposioTrigger` (`src/jobs/trigger-orchestrator.ts`) allows the agent to wake up when external apps (Stripe, HubSpot, GitHub) fire events.

### B. Scheduled Briefings (via QStash)
Use ZilMate's background jobs to schedule tasks that report to you.
```typescript
const job = await zilmate.createJob({
  task: "Research the top 3 trending AI tools today and send a summary to my Telegram.",
  schedule: "0 9 * * *" // Daily at 9 AM
});
```

## 4. Supported Platforms & Adapters

| Platform | Adapter Package | Notes |
|----------|-----------------|-------|
| **Slack** | `@chat-adapter/slack` | Supports Socket Mode and Webhooks. |
| **Telegram**| `@chat-adapter/telegram`| Uses the Telegram Bot API. |
| **MS Teams**| `@chat-adapter/teams` | Requires Azure Bot Service. |
| **iMessage**| `chat-adapter-imessage`| Can run locally on macOS or via bridge. |
| **Discord** | `@chat-adapter/discord`| Ideal for community management. |

## 5. CLI Usage (The "Terminal" Way)

If you prefer using ZilMate directly in the terminal, it offers parity with the SDK features.

### Interactive Mode
To start a long-running, conversational session where the agent remembers the context:
```bash
# Uses the 'default' session
zilmate talk

# Uses a specific named session
zilmate talk --session my-project-research
```

### One-Shot Commands
For quick questions or tasks without entering an interactive shell:
```bash
# Conversational guide
zilmate chat "How do I process a refund in ZiloShift?"

# Full manager orchestration (for complex tasks)
zilmate manager "Research the current repo and suggest a refactor for the auth logic."
```

### Shared State
ZilMate CLI and SDK share the same workspace. If you run a task in the SDK with `sessionId: "alpha"`, you can resume it in the terminal using:
```bash
zilmate talk --session alpha
```
