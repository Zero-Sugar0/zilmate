import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { runManager } from '../agents/manager.js';
import { theme } from '../cli/theme.js';
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync, rmSync, openSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = env.zilmateDaemonPort;
let sessionToken = '';

/**
 * Triggers native OS notification toasts
 */
export function sendOsNotification(title: string, message: string) {
  if (process.platform === 'win32') {
    // Windows PowerShell Toast
    const psCommand = `
      [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
      [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
      $xml = @"
<toast>
    <visual>
        <binding template="ToastGeneric">
            <text>${title}</text>
            <text>${message}</text>
        </binding>
    </visual>
</toast>
"@
      $xmlDoc = [Windows.Data.Xml.Dom.XmlDocument]::New()
      $xmlDoc.LoadXml($xml)
      $toast = [Windows.UI.Notifications.ToastNotification]::new($xmlDoc)
      $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe')
      $notifier.Show($toast)
    `;
    spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', psCommand], { stdio: 'ignore' });
  } else if (process.platform === 'darwin') {
    // macOS Notification Center
    const appleScript = `display notification "${message.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}"`;
    spawn('osascript', ['-e', appleScript], { stdio: 'ignore' });
  }
}

/**
 * Strips the @zilmate prefix if present and extracts clean prompt instructions
 */
export function parseUbiquityPrompt(text: string): { prompt: string; isTriggered: boolean } {
  const trimmed = text.trim();
  const triggerRegex = /^@zilmate\s*(?:rewrite\s+professionally\s*:\s*|rewrite\s*:\s*|answer\s+this\s*:\s*|answer\s*:\s*|:)?\s*([\s\S]+)$/i;
  const match = trimmed.match(triggerRegex);

  if (match && match[1] !== undefined) {
    return { prompt: match[1].trim(), isTriggered: true };
  }

  // Fallback: If it starts with @zilmate but doesn't match the specific modifiers
  if (trimmed.toLowerCase().startsWith('@zilmate')) {
    return { prompt: trimmed.slice(8).trim(), isTriggered: true };
  }

  return { prompt: trimmed, isTriggered: false };
}

export async function handleProcessRequest(req: IncomingMessage, res: ServerResponse) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });

  req.on('end', async () => {
    try {
      const data = JSON.parse(body);
      const text = data.text || '';
      if (!text.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Text cannot be empty' }));
        return;
      }

      console.log(theme.muted(`[Ubiquity] Received text length: ${text.length}`));
      const { prompt, isTriggered } = parseUbiquityPrompt(text);

      sendOsNotification('ZilMate Ubiquity', 'Thinking... 🧠');

      const response = await runManager(prompt, {
        sessionId: 'ubiquity',
      });

      sendOsNotification('ZilMate Ubiquity', 'Response ready! 🚀');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ result: response }));
    } catch (error) {
      console.error(theme.error('[Ubiquity] Error processing text:'), error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });
}

export function startDaemon() {
  // Generate secure single-use CSRF defense token
  sessionToken = randomBytes(24).toString('hex');
  const tokenPath = join(homedir(), '.zilmate-token');
  try {
    writeFileSync(tokenPath, sessionToken, { encoding: 'utf8', mode: 0o600 });
  } catch {
    // Fallback if writing to homedir has permission issues
    try { writeFileSync('.zilmate-token', sessionToken, 'utf8'); } catch {}
  }

  // Cleanup on process terminations
  const cleanup = () => {
    try { rmSync(tokenPath); } catch {}
    try { rmSync('.zilmate-token'); } catch {}
  };
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  const server = createServer(async (req, res) => {
    // Add simple CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // CSRF & Cross-Origin Security: Require Authorization header matching local sessionToken
    const authHeader = req.headers['authorization'];
    if (!authHeader || authHeader !== `Bearer ${sessionToken}`) {
      console.warn(theme.error('[Ubiquity] CSRF/Unauthorized request blocked from origin:'), req.headers['origin']);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Local session token mismatch' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/process') {
      await handleProcessRequest(req, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(theme.ok(`[Ubiquity] ZilMate Daemon listening on http://127.0.0.1:${PORT}`));
    sendOsNotification('ZilMate Daemon', 'ZilMate Ubiquity Service Started 🟢');
  });

  // Start keyboard listener on Windows
  if (process.platform === 'win32') {
    const listenerPath = join(__dirname, 'win-listener.ps1');
    if (existsSync(listenerPath)) {
      console.log(theme.muted(`[Ubiquity] Launching Windows Hotkey Listener at ${listenerPath}...`));
      const logPath = join(homedir(), '.zilmate-listener-error.log');
      let stdioOption: any = 'ignore';
      try {
        const logFile = openSync(logPath, 'a');
        stdioOption = ['ignore', logFile, logFile];
      } catch {
        // Fallback
      }

      const psArgs = [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-WindowStyle', 'Hidden',
        '-Sta',
        '-File', `"${listenerPath}"`,
        '-Port', PORT.toString(),
        '-Token', `"${sessionToken}"`
      ];
      const cmdString = `powershell ${psArgs.join(' ')}`;

      const ps = spawn(cmdString, {
        detached: true,
        shell: true,
        windowsHide: true,
        stdio: stdioOption
      });

      ps.on('error', (err) => {
        console.error(theme.error('[Ubiquity] Failed to start keyboard listener:'), err);
      });
      ps.on('exit', (code, signal) => {
        console.warn(theme.warn(`[Ubiquity] Keyboard listener exited with code ${code} and signal ${signal}`));
      });

      ps.unref();
    } else {
      console.warn(theme.warn(`[Ubiquity] Warning: win-listener.ps1 not found at ${listenerPath}`));
    }
  }
}
