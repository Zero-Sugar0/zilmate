import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tool } from 'ai';
import { z } from 'zod';
import { emitProgress } from '../runtime/progress.js';

const execFileAsync = promisify(execFile);

async function sendDesktopNotification(title: string, message: string, urgency: 'low' | 'normal' | 'critical' = 'normal') {
  const safeTitle = title.slice(0, 120);
  const safeMessage = message.slice(0, 500);

  if (process.platform === 'win32') {
    const script = `
Add-Type -AssemblyName System.Windows.Forms
$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = [System.Drawing.SystemIcons]::Information
$notify.Visible = $true
$notify.ShowBalloonTip(8000, '${safeTitle.replace(/'/g, "''")}', '${safeMessage.replace(/'/g, "''")}', [System.Windows.Forms.ToolTipIcon]::Info)
Start-Sleep -Seconds 2
$notify.Dispose()
`.trim();
    await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true, timeout: 15_000 });
    return { platform: 'windows', delivered: true };
  }

  if (process.platform === 'darwin') {
    const escaped = `${safeTitle}: ${safeMessage}`.replace(/"/g, '\\"');
    await execFileAsync('osascript', ['-e', `display notification "${escaped}" with title "${safeTitle.replace(/"/g, '\\"')}"`], { timeout: 10_000 });
    return { platform: 'darwin', delivered: true };
  }

  try {
    await execFileAsync('notify-send', [
      ...(urgency === 'critical' ? ['-u', 'critical'] : urgency === 'low' ? ['-u', 'low'] : []),
      safeTitle,
      safeMessage,
    ], { timeout: 10_000 });
    return { platform: 'linux', delivered: true };
  } catch {
    await execFileAsync('zenity', ['--info', '--title', safeTitle, '--text', safeMessage, '--timeout=8'], { timeout: 12_000 });
    return { platform: 'linux', delivered: true, fallback: 'zenity' };
  }
}

export const notifyTools = {
  sendNotification: tool({
    description: 'Send a native desktop notification on the user PC when approval is needed, a job finished, or the user should be alerted.',
    inputSchema: z.object({
      title: z.string().min(1).max(120),
      message: z.string().min(1).max(500),
      urgency: z.enum(['low', 'normal', 'critical']).optional(),
    }),
    execute: async ({ title, message, urgency }) => {
      emitProgress({ type: 'step', label: 'Sending notification', detail: title });
      try {
        const result = await sendDesktopNotification(title, message, urgency ?? 'normal');
        return { ok: true, ...result };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          hint: 'Ensure notifications are enabled for your terminal on this OS.',
        };
      }
    },
  }),
};
