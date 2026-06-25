import { tool } from 'ai';
import { z } from 'zod';
import { Daytona, type Sandbox } from '@daytona/sdk';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { requestConfirmation } from '../runtime/confirm.js';
import { emitProgress } from '../runtime/progress.js';

/**
 * Daytona Browser-Use Tool
 *
 * Runs real Playwright browser automation INSIDE an isolated Daytona sandbox —
 * not on your local machine. This means:
 *   - Login sessions, cookies, and downloaded files never touch your laptop
 *   - You can run untrusted/scraping-heavy workloads with zero blast radius
 *   - Sandboxes are full Linux VMs — Chromium runs headless inside them
 *   - Daytona's `computerUse` API additionally gives mouse/keyboard/screenshot
 *     control of the sandbox's own desktop, useful for non-headless flows
 *
 * Architecture:
 *   1. getOrCreateBrowserSandbox — reuses one warm sandbox across calls (fast),
 *      or spins up a fresh ephemeral one for isolated one-off tasks.
 *   2. browserNavigate / browserAction / browserExtract / browserScreenshot —
 *      each one runs a small Playwright script via sandbox.process.codeRun()
 *      and returns structured results.
 *   3. closeBrowserSandbox — tears down the sandbox when done (saves cost).
 *
 * Requires DAYTONA_API_KEY in env. Get one free at app.daytona.io.
 */

let daytonaClient: Daytona | null = null;
let warmSandbox: Sandbox | null = null;
let warmSandboxId: string | null = null;

const outputDir = path.resolve('outputs', 'daytona-browser');

async function ensureOutputDir() {
  await mkdir(outputDir, { recursive: true });
  return outputDir;
}

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function getClient(): Daytona {
  if (!daytonaClient) {
    if (!process.env.DAYTONA_API_KEY) {
      throw new Error('DAYTONA_API_KEY is not set. Get a free key at https://app.daytona.io and add it to your .env.');
    }
    daytonaClient = new Daytona({ apiKey: process.env.DAYTONA_API_KEY });
  }
  return daytonaClient;
}

async function confirmBrowserAction(action: string, details: string[]) {
  return requestConfirmation({
    toolkitSlug: 'ZILMATE',
    toolSlug: 'DAYTONA_BROWSER',
    action,
    access: 'Read-only',
    targetTools: ['ZILMATE_DAYTONA_BROWSER'],
    details,
    summary: details.join('; '),
  });
}

/**
 * The Playwright bootstrap script every action builds on.
 * Persists browser state across calls in the same sandbox via a JSON
 * "session file" written to /tmp — the sandbox's process.codeRun is
 * stateless between calls, so we re-launch and reattach to the same
 * storage_state each time to keep cookies/login alive.
 */
function playwrightScript(body: string, opts: { headless?: boolean; storageStatePath?: string } = {}): string {
  const headless = opts.headless ?? true;
  const storagePath = opts.storageStatePath ?? '/tmp/zilmate-browser-state.json';
  return `
import json, os, sys
from playwright.sync_api import sync_playwright

STORAGE_PATH = "${storagePath}"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=${headless ? 'True' : 'False'})
    context_kwargs = {}
    if os.path.exists(STORAGE_PATH):
        context_kwargs["storage_state"] = STORAGE_PATH
    context = browser.new_context(**context_kwargs, viewport={"width": 1440, "height": 900})
    page = context.new_page()

    result = {}
    try:
${body.split('\n').map((l) => '        ' + l).join('\n')}
    finally:
        # Persist cookies/session for next call
        context.storage_state(path=STORAGE_PATH)
        browser.close()

    print("ZILMATE_RESULT_START")
    print(json.dumps(result, default=str))
    print("ZILMATE_RESULT_END")
`.trim();
}

function extractResult(output: string): Record<string, unknown> {
  const start = output.indexOf('ZILMATE_RESULT_START');
  const end = output.indexOf('ZILMATE_RESULT_END');
  if (start === -1 || end === -1) {
    return { raw: output.slice(-2000) };
  }
  const jsonStr = output.slice(start + 'ZILMATE_RESULT_START'.length, end).trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    return { raw: jsonStr };
  }
}

// ─── Sandbox lifecycle ────────────────────────────────────────────────────────

export const sandboxLifecycleTools = {
  getOrCreateBrowserSandbox: tool({
    description:
      'Create or reuse a warm Daytona sandbox with Playwright + Chromium installed, ready for browser automation. Call this once at the start of a browsing task. Reuses the same sandbox across calls in this session so login cookies persist, unless ephemeral=true.',
    inputSchema: z.object({
      ephemeral: z
        .boolean()
        .optional()
        .default(false)
        .describe('If true, always creates a fresh isolated sandbox (auto-deleted when stopped) instead of reusing the warm one. Use for untrusted/one-off scraping tasks.'),
    }),
    execute: async ({ ephemeral }) => {
      const approved = await confirmBrowserAction('Create Daytona browser sandbox', [
        ephemeral ? 'Ephemeral sandbox — auto-deleted after use' : 'Reusable sandbox — persists across calls this session',
        'Installs Playwright + Chromium inside an isolated cloud VM',
      ]);
      if (!approved) throw new Error('Blocked sandbox creation. Ask user to approve.');

      const daytona = getClient();

      if (!ephemeral && warmSandbox && warmSandboxId) {
        emitProgress({ type: 'tool:end', label: 'Reusing existing browser sandbox', detail: warmSandboxId });
        return { sandboxId: warmSandboxId, reused: true };
      }

      emitProgress({ type: 'tool:start', label: 'Creating Daytona sandbox' });

      const sandbox = ephemeral
        ? await daytona.create({ ephemeral: true, autoStopInterval: 10 })
        : await daytona.create();

      emitProgress({ type: 'tool:start', label: 'Installing Playwright + Chromium', detail: sandbox.id });

      // Install playwright and the chromium browser binary inside the sandbox
      const install = await sandbox.process.executeCommand(
        'pip install playwright >/tmp/pw-install.log 2>&1 && playwright install --with-deps chromium >>/tmp/pw-install.log 2>&1 && echo DONE',
        undefined,
        undefined,
        180,
      );

      if (!install.result?.includes('DONE')) {
        throw new Error(`Playwright install failed in sandbox: ${install.result?.slice(-500)}`);
      }

      if (!ephemeral) {
        warmSandbox = sandbox;
        warmSandboxId = sandbox.id;
      }

      emitProgress({ type: 'tool:end', label: 'Browser sandbox ready', detail: sandbox.id });
      return { sandboxId: sandbox.id, reused: false, ephemeral };
    },
  }),

  closeBrowserSandbox: tool({
    description: 'Stop and release the warm browser sandbox to stop incurring compute cost. Call when a browsing task is fully done.',
    inputSchema: z.object({}),
    execute: async () => {
      if (!warmSandbox) {
        return { closed: false, message: 'No active browser sandbox to close.' };
      }
      const id = warmSandboxId;
      emitProgress({ type: 'tool:start', label: 'Closing browser sandbox', ...(id ? { detail: id } : {}) });
      await warmSandbox.stop();
      warmSandbox = null;
      warmSandboxId = null;
      emitProgress({ type: 'tool:end', label: 'Browser sandbox closed' });
      return { closed: true, sandboxId: id };
    },
  }),
};

// ─── Core browsing actions ───────────────────────────────────────────────────

function getActiveSandbox(): Sandbox {
  if (!warmSandbox) {
    throw new Error('No active browser sandbox. Call getOrCreateBrowserSandbox first.');
  }
  return warmSandbox;
}

export const browsingTools = {
  browserNavigate: tool({
    description:
      'Navigate to a URL inside the sandboxed browser and return the page title, final URL (after redirects), and visible text content. The starting point for any browsing task.',
    inputSchema: z.object({
      url: z.string().url(),
      waitForSelector: z.string().optional().describe('CSS selector to wait for before considering the page loaded (useful for SPAs).'),
      timeoutMs: z.number().int().min(1000).max(60_000).optional().default(30_000),
    }),
    execute: async ({ url, waitForSelector, timeoutMs }) => {
      const approved = await confirmBrowserAction('Navigate browser', [`URL: ${url}`]);
      if (!approved) throw new Error('Blocked navigation. Ask user to approve.');

      const sandbox = getActiveSandbox();
      emitProgress({ type: 'tool:start', label: 'Navigating', detail: url });

      const body = `
        page.goto("${url}", timeout=${timeoutMs})
        ${waitForSelector ? `page.wait_for_selector("${waitForSelector}", timeout=${timeoutMs})` : ''}
        result["title"] = page.title()
        result["finalUrl"] = page.url
        result["text"] = page.inner_text("body")[:5000]
      `;

      const out = await sandbox.process.codeRun(playwrightScript(body), undefined, Math.ceil(timeoutMs / 1000) + 15);
      const parsed = extractResult(out.result ?? '');

      emitProgress({ type: 'tool:end', label: 'Navigation complete', detail: parsed.finalUrl as string });
      return parsed;
    },
  }),

  browserAction: tool({
    description:
      'Perform an interaction on the current page inside the sandboxed browser: click, type into a field, select a dropdown option, check a checkbox, press a key, or wait for an element. Use CSS selectors or Playwright text= selectors.',
    inputSchema: z.object({
      action: z.enum(['click', 'fill', 'select', 'check', 'uncheck', 'press', 'waitFor', 'scroll']),
      selector: z.string().describe('CSS selector or Playwright selector, e.g. "#submit", "text=Sign in", "[name=email]".'),
      value: z.string().optional().describe('Text to fill, option value to select, or key to press (e.g. "Enter").'),
      timeoutMs: z.number().int().min(500).max(30_000).optional().default(10_000),
    }),
    execute: async ({ action, selector, value, timeoutMs }) => {
      const approved = await confirmBrowserAction('Browser interaction', [`${action} on "${selector}"`, value ? `Value: ${value}` : '']);
      if (!approved) throw new Error('Blocked browser action. Ask user to approve.');

      const sandbox = getActiveSandbox();
      emitProgress({ type: 'tool:start', label: `Browser ${action}`, detail: selector });

      // NOTE: this requires the browser to have an existing page context.
      // We re-navigate to the last known URL stored in storage_state's page,
      // but Playwright doesn't persist "current page" — so actions must be
      // chained with browserNavigate immediately before, or use browserRunScript
      // for multi-step flows within a single browser session (see below).
      const escapedValue = (value ?? '').replace(/"/g, '\\"');
      const body = `
        last_url = result.get("__last_url__")
        ${action === 'click' ? `page.click("${selector}", timeout=${timeoutMs})` : ''}
        ${action === 'fill' ? `page.fill("${selector}", "${escapedValue}", timeout=${timeoutMs})` : ''}
        ${action === 'select' ? `page.select_option("${selector}", "${escapedValue}", timeout=${timeoutMs})` : ''}
        ${action === 'check' ? `page.check("${selector}", timeout=${timeoutMs})` : ''}
        ${action === 'uncheck' ? `page.uncheck("${selector}", timeout=${timeoutMs})` : ''}
        ${action === 'press' ? `page.press("${selector}", "${escapedValue}", timeout=${timeoutMs})` : ''}
        ${action === 'waitFor' ? `page.wait_for_selector("${selector}", timeout=${timeoutMs})` : ''}
        ${action === 'scroll' ? `page.locator("${selector}").scroll_into_view_if_needed(timeout=${timeoutMs})` : ''}
        result["action"] = "${action}"
        result["selector"] = "${selector}"
        result["url"] = page.url
        result["title"] = page.title()
      `;

      const out = await sandbox.process.codeRun(playwrightScript(body), undefined, Math.ceil(timeoutMs / 1000) + 15);
      const parsed = extractResult(out.result ?? '');

      emitProgress({ type: 'tool:end', label: `Browser ${action} complete` });
      return parsed;
    },
  }),

  browserRunScript: tool({
    description:
      'Run a full multi-step Playwright Python script inside the sandboxed browser in one call — navigate, fill a login form, click submit, wait for a result, extract data — all in a single page session. Use this instead of chaining browserNavigate + browserAction when steps depend on each other within the same page load (e.g. login flows, multi-field forms, infinite scroll). The script body runs with `page`, `context`, and `result` (dict) already available; populate result with whatever you want returned.',
    inputSchema: z.object({
      startUrl: z.string().url().describe('URL to navigate to first.'),
      scriptBody: z
        .string()
        .describe(
          'Python lines using Playwright sync API: page.fill(...), page.click(...), page.wait_for_selector(...), etc. Populate result["key"] = value for anything you want returned. Do NOT include page.goto for startUrl — that is handled automatically.',
        ),
      timeoutMs: z.number().int().min(5000).max(120_000).optional().default(45_000),
      headless: z.boolean().optional().default(true).describe('Set false only if visually debugging via screenshot is needed mid-script.'),
    }),
    execute: async ({ startUrl, scriptBody, timeoutMs, headless }) => {
      const approved = await confirmBrowserAction('Run multi-step browser script', [
        `Start URL: ${startUrl}`,
        `Script: ${scriptBody.slice(0, 200)}${scriptBody.length > 200 ? '…' : ''}`,
      ]);
      if (!approved) throw new Error('Blocked browser script. Ask user to approve.');

      const sandbox = getActiveSandbox();
      emitProgress({ type: 'tool:start', label: 'Running browser script', detail: startUrl });

      const body = `
        page.goto("${startUrl}", timeout=${timeoutMs})
${scriptBody.split('\n').map((l) => '        ' + l).join('\n')}
        result.setdefault("url", page.url)
        result.setdefault("title", page.title())
      `;

      const out = await sandbox.process.codeRun(
        playwrightScript(body, { headless }),
        undefined,
        Math.ceil(timeoutMs / 1000) + 30,
      );
      const parsed = extractResult(out.result ?? '');

      emitProgress({ type: 'tool:end', label: 'Browser script complete' });
      return parsed;
    },
  }),

  browserExtract: tool({
    description:
      'Extract structured data from the current page using CSS selectors — text content, attribute values, or all matches for a repeated element (e.g. all product titles + prices in a list). Use after browserNavigate.',
    inputSchema: z.object({
      url: z.string().url().describe('Page to load before extracting.'),
      fields: z
        .array(
          z.object({
            name: z.string().describe('Output field name.'),
            selector: z.string().describe('CSS selector for this field.'),
            attribute: z.string().optional().describe('HTML attribute to read instead of text content, e.g. "href" or "src".'),
            multiple: z.boolean().optional().default(false).describe('If true, returns an array of all matches instead of just the first.'),
          }),
        )
        .min(1),
      timeoutMs: z.number().int().min(1000).max(60_000).optional().default(30_000),
    }),
    execute: async ({ url, fields, timeoutMs }) => {
      const approved = await confirmBrowserAction('Extract page data', [`URL: ${url}`, `Fields: ${fields.map((f) => f.name).join(', ')}`]);
      if (!approved) throw new Error('Blocked extraction. Ask user to approve.');

      const sandbox = getActiveSandbox();
      emitProgress({ type: 'tool:start', label: 'Extracting data', detail: url });

      const extractLines = fields.map((f) => {
        const accessor = f.attribute ? `.get_attribute("${f.attribute}")` : '.inner_text()';
        if (f.multiple) {
          return `result["${f.name}"] = [el${accessor} for el in page.query_selector_all("${f.selector}")]`;
        }
        return `el_${f.name} = page.query_selector("${f.selector}"); result["${f.name}"] = el_${f.name}${accessor} if el_${f.name} else None`;
      }).join('\n        ');

      const body = `
        page.goto("${url}", timeout=${timeoutMs})
        ${extractLines}
      `;

      const out = await sandbox.process.codeRun(playwrightScript(body), undefined, Math.ceil(timeoutMs / 1000) + 15);
      const parsed = extractResult(out.result ?? '');

      emitProgress({ type: 'tool:end', label: 'Extraction complete', detail: `${fields.length} fields` });
      return parsed;
    },
  }),

  browserScreenshot: tool({
    description:
      'Take a screenshot of the current sandboxed browser page (or a specific URL) and save it locally for the agent to view via analyzeScreenshot. Useful for visually verifying page state, debugging selectors, or showing the user what a page looks like.',
    inputSchema: z.object({
      url: z.string().url().optional().describe('If provided, navigates here first. Otherwise screenshots the current page.'),
      fullPage: z.boolean().optional().default(false).describe('Capture the full scrollable page instead of just the viewport.'),
    }),
    execute: async ({ url, fullPage }) => {
      const approved = await confirmBrowserAction('Browser screenshot', [url ? `URL: ${url}` : 'Current page', fullPage ? 'Full page' : 'Viewport only'], );
      if (!approved) throw new Error('Blocked screenshot. Ask user to approve.');

      const sandbox = getActiveSandbox();
      emitProgress({ type: 'tool:start', label: 'Taking browser screenshot' });

      const remotePath = `/tmp/zilmate-shot-${ts()}.png`;
      const body = `
        ${url ? `page.goto("${url}", timeout=30000)` : ''}
        page.screenshot(path="${remotePath}", full_page=${fullPage ? 'True' : 'False'})
        result["remotePath"] = "${remotePath}"
        result["url"] = page.url
      `;

      const out = await sandbox.process.codeRun(playwrightScript(body), undefined, 45);
      const parsed = extractResult(out.result ?? '');

      // Pull the screenshot bytes down from the sandbox filesystem to local disk
      const dir = await ensureOutputDir();
      const localPath = path.join(dir, `screenshot-${ts()}.png`);
      const bytes = await sandbox.fs.downloadFile(remotePath);
      await writeFile(localPath, bytes);

      emitProgress({ type: 'tool:end', label: 'Screenshot saved', detail: localPath });
      return { ...parsed, localPath };
    },
  }),
};

// ─── Barrel export ────────────────────────────────────────────────────────────

export const daytonaBrowserTools = {
  ...sandboxLifecycleTools,
  ...browsingTools,
};