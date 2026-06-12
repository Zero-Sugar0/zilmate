import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeFile, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import { stdin as input } from 'node:process';
import { env } from '../config/env.js';
import { speakWithDeepgram, startCascadedVoiceSession } from './cascade.js';
import type { ZilMateVoiceEvent } from './types.js';

const execFileAsync = promisify(execFile);

export type TerminalVoiceRuntimeCheck = {
  name: string;
  ok: boolean;
  detail: string;
};

export type TerminalVoiceDevice = {
  name: string;
  input: string;
};

async function commandExists(command: string) {
  const probe = process.platform === 'win32' ? 'where.exe' : 'which';
  try {
    await execFileAsync(probe, [command], { windowsHide: true, timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function voiceInputDevice() {
  return process.env.ZILMATE_VOICE_INPUT_DEVICE || '';
}

function parseWindowsAudioDevices(output: string) {
  const names = new Set<string>();
  for (const line of output.split(/\r?\n/)) {
    if (/Alternative name/i.test(line)) continue;
    const match = /"([^"]+)"\s+\(audio\)/i.exec(line);
    if (match?.[1]) names.add(match[1]);
  }
  return [...names].map((name) => ({ name, input: `audio=${name}` }));
}

function parseMacAudioDevices(output: string) {
  const audioSection = output.split('AVFoundation audio devices:')[1] || output;
  return [...audioSection.matchAll(/\[(\d+)\]\s+(.+)/g)]
    .map((match) => ({ name: match[2]!.trim(), input: `:${match[1]!}` }))
    .filter((device) => !/AVFoundation video devices/i.test(device.name));
}

export async function listTerminalVoiceInputDevices(): Promise<TerminalVoiceDevice[]> {
  if (!(await commandExists('ffmpeg'))) return [];
  try {
    if (process.platform === 'win32') {
      const result = await execFileAsync('ffmpeg', ['-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], { timeout: 15_000, maxBuffer: 2_000_000 });
      return parseWindowsAudioDevices(`${result.stdout}\n${result.stderr}`);
    }
    if (process.platform === 'darwin') {
      const result = await execFileAsync('ffmpeg', ['-hide_banner', '-f', 'avfoundation', '-list_devices', 'true', '-i', ''], { timeout: 15_000, maxBuffer: 2_000_000 });
      return parseMacAudioDevices(`${result.stdout}\n${result.stderr}`);
    }
    return [{ name: 'Default PulseAudio input', input: 'default' }];
  } catch (error) {
    const output = error && typeof error === 'object'
      ? `${'stdout' in error ? String((error as { stdout?: unknown }).stdout || '') : ''}\n${'stderr' in error ? String((error as { stderr?: unknown }).stderr || '') : ''}`
      : '';
    if (process.platform === 'win32') {
      return parseWindowsAudioDevices(output);
    }
    if (process.platform === 'darwin') {
      return parseMacAudioDevices(output);
    }
    return [{ name: 'Default PulseAudio input', input: 'default' }];
  }
}

function micArgs(device: string) {
  const common = ['-hide_banner', '-loglevel', 'error'];
  if (process.platform === 'win32') {
    return [
      ...common,
      '-f',
      'dshow',
      '-i',
      device,
      '-ac',
      '1',
      '-ar',
      '16000',
      '-f',
      's16le',
      'pipe:1',
    ];
  }
  if (process.platform === 'darwin') {
    return [
      ...common,
      '-f',
      'avfoundation',
      '-i',
      device,
      '-ac',
      '1',
      '-ar',
      '16000',
      '-f',
      's16le',
      'pipe:1',
    ];
  }
  return [
    ...common,
    '-f',
    'pulse',
    '-i',
    device,
    '-ac',
    '1',
    '-ar',
    '16000',
    '-f',
    's16le',
    'pipe:1',
  ];
}

async function resolveMicInput() {
  const configured = voiceInputDevice();
  if (configured) return configured;
  if (process.platform === 'win32') {
    const [firstDevice] = await listTerminalVoiceInputDevices();
    if (!firstDevice) {
      throw new Error('No Windows microphone device was detected. Run `zilmate voice devices`, check Windows microphone privacy settings, or set ZILMATE_VOICE_INPUT_DEVICE.');
    }
    return firstDevice.input;
  }
  if (process.platform === 'darwin') return ':0';
  return 'default';
}

function playbackArgs() {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-nodisp',
    '-autoexit',
    '-i',
    '-',
  ];
}

function wavHeader(dataBytes: number, sampleRate = 24000, channels = 1) {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;
  const blockAlign = channels * 2;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataBytes, 40);
  return header;
}

function wavFromPcm(pcm: Buffer, sampleRate = 24000, channels = 1) {
  return Buffer.concat([wavHeader(pcm.byteLength, sampleRate, channels), pcm]);
}

function streamingWavHeader(sampleRate = 24000, channels = 1) {
  return wavHeader(0xffffffff - 36, sampleRate, channels);
}

async function playPcmWithFfplay(pcm: Buffer, onEvent?: (event: ZilMateVoiceEvent) => void) {
  if (pcm.byteLength === 0) return;
  const file = join(tmpdir(), `zilmate-voice-${randomUUID()}.wav`);
  await writeFile(file, wavFromPcm(pcm));
  const player = spawn('ffplay', ['-hide_banner', '-loglevel', 'error', '-nodisp', '-autoexit', file], { windowsHide: true });
  let stderr = '';
  player.stderr.setEncoding('utf8');
  player.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  try {
    await waitForChildClose(player);
    if (player.exitCode && player.exitCode !== 0) {
      onEvent?.({
        type: 'error',
        message: `Audio playback failed: ${stderr || `ffplay exited with code ${player.exitCode}`}`,
        timestamp: new Date().toISOString(),
      });
    }
  } finally {
    await rm(file, { force: true });
  }
}

function playbackMode() {
  return env.zilmateVoicePlaybackMode === 'wav' ? 'wav' : 'stream';
}

function createStreamingPlayer(onEvent?: (event: ZilMateVoiceEvent) => void) {
  const player = spawn('ffplay', playbackArgs(), { windowsHide: true });
  let stderr = '';
  let bytes = 0;
  let started = false;
  player.stderr.setEncoding('utf8');
  player.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  player.on('error', (error) => {
    onEvent?.({
      type: 'error',
      message: `Audio playback failed to start: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: new Date().toISOString(),
    });
  });

  return {
    write: (chunk: Buffer) => {
      if (player.stdin.destroyed) return;
      if (!started) {
        player.stdin.write(streamingWavHeader());
        started = true;
      }
      bytes += chunk.byteLength;
      player.stdin.write(chunk);
    },
    finish: async () => {
      if (!player.stdin.destroyed) player.stdin.end();
      await waitForChildClose(player);
      if (player.exitCode && player.exitCode !== 0) {
        onEvent?.({
          type: 'error',
          message: `Audio playback failed: ${stderr || `ffplay exited with code ${player.exitCode}`}`,
          timestamp: new Date().toISOString(),
        });
      }
      return bytes;
    },
  };
}

async function* childStdout(child: ChildProcessWithoutNullStreams, signal: AbortSignal): AsyncIterable<Buffer> {
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  const onAbort = () => {
    if (!child.killed) child.kill('SIGTERM');
  };
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    for await (const chunk of child.stdout) {
      if (signal.aborted) break;
      yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    }
  } finally {
    signal.removeEventListener('abort', onAbort);
    if (!child.killed) child.kill('SIGTERM');
    const [code] = await once(child, 'close') as [number | null];
    if (!signal.aborted && code !== 0) {
      throw new Error(stderr || `ffmpeg microphone capture exited with code ${code}`);
    }
  }
}

async function waitForChildClose(child: ChildProcessWithoutNullStreams) {
  if (child.exitCode !== null || child.signalCode !== null || child.killed) return;
  await once(child, 'close');
}

export async function checkTerminalVoiceRuntime(): Promise<TerminalVoiceRuntimeCheck[]> {
  const checks: TerminalVoiceRuntimeCheck[] = [];
  const hasFfmpeg = await commandExists('ffmpeg');
  const hasFfplay = await commandExists('ffplay');
  checks.push({
    name: 'ffmpeg',
    ok: hasFfmpeg,
    detail: hasFfmpeg ? 'ffmpeg is available for microphone capture' : 'Install ffmpeg for terminal microphone capture',
  });
  checks.push({
    name: 'ffplay',
    ok: hasFfplay,
    detail: hasFfplay ? 'ffplay is available for spoken replies' : 'Install ffplay or a full ffmpeg build for spoken replies',
  });
  checks.push({
    name: 'Mic input',
    ok: true,
    detail: voiceInputDevice() || (process.platform === 'win32' ? 'auto-detect first microphone' : process.platform === 'darwin' ? ':0' : 'default'),
  });
  return checks;
}

export async function startTerminalVoiceSession(options: {
  sessionId?: string;
  onEvent?: (event: ZilMateVoiceEvent) => void;
  onUserTranscript: (text: string) => Promise<string | void> | string | void;
  onStopPrompt?: (stop: () => void) => void;
  onCommand?: (command: string) => void;
}) {
  const runtime = await checkTerminalVoiceRuntime();
  const missing = runtime.filter((check) => !check.ok);
  if (missing.length > 0) {
    throw new Error(`${missing.map((check) => `${check.name}: ${check.detail}`).join('; ')}. Run \`zilmate voice doctor\`.`);
  }

  const controller = new AbortController();
  const micInput = await resolveMicInput();
  options.onEvent?.({
    type: 'status',
    label: 'Microphone selected',
    detail: micInput,
    timestamp: new Date().toISOString(),
  });
  const mic = spawn('ffmpeg', micArgs(micInput), { windowsHide: true });
  let micStderr = '';
  mic.stderr.setEncoding('utf8');
  mic.stderr.on('data', (chunk) => {
    micStderr += chunk;
  });
  let playbackBytes = 0;
  let replyAudio: Buffer[] = [];
  let playbackQueue = Promise.resolve();
  let streamPlayer: ReturnType<typeof createStreamingPlayer> | undefined;

  const stop = () => {
    controller.abort();
    if (!mic.killed) mic.kill('SIGTERM');
  };

  let command: string | undefined;
  const stopOnCommand = (chunk: Buffer | string) => {
    const text = String(chunk).trim().toLowerCase();
    if (!text || text === '/voice -q' || text === '/voice off' || text === '/voice stop') {
      stop();
      return;
    }
    if (text === '/talk' || text === '/chat' || text === '/text') {
      command = 'talk';
      options.onCommand?.(command);
      stop();
      return;
    }
    if (text === '/exit' || text === '/quit') {
      command = 'exit';
      options.onCommand?.(command);
      stop();
      return;
    }
    options.onEvent?.({
      type: 'status',
      label: 'Voice command ignored',
      detail: 'Use /talk, /voice -q, or /exit',
      timestamp: new Date().toISOString(),
    });
  };

  options.onStopPrompt?.(stop);
  input.resume();
  input.on('data', stopOnCommand);

  try {
    await startCascadedVoiceSession({
      ...(options.sessionId !== undefined ? { sessionId: options.sessionId } : {}),
      audio: childStdout(mic, controller.signal),
      onEvent: (event) => {
        options.onEvent?.(event);
        if (event.type === 'status' && event.label === 'TTS audio flushed') {
          if (playbackMode() === 'stream') {
            const player = streamPlayer;
            streamPlayer = undefined;
            playbackQueue = playbackQueue.then(async () => {
              await player?.finish();
            }).catch((error) => {
              options.onEvent?.({
                type: 'error',
                message: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
              });
            });
          } else {
            const pcm = Buffer.concat(replyAudio);
            replyAudio = [];
            playbackQueue = playbackQueue.then(() => playPcmWithFfplay(pcm, options.onEvent)).catch((error) => {
              options.onEvent?.({
                type: 'error',
                message: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
              });
            });
          }
        }
      },
      onUserTranscript: options.onUserTranscript,
      onAudio: (chunk) => {
        playbackBytes += chunk.byteLength;
        const buffer = Buffer.from(chunk);
        if (playbackMode() === 'stream') {
          streamPlayer ??= createStreamingPlayer(options.onEvent);
          streamPlayer.write(buffer);
        } else {
          replyAudio.push(buffer);
        }
      },
    });
    await playbackQueue;
  } finally {
    input.off('data', stopOnCommand);
    stop();
    if (mic.exitCode && mic.exitCode !== 0 && micStderr) {
      options.onEvent?.({
        type: 'error',
        message: `Microphone capture failed: ${micStderr}`,
        timestamp: new Date().toISOString(),
      });
    }
    if (playbackBytes === 0) {
      options.onEvent?.({
        type: 'status',
        label: 'No TTS audio received',
        detail: 'Deepgram did not send playable audio bytes before the session ended',
        timestamp: new Date().toISOString(),
      });
    }
  }
  return { command };
}

export async function playTerminalSpeech(text: string, options: {
  onEvent?: (event: ZilMateVoiceEvent) => void;
} = {}) {
  const runtime = await checkTerminalVoiceRuntime();
  const missing = runtime.filter((check) => check.name === 'ffplay' && !check.ok);
  if (missing.length > 0) {
    throw new Error(`${missing.map((check) => `${check.name}: ${check.detail}`).join('; ')}. Run \`zilmate voice doctor\`.`);
  }

  let audio: Buffer[] = [];
  const streamPlayer = playbackMode() === 'stream' ? createStreamingPlayer(options.onEvent) : undefined;

  const result = await speakWithDeepgram(text, {
    ...(options.onEvent !== undefined ? { onEvent: options.onEvent } : {}),
    onAudio: (chunk) => {
      const buffer = Buffer.from(chunk);
      if (streamPlayer) {
        streamPlayer.write(buffer);
      } else {
        audio.push(buffer);
      }
    },
  });

  if (streamPlayer) {
    await streamPlayer.finish();
  } else {
    await playPcmWithFfplay(Buffer.concat(audio), options.onEvent);
  }
  return result;
}
