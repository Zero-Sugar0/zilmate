# Examples

Practical code snippets and CLI usage patterns for ZilMate.

## CLI Examples

### Research and Summarize
```bash
zilmate research "Explain the current market trends for AI agents in 2024"
```

### Background Market Analysis
```bash
zilmate jobs create "Monitor competitor pricing for ZiloShift competitors and save to a spreadsheet" --schedule daily
```

### Swarm Product Design
```bash
zilmate swarm "Plan a new feature for the ZiloShift app that allows users to pay via WhatsApp. Involve the Architect, Coder, and QA Engineer."
```

### Screen Analysis
```bash
zilmate talk
> Look at my screen and tell me why this React component is failing.
```

## SDK Examples

### Initializing and Running a Task
```ts
import { createZilMate } from 'zilmate/server';

const zilmate = createZilMate({
  sessionId: 'user-123',
  onProgress: (event) => console.log(`[${event.type}] ${event.label}`)
});

const response = await zilmate.manager({
  prompt: "Create a project summary for 'Project Alpha' in Notion"
});

console.log(response.text);
```

### Creating a Recurring Job
```ts
const job = await zilmate.createJob({
  task: "Generate a weekly financial report",
  schedule: "cron:0 9 * * 1", // Every Monday at 9 AM
  maxAttempts: 5
});

console.log(`Job created with ID: ${job.id}`);
```

### Custom Confirmation Handler
```ts
const zilmate = createZilMate({
  confirm: async (req) => {
    console.log(`Approval requested for: ${req.label}`);
    // Logic to send approval to Slack or UI
    return { ok: true };
  }
});
```

## Integration Recipes

### Adding a New Specialist to the Swarm
To add a "Growth Analyst" to the Growth department:
1.  Open `src/agents/swarm/registry.ts`.
2.  Add a new entry to the `specialistRegistry`:
    ```ts
    growthAnalyst: {
      name: 'Growth Analyst',
      department: 'Growth',
      instructions: 'You analyze user behavior and growth metrics...',
      tools: { ...webIntelligenceTools },
      composioToolkits: ['mixpanel', 'google_analytics']
    }
    ```
3.  Register the subagent key in `src/runtime/swarm.ts` under the `growth` department.
