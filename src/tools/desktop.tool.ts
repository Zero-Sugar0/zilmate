import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { models } from '../config/models.js';
import { requireGatewayAuth } from '../config/env.js';
import { requestConfirmation } from '../runtime/confirm.js';
import { emitProgress } from '../runtime/progress.js';
import { searchWeb } from './web-search.tool.js';

const execFileAsync = promisify(execFile);
const screenshotDir = path.resolve('outputs', 'screenshots');
const cameraDir = path.resolve('outputs', 'camera');

export type CameraDoctorCheck = {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
};

export type CameraDeviceInfo = {
  name: string;
  input: string;
};

async function confirmDesktopAction(action: string, details: string[], access: 'Read-only' | 'Write' = 'Read-only') {
  return requestConfirmation({
    toolkitSlug: 'ZILMATE',
    toolSlug: 'DESKTOP',
    action,
    access,
    targetTools: ['ZILMATE_DESKTOP'],
    details,
    summary: details.join('; '),
  });
}

function safeShellText(value: string) {
  return value.replace(/'/g, "''");
}

async function commandExists(command: string) {
  const probe = process.platform === 'win32' ? 'where.exe' : 'which';
  try {
    await execFileAsync(probe, [command], { windowsHide: true, timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function cameraInstallHint() {
  if (process.platform === 'win32') return 'Install ffmpeg: winget install Gyan.FFmpeg';
  if (process.platform === 'darwin') return 'Install ffmpeg: brew install ffmpeg';
  return 'Install ffmpeg from your package manager, for example: sudo apt install ffmpeg';
}

async function readClipboardText() {
  if (process.platform === 'win32') {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', 'Get-Clipboard -Raw'], { windowsHide: true, timeout: 10_000, maxBuffer: 2_000_000 });
    return stdout;
  }
  if (process.platform === 'darwin') {
    const { stdout } = await execFileAsync('pbpaste', [], { timeout: 10_000, maxBuffer: 2_000_000 });
    return stdout;
  }
  for (const command of ['wl-paste', 'xclip', 'xsel']) {
    if (await commandExists(command)) {
      const args = command === 'xclip'
        ? ['-selection', 'clipboard', '-o']
        : command === 'xsel'
          ? ['--clipboard', '--output']
          : [];
      const { stdout } = await execFileAsync(command, args, { timeout: 10_000, maxBuffer: 2_000_000 });
      return stdout;
    }
  }
  throw new Error('No supported clipboard reader found. Install wl-clipboard, xclip, or xsel on Linux.');
}

async function writeClipboardText(text: string) {
  if (process.platform === 'win32') {
    const script = `Set-Clipboard -Value '${safeShellText(text)}'`;
    await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true, timeout: 10_000 });
    return;
  }
  if (process.platform === 'darwin') {
    await writeToCommand('pbcopy', [], text);
    return;
  }
  for (const command of ['wl-copy', 'xclip', 'xsel']) {
    if (await commandExists(command)) {
      const args = command === 'xclip'
        ? ['-selection', 'clipboard']
        : command === 'xsel'
          ? ['--clipboard', '--input']
          : [];
      await writeToCommand(command, args, text);
      return;
    }
  }
  throw new Error('No supported clipboard writer found. Install wl-clipboard, xclip, or xsel on Linux.');
}

function writeToCommand(command: string, args: string[], input: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `${command} exited with code ${code}`));
    });
    child.stdin.end(input);
  });
}

async function captureScreenshot() {
  await mkdir(screenshotDir, { recursive: true });
  const target = path.join(screenshotDir, `zilmate-screen-${Date.now()}.png`);

  if (process.platform === 'win32') {
    const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bitmap.Save('${safeShellText(target)}', [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
`;
    await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true, timeout: 20_000 });
    return target;
  }

  if (process.platform === 'darwin') {
    await execFileAsync('screencapture', ['-x', target], { timeout: 20_000 });
    return target;
  }

  for (const command of ['gnome-screenshot', 'grim', 'import']) {
    if (await commandExists(command)) {
      const args = command === 'gnome-screenshot'
        ? ['-f', target]
        : command === 'grim'
          ? [target]
          : ['-window', 'root', target];
      await execFileAsync(command, args, { timeout: 20_000 });
      return target;
    }
  }

  throw new Error('No supported screenshot tool found. Install gnome-screenshot, grim, or ImageMagick import on Linux.');
}

function cameraCandidates(device?: string) {
  if (device) return [device];
  if (process.platform === 'win32') {
    return [
      process.env.ZILMATE_CAMERA_DEVICE,
      'video=Integrated Camera',
      'video=USB Camera',
      'video=HD Webcam',
      'video=Integrated Webcam',
      'video=Camera',
    ].filter((value): value is string => Boolean(value));
  }
  if (process.platform === 'darwin') {
    return [process.env.ZILMATE_CAMERA_DEVICE, 'default', '0', '1'].filter((value): value is string => Boolean(value));
  }
  return [process.env.ZILMATE_CAMERA_DEVICE, '/dev/video0', '/dev/video1', '/dev/video2'].filter((value): value is string => Boolean(value));
}

function ffmpegCameraArgs(inputDevice: string, target: string) {
  if (process.platform === 'win32') return ['-y', '-f', 'dshow', '-i', inputDevice, '-frames:v', '1', target];
  if (process.platform === 'darwin') return ['-y', '-f', 'avfoundation', '-i', inputDevice, '-frames:v', '1', target];
  return ['-y', '-f', 'video4linux2', '-i', inputDevice, '-frames:v', '1', target];
}

function friendlyCameraError(error: unknown, attempts: Array<{ device: string; error: string }>) {
  const message = error instanceof Error ? error.message : String(error);
  if (/cannot find|could not find|No such file|video device|Could not open|I\/O error/i.test(message)) {
    return `Could not open the camera device. Try \`zilmate camera list\`, then pass the exact device name. Attempts: ${attempts.map((item) => item.device).join(', ')}`;
  }
  if (/busy|in use|resource unavailable/i.test(message)) {
    return 'Camera appears to be busy. Close Camera, Teams, Zoom, browser tabs, or other apps using it, then retry.';
  }
  if (/permission|denied|access/i.test(message)) {
    return 'Camera permission was denied. Allow terminal/desktop apps to access the camera in OS privacy settings, then retry.';
  }
  return `${message}\nTried: ${attempts.map((item) => item.device).join(', ')}`;
}

export async function listCameraDevices(): Promise<CameraDeviceInfo[]> {
  if (!(await commandExists('ffmpeg'))) return [];
  try {
    if (process.platform === 'win32') {
      const result = await execFileAsync('ffmpeg', ['-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], { timeout: 15_000, maxBuffer: 2_000_000 });
      const output = `${result.stdout}\n${result.stderr}`;
      const names = [...output.matchAll(/"([^"]+)"\s+\(video\)/gi)].map((match) => match[1]!).filter(Boolean);
      return names.map((name) => ({ name, input: `video=${name}` }));
    }
    if (process.platform === 'darwin') {
      const result = await execFileAsync('ffmpeg', ['-hide_banner', '-f', 'avfoundation', '-list_devices', 'true', '-i', ''], { timeout: 15_000, maxBuffer: 2_000_000 });
      const output = `${result.stdout}\n${result.stderr}`;
      const names = [...output.matchAll(/\[(\d+)\]\s+(.+)/g)].map((match) => ({ name: match[2]!.trim(), input: match[1]! }));
      return names;
    }
    const candidates = cameraCandidates();
    const available = [];
    for (const input of candidates) {
      if (existsSync(input)) available.push({ name: input, input });
    }
    return available;
  } catch (error) {
    const output = error && typeof error === 'object' && 'stderr' in error ? String((error as { stderr?: unknown }).stderr || '') : '';
    if (process.platform === 'win32') {
      const names = [...output.matchAll(/"([^"]+)"\s+\(video\)/gi)].map((match) => match[1]!).filter(Boolean);
      return names.map((name) => ({ name, input: `video=${name}` }));
    }
    if (process.platform === 'darwin') {
      return [...output.matchAll(/\[(\d+)\]\s+(.+)/g)].map((match) => ({ name: match[2]!.trim(), input: match[1]! }));
    }
    return [];
  }
}

export async function runCameraDoctor(): Promise<CameraDoctorCheck[]> {
  const checks: CameraDoctorCheck[] = [
    { name: 'OS', status: 'pass', detail: `${process.platform} ${process.arch}` },
  ];
  const hasFfmpeg = await commandExists('ffmpeg');
  checks.push({
    name: 'ffmpeg',
    status: hasFfmpeg ? 'pass' : 'fail',
    detail: hasFfmpeg ? 'ffmpeg is available' : cameraInstallHint(),
  });
  if (!hasFfmpeg) return checks;

  const devices = await listCameraDevices();
  checks.push({
    name: 'Camera devices',
    status: devices.length > 0 ? 'pass' : 'warn',
    detail: devices.length > 0 ? devices.map((device) => device.input).join(', ') : 'No camera devices listed. Try setting ZILMATE_CAMERA_DEVICE manually.',
  });
  checks.push({
    name: 'Default candidates',
    status: 'pass',
    detail: cameraCandidates().join(', '),
  });
  return checks;
}

export async function captureCameraPhoto(device?: string) {
  await mkdir(cameraDir, { recursive: true });

  if (!(await commandExists('ffmpeg'))) {
    throw new Error(`Camera capture needs ffmpeg installed and available on PATH. ${cameraInstallHint()}.`);
  }

  const attempts: Array<{ device: string; error: string }> = [];
  const listed = await listCameraDevices();
  const candidates = [...new Set([...cameraCandidates(device), ...listed.map((item) => item.input)])];
  for (const candidate of candidates) {
    const target = path.join(cameraDir, `zilmate-camera-${Date.now()}.jpg`);
    try {
      emitProgress({ type: 'tool:start', label: 'Trying camera', detail: candidate });
      await execFileAsync('ffmpeg', ffmpegCameraArgs(candidate, target), { timeout: 25_000, maxBuffer: 2_000_000 });
      return target;
    } catch (error) {
      attempts.push({ device: candidate, error: error instanceof Error ? error.message : String(error) });
    }
  }

  throw new Error(friendlyCameraError(attempts.at(-1)?.error || 'Camera capture failed.', attempts));
}

async function analyzeImage(imagePath: string, prompt: string, label = 'image') {
  requireGatewayAuth();
  const image = await readFile(imagePath);
  emitProgress({ type: 'tool:start', label: `Analyzing ${label}`, detail: models.screenshotVision });
  const result = await generateText({
    model: models.screenshotVision,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt,
          },
          {
            type: 'image',
            image,
            mediaType: imagePath.toLowerCase().endsWith('.jpg') || imagePath.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : 'image/png',
          },
        ],
      },
    ],
    providerOptions: {
      gateway: {
        tags: ['zilmate', 'feature:screenshot', 'model:gemini'],
      },
    },
  });
  emitProgress({ type: 'tool:end', label: `${label[0]?.toUpperCase() || 'I'}${label.slice(1)} analyzed`, detail: models.screenshotVision });
  return result.text;
}

const defaultScreenshotPrompt = [
  'Describe this screenshot clearly and usefully.',
  'Include visible apps/pages, important UI elements, visible text, errors, warnings, selected items, and likely user intent.',
  'If this is a coding or app screen, identify the relevant files, terminal output, browser state, or UI issue.',
  'Be precise and avoid claiming hidden information that is not visible.',
].join(' ');

const defaultCameraPrompt = [
  'Describe this camera photo clearly and usefully.',
  'Identify visible objects, environment, text, people only in non-sensitive general terms, safety concerns, and anything the user may be asking about.',
  'Do not identify a person by name or infer sensitive traits.',
  'If the image shows a document, product, device, room, object, or issue, explain what is visible and what might be useful to do next.',
].join(' ');

export const desktopTools = {
  readClipboard: tool({
    description: 'Read the current system clipboard text after user approval. Use when the user asks ZilMate to inspect copied text, copied errors, URLs, snippets, or prompts.',
    inputSchema: z.object({
      maxCharacters: z.number().int().min(100).max(20_000).optional(),
    }),
    execute: async ({ maxCharacters }) => {
      const approved = await confirmDesktopAction('Read clipboard', ['Read text currently stored in the system clipboard']);
      if (!approved) throw new Error('Blocked clipboard read. Ask the user to approve reading the clipboard.');
      const text = await readClipboardText();
      const limit = maxCharacters ?? 8000;
      emitProgress({ type: 'fetch:end', label: 'Clipboard read', detail: `${text.length} character${text.length === 1 ? '' : 's'}` });
      return {
        characters: text.length,
        truncated: text.length > limit,
        text: text.slice(0, limit),
      };
    },
  }),

  writeClipboard: tool({
    description: 'Write text to the system clipboard after user approval. Use when the user asks ZilMate to copy an answer, command, file path, draft, or summary.',
    inputSchema: z.object({
      text: z.string().min(1).max(100_000),
    }),
    execute: async ({ text }) => {
      const approved = await confirmDesktopAction('Write clipboard', [`Write ${text.length} character${text.length === 1 ? '' : 's'} to clipboard`], 'Write');
      if (!approved) throw new Error('Blocked clipboard write. Ask the user to approve writing to the clipboard.');
      await writeClipboardText(text);
      emitProgress({ type: 'tool:end', label: 'Clipboard updated' });
      return { copied: true, characters: text.length };
    },
  }),

  takeScreenshot: tool({
    description: 'Capture the current screen to a local PNG file after user approval. Use when the user asks ZilMate to look at the screen or capture current UI state.',
    inputSchema: z.object({}),
    execute: async () => {
      const approved = await confirmDesktopAction('Take screenshot', ['Capture the current primary screen as an image file']);
      if (!approved) throw new Error('Blocked screenshot. Ask the user to approve screen capture.');
      const file = await captureScreenshot();
      emitProgress({ type: 'tool:end', label: 'Screenshot captured', detail: file });
      return { file };
    },
  }),

  analyzeScreenshot: tool({
    description: 'Capture or read a screenshot and analyze it with Gemini 3.1 Flash Lite. Gives a detailed description, visible text, UI/error diagnosis, and optional web search context.',
    inputSchema: z.object({
      path: z.string().min(1).optional().describe('Existing screenshot path. If omitted, ZilMate captures the current screen after approval.'),
      prompt: z.string().min(3).optional(),
      searchWeb: z.boolean().optional().describe('If true, search the web using the screenshot analysis for extra context. Requires Tavily.'),
      maxSearchResults: z.number().int().min(1).max(5).optional(),
    }),
    execute: async ({ path: imagePath, prompt, searchWeb: shouldSearchWeb, maxSearchResults }) => {
      let file = imagePath ? path.resolve(imagePath) : '';
      if (!file) {
        const approved = await confirmDesktopAction('Capture and analyze screenshot', ['Capture current screen and send the image to the configured AI Gateway screenshot model']);
        if (!approved) throw new Error('Blocked screenshot analysis. Ask the user to approve screen capture.');
        file = await captureScreenshot();
      }

      const analysis = await analyzeImage(file, prompt || defaultScreenshotPrompt);
      let webResults: Awaited<ReturnType<typeof searchWeb>> | undefined;
      if (shouldSearchWeb) {
        webResults = await searchWeb(`Help explain or troubleshoot this screen: ${analysis.slice(0, 800)}`, maxSearchResults ?? 3);
      }
      return {
        file,
        model: models.screenshotVision,
        analysis,
        ...(webResults ? { webResults } : {}),
      };
    },
  }),

  takeCameraPhoto: tool({
    description: 'Open the laptop camera and capture one photo after user approval. Requires ffmpeg on PATH. Use when the user asks ZilMate to look through the camera or take a picture.',
    inputSchema: z.object({
      device: z.string().min(1).optional().describe('Optional ffmpeg camera device. Windows example: video=Integrated Camera; Linux: /dev/video0; macOS: default or device index.'),
    }),
    execute: async ({ device }) => {
      const approved = await confirmDesktopAction('Take camera photo', [
        'Open the laptop camera',
        'Capture one still image',
        ...(device ? [`Device: ${device}`] : []),
      ]);
      if (!approved) throw new Error('Blocked camera capture. Ask the user to approve using the laptop camera.');
      const file = await captureCameraPhoto(device);
      emitProgress({ type: 'tool:end', label: 'Camera photo captured', detail: file });
      return { file };
    },
  }),

  analyzeCameraPhoto: tool({
    description: 'Open the laptop camera, capture one photo, and analyze it with Gemini 3.1 Flash Lite after user approval. Can optionally search the web based on the analysis.',
    inputSchema: z.object({
      device: z.string().min(1).optional(),
      prompt: z.string().min(3).optional(),
      searchWeb: z.boolean().optional(),
      maxSearchResults: z.number().int().min(1).max(5).optional(),
    }),
    execute: async ({ device, prompt, searchWeb: shouldSearchWeb, maxSearchResults }) => {
      const approved = await confirmDesktopAction('Capture and analyze camera photo', [
        'Open the laptop camera',
        'Capture one still image',
        `Send the image to ${models.screenshotVision} for analysis`,
        ...(device ? [`Device: ${device}`] : []),
      ]);
      if (!approved) throw new Error('Blocked camera analysis. Ask the user to approve using the laptop camera.');
      const file = await captureCameraPhoto(device);
      const analysis = await analyzeImage(file, prompt || defaultCameraPrompt, 'camera photo');
      let webResults: Awaited<ReturnType<typeof searchWeb>> | undefined;
      if (shouldSearchWeb) {
        webResults = await searchWeb(`Help explain or troubleshoot this camera image: ${analysis.slice(0, 800)}`, maxSearchResults ?? 3);
      }
      return {
        file,
        model: models.screenshotVision,
        analysis,
        ...(webResults ? { webResults } : {}),
      };
    },
  }),
};
