import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';
import { tool } from 'ai';
import { z } from 'zod';
import { emitProgress } from '../runtime/progress.js';
import { resolveWorkspaceRoot } from '../workspace/paths.js';
import { env } from '../config/env.js';

const execFileAsync = promisify(execFile);

async function commandExists(command: string) {
  const probe = process.platform === 'win32' ? 'where.exe' : 'which';
  try {
    await execFileAsync(probe, [command], { windowsHide: true, timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export const multimediaTools = {
  transcodeVideo: tool({
    description: 'Process and transcode local video files using FFmpeg (resize, adjust FPS, trim duration, change video codec). Works on Windows, macOS, and Linux.',
    inputSchema: z.object({
      inputPath: z.string().min(1).describe('Relative or absolute path to the input video file in the workspace.'),
      outputPath: z.string().min(1).describe('Relative or absolute path to save the output processed video file in the workspace.'),
      resolution: z.string().optional().describe('Output resolution (e.g., "1280x720", "640x480", "1920x1080").'),
      fps: z.number().int().min(1).max(120).optional().describe('Frame rate for output video (e.g., 24, 30, 60).'),
      durationSeconds: z.number().min(0.5).optional().describe('Duration to trim video to, in seconds.'),
      codec: z.string().optional().describe('Video codec to use (e.g., "libx264", "libx265", "copy"). Default is libx264.'),
    }),
    execute: async ({ inputPath, outputPath, resolution, fps, durationSeconds, codec }) => {
      emitProgress({ type: 'tool:start', label: 'Transcoding video', detail: inputPath });

      const hasFfmpeg = await commandExists('ffmpeg');
      if (!hasFfmpeg) {
        emitProgress({ type: 'tool:error', label: 'Transcode failed', detail: 'FFmpeg not found' });
        return { error: 'FFmpeg is not installed or available on your system PATH.' };
      }

      const root = resolveWorkspaceRoot();
      const resolvedInput = path.isAbsolute(inputPath) ? inputPath : path.join(root, inputPath);
      const resolvedOutput = path.isAbsolute(outputPath) ? outputPath : path.join(root, outputPath);

      if (!existsSync(resolvedInput)) {
        emitProgress({ type: 'tool:error', label: 'Transcode failed', detail: 'Input file not found' });
        return { error: `Input video file not found at path: ${inputPath}` };
      }

      // Ensure directory of output exists
      const outputDir = path.dirname(resolvedOutput);
      if (!existsSync(outputDir)) {
        const fs = await import('node:fs/promises');
        await fs.mkdir(outputDir, { recursive: true });
      }

      try {
        const args = ['-y', '-i', resolvedInput];

        if (codec) {
          args.push('-vcodec', codec);
        } else {
          args.push('-vcodec', 'libx264');
        }

        if (resolution) {
          args.push('-s', resolution);
        }

        if (fps) {
          args.push('-r', String(fps));
        }

        if (durationSeconds) {
          args.push('-t', String(durationSeconds));
        }

        args.push(resolvedOutput);

        await execFileAsync('ffmpeg', args, { windowsHide: true, timeout: 120000 });

        emitProgress({ type: 'tool:end', label: 'Transcode complete', detail: outputPath });
        return {
          success: true,
          inputPath,
          outputPath: resolvedOutput,
        };
      } catch (error: any) {
        emitProgress({ type: 'tool:error', label: 'Transcode failed', detail: error.message });
        return {
          success: false,
          error: 'Video transcoding failed.',
          rawError: error.message,
        };
      }
    },
  }),

  extractAudio: tool({
    description: 'Extract the audio track from a local video file as an MP3 audio file using FFmpeg. Works on Windows, macOS, and Linux.',
    inputSchema: z.object({
      videoPath: z.string().min(1).describe('Relative or absolute path to the input video file in the workspace.'),
      audioOutputPath: z.string().min(1).describe('Relative or absolute path to save the extracted MP3 file in the workspace.'),
    }),
    execute: async ({ videoPath, audioOutputPath }) => {
      emitProgress({ type: 'tool:start', label: 'Extracting audio', detail: videoPath });

      const hasFfmpeg = await commandExists('ffmpeg');
      if (!hasFfmpeg) {
        emitProgress({ type: 'tool:error', label: 'Extraction failed', detail: 'FFmpeg not found' });
        return { error: 'FFmpeg is not installed or available on your system PATH.' };
      }

      const root = resolveWorkspaceRoot();
      const resolvedVideo = path.isAbsolute(videoPath) ? videoPath : path.join(root, videoPath);
      const resolvedAudio = path.isAbsolute(audioOutputPath) ? audioOutputPath : path.join(root, audioOutputPath);

      if (!existsSync(resolvedVideo)) {
        emitProgress({ type: 'tool:error', label: 'Extraction failed', detail: 'Input file not found' });
        return { error: `Input video file not found at path: ${videoPath}` };
      }

      // Ensure directory of output exists
      const outputDir = path.dirname(resolvedAudio);
      if (!existsSync(outputDir)) {
        const fs = await import('node:fs/promises');
        await fs.mkdir(outputDir, { recursive: true });
      }

      try {
        // -vn disables video, -acodec libmp3lame encodes to mp3, -q:a 2 is high quality variable bitrate (around 190 kbps)
        const args = ['-y', '-i', resolvedVideo, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', resolvedAudio];

        await execFileAsync('ffmpeg', args, { windowsHide: true, timeout: 60000 });

        emitProgress({ type: 'tool:end', label: 'Audio extraction complete', detail: audioOutputPath });
        return {
          success: true,
          videoPath,
          audioOutputPath: resolvedAudio,
        };
      } catch (error: any) {
        emitProgress({ type: 'tool:error', label: 'Extraction failed', detail: error.message });
        return {
          success: false,
          error: 'Audio extraction failed.',
          rawError: error.message,
        };
      }
    },
  }),

  speechToText: tool({
    description: 'Transcribe a local audio file (WAV, MP3, M4A, etc.) to text using Deepgram or OpenAI Whisper APIs. Works on Windows, macOS, and Linux.',
    inputSchema: z.object({
      audioPath: z.string().min(1).describe('Relative or absolute path to the local audio file in the workspace.'),
      language: z.string().optional().describe('Optional language tag (e.g., "en", "es", "fr").'),
    }),
    execute: async ({ audioPath, language }) => {
      emitProgress({ type: 'fetch:start', label: 'Transcribing audio', detail: audioPath });

      const root = resolveWorkspaceRoot();
      const resolvedAudio = path.isAbsolute(audioPath) ? audioPath : path.join(root, audioPath);

      if (!existsSync(resolvedAudio)) {
        emitProgress({ type: 'fetch:end', label: 'Transcription failed', detail: 'File not found' });
        return { error: `Audio file not found at path: ${audioPath}` };
      }

      let audioBuffer: Buffer;
      try {
        audioBuffer = await readFile(resolvedAudio);
      } catch (error: any) {
        return { error: `Failed to read audio file: ${error.message}` };
      }

      // Fallback strategy 1: Deepgram API
      if (env.deepgramApiKey) {
        try {
          const model = env.zilmateVoiceListenModel || 'nova-2';
          const queryParams = new URLSearchParams({
            model,
            smart_format: 'true',
            ...(language ? { language } : {}),
          });

          const url = `https://api.deepgram.com/v1/listen?${queryParams.toString()}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Token ${env.deepgramApiKey}`,
              'Content-Type': 'audio/wav',
            },
            body: audioBuffer,
          });

          if (response.ok) {
            const data = (await response.json()) as any;
            const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
            const confidence = data.results?.channels?.[0]?.alternatives?.[0]?.confidence || 1.0;

            emitProgress({ type: 'fetch:end', label: 'Transcription successful', detail: 'Deepgram' });
            return {
              audioPath,
              provider: 'deepgram',
              model,
              confidence,
              transcript,
            };
          } else {
            const errBody = await response.text().catch(() => '');
            emitProgress({ type: 'tool:error', label: 'Deepgram transcribe failed', detail: `HTTP ${response.status}` });
          }
        } catch (error: any) {
          emitProgress({ type: 'tool:error', label: 'Deepgram transcribe failed', detail: error.message });
        }
      }

      // Fallback strategy 2: OpenAI Whisper API if standard OPENAI_API_KEY is present
      if (process.env.OPENAI_API_KEY) {
        try {
          // Build multipart form-data request manually to avoid extra dependencies
          const boundary = `----ZilMateSTTBoundary${Date.now().toString(16)}`;
          const filename = path.basename(resolvedAudio);
          const extension = path.extname(resolvedAudio).toLowerCase().replace('.', '');
          const mimeType = ['wav', 'mp3', 'm4a', 'webm', 'ogg'].includes(extension) ? `audio/${extension}` : 'application/octet-stream';

          const header = [
            `--${boundary}`,
            `Content-Disposition: form-data; name="model"`,
            '',
            'whisper-1',
            `--${boundary}`,
            `Content-Disposition: form-data; name="file"; filename="${filename}"`,
            `Content-Type: ${mimeType}`,
            '',
            '',
          ].join('\r\n');

          const footer = `\r\n--${boundary}--\r\n`;

          const postBody = Buffer.concat([
            Buffer.from(header, 'utf-8'),
            audioBuffer,
            Buffer.from(footer, 'utf-8'),
          ]);

          const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': `multipart/form-data; boundary=${boundary}`,
            },
            body: postBody,
          });

          if (response.ok) {
            const data = (await response.json()) as any;
            emitProgress({ type: 'fetch:end', label: 'Transcription successful', detail: 'OpenAI' });
            return {
              audioPath,
              provider: 'openai',
              model: 'whisper-1',
              transcript: data.text || '',
            };
          } else {
            const errBody = await response.text().catch(() => '');
            emitProgress({ type: 'tool:error', label: 'OpenAI transcribe failed', detail: `HTTP ${response.status}` });
          }
        } catch (error: any) {
          emitProgress({ type: 'tool:error', label: 'OpenAI transcribe failed', detail: error.message });
        }
      }

      emitProgress({ type: 'tool:error', label: 'Transcription failed', detail: 'No active API keys found' });
      return {
        error: 'No active transcription providers available. Please configure DEEPGRAM_API_KEY or OPENAI_API_KEY in your env to enable audio transcription.',
      };
    },
  }),

  optimizeImage: tool({
    description: 'Compress, resize, or convert local images (PNG, JPEG, WEBP, GIF) to follow web optimization and SEO guidelines with optional watermark overlays. Uses local FFmpeg for lightweight, native performance.',
    inputSchema: z.object({
      imagePath: z.string().min(1).describe('Relative or absolute path to the local input image file in the workspace.'),
      outputPath: z.string().min(1).describe('Relative or absolute path to save the optimized output image file.'),
      maxWidth: z.number().int().min(10).max(8000).optional().describe('Maximum width constraint (maintains aspect ratio).'),
      maxHeight: z.number().int().min(10).max(8000).optional().describe('Maximum height constraint (maintains aspect ratio).'),
      quality: z.number().int().min(1).max(100).optional().default(80).describe('Optimization quality (1-100). Default is 80.'),
      format: z.enum(['webp', 'jpeg', 'png']).optional().describe('Target image format. If not specified, keeps the original format.'),
      watermarkText: z.string().optional().describe('Optional custom text watermark to overlay on the bottom-right corner of the image.'),
    }),
    execute: async ({ imagePath, outputPath, maxWidth, maxHeight, quality, format, watermarkText }) => {
      emitProgress({ type: 'tool:start', label: 'Optimizing image', detail: imagePath });

      const hasFfmpeg = await commandExists('ffmpeg');
      if (!hasFfmpeg) {
        emitProgress({ type: 'tool:error', label: 'Optimize failed', detail: 'FFmpeg not found' });
        return { error: 'FFmpeg is not installed or available on your system PATH.' };
      }

      const root = resolveWorkspaceRoot();
      const resolvedInput = path.isAbsolute(imagePath) ? imagePath : path.join(root, imagePath);
      const resolvedOutput = path.isAbsolute(outputPath) ? outputPath : path.join(root, outputPath);

      if (!existsSync(resolvedInput)) {
        emitProgress({ type: 'tool:error', label: 'Optimize failed', detail: 'Input file not found' });
        return { error: `Input image file not found at path: ${imagePath}` };
      }

      const outputDir = path.dirname(resolvedOutput);
      if (!existsSync(outputDir)) {
        const fs = await import('node:fs/promises');
        await fs.mkdir(outputDir, { recursive: true });
      }

      try {
        const args = ['-y', '-i', resolvedInput];

        let scaleFilter = '';
        if (maxWidth && maxHeight) {
          scaleFilter = `scale='min(${maxWidth},iw)':'min(${maxHeight},ih)':force_original_aspect_ratio=decrease`;
        } else if (maxWidth) {
          scaleFilter = `scale='min(${maxWidth},iw)':-1`;
        } else if (maxHeight) {
          scaleFilter = `scale=-1:'min(${maxHeight},ih)'`;
        }

        let filtergraph = '';
        if (scaleFilter) {
          filtergraph = scaleFilter;
        }

        if (watermarkText) {
          // Escape single quotes, backslashes, colons, and percent signs for FFmpeg's drawtext filter
          const escapedWatermark = watermarkText
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "'\\''")
            .replace(/:/g, '\\:')
            .replace(/%/g, '\\%');

          const drawtextFilter = `drawtext=text='${escapedWatermark}':x=w-tw-15:y=h-th-15:fontsize=h/25:fontcolor=white:box=1:boxcolor=black@0.4`;
          filtergraph = filtergraph ? `${filtergraph},${drawtextFilter}` : drawtextFilter;
        }

        if (filtergraph) {
          args.push('-vf', filtergraph);
        }

        const ext = format || path.extname(resolvedOutput).toLowerCase().replace('.', '') || 'webp';
        
        if (ext === 'webp') {
          args.push('-quality', String(quality));
        } else if (ext === 'jpeg' || ext === 'jpg') {
          const qscale = Math.max(1, Math.min(31, Math.round(31 - (quality * 30 / 100))));
          args.push('-qscale:v', String(qscale));
        } else if (ext === 'png') {
          const compression = Math.max(0, Math.min(9, Math.round(9 - (quality * 9 / 100))));
          args.push('-compression_level', String(compression));
        }

        args.push(resolvedOutput);

        emitProgress({ type: 'step', label: `Executing: ffmpeg ${args.join(' ')}` });

        await execFileAsync('ffmpeg', args, { windowsHide: true, timeout: 20000 });

        emitProgress({ type: 'tool:end', label: 'Image optimization complete', detail: outputPath });
        return {
          success: true,
          imagePath,
          outputPath: resolvedOutput,
          quality,
          watermarked: !!watermarkText,
        };
      } catch (error: any) {
        emitProgress({ type: 'tool:error', label: 'Optimize failed', detail: error.message });
        return {
          success: false,
          error: 'Image optimization failed.',
          rawError: error.message,
        };
      }
    },
  }),

  textToSpeech: tool({
    description: 'Convert written text into high-quality spoken audio (MP3) using Deepgram, OpenAI, or local offline OS synthesizers. Works on Windows, macOS, and Linux.',
    inputSchema: z.object({
      text: z.string().min(1).describe('The text to convert to speech.'),
      outputPath: z.string().min(1).describe('Relative or absolute path to save the generated MP3 file.'),
      voice: z.string().optional().describe('Optional voice name (Deepgram: "aura-asteria-en", "aura-2-thalia-en"; OpenAI: "alloy", "echo", "fable", "onyx", "nova", "shimmer").'),
    }),
    execute: async ({ text, outputPath, voice }) => {
      emitProgress({ type: 'tool:start', label: 'Generating speech', detail: outputPath });

      const root = resolveWorkspaceRoot();
      const resolvedOutput = path.isAbsolute(outputPath) ? outputPath : path.join(root, outputPath);

      const outputDir = path.dirname(resolvedOutput);
      if (!existsSync(outputDir)) {
        const fs = await import('node:fs/promises');
        await fs.mkdir(outputDir, { recursive: true });
      }

      const { createWriteStream } = await import('node:fs');
      const { pipeline } = await import('node:stream/promises');
      const { Readable } = await import('node:stream');

      // TIER 1: Deepgram Text-to-Speech API
      if (env.deepgramApiKey) {
        try {
          emitProgress({ type: 'step', label: 'Generating speech using Deepgram Aura-2' });
          const dgVoice = voice || env.zilmateVoiceTtsModel || 'aura-2-thalia-en';
          const response = await fetch(`https://api.deepgram.com/v1/speak?model=${dgVoice}`, {
            method: 'POST',
            headers: {
              'Authorization': `Token ${env.deepgramApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
          });

          if (response.ok) {
            if (!response.body) throw new Error('Response body is empty.');
            const fileStream = createWriteStream(resolvedOutput);
            await pipeline(Readable.fromWeb(response.body as any), fileStream);

            emitProgress({ type: 'tool:end', label: 'Speech generated successfully', detail: outputPath });
            return { success: true, provider: 'deepgram', model: dgVoice, outputPath: resolvedOutput };
          } else {
            const errBody = await response.text().catch(() => '');
            emitProgress({ type: 'step', label: 'Deepgram TTS failed', detail: `HTTP ${response.status}: ${errBody}` });
          }
        } catch (error: any) {
          emitProgress({ type: 'step', label: 'Deepgram TTS execution failed', detail: error.message });
        }
      }

      // TIER 2: OpenAI Text-to-Speech API
      if (process.env.OPENAI_API_KEY) {
        try {
          emitProgress({ type: 'step', label: 'Generating speech using OpenAI TTS' });
          const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'tts-1',
              input: text,
              voice: voice || 'alloy',
            }),
          });

          if (response.ok) {
            if (!response.body) throw new Error('Response body is empty.');
            const fileStream = createWriteStream(resolvedOutput);
            await pipeline(Readable.fromWeb(response.body as any), fileStream);

            emitProgress({ type: 'tool:end', label: 'Speech generated successfully', detail: outputPath });
            return { success: true, provider: 'openai', model: 'tts-1', outputPath: resolvedOutput };
          } else {
            const errBody = await response.text().catch(() => '');
            emitProgress({ type: 'step', label: 'OpenAI TTS failed', detail: `HTTP ${response.status}: ${errBody}` });
          }
        } catch (error: any) {
          emitProgress({ type: 'step', label: 'OpenAI TTS execution failed', detail: error.message });
        }
      }

      // TIER 3: Local Offline Speech Synthesis Fallback
      emitProgress({ type: 'step', label: 'Pivoting to offline local speech synthesis fallback' });
      const platform = process.platform;
      const isWin = platform === 'win32';
      const isMac = platform === 'darwin';
      const hasFfmpeg = await commandExists('ffmpeg');

      try {
        const tempWav = path.join(path.dirname(resolvedOutput), `temp-speech-${Date.now()}.wav`);
        const tempAiff = path.join(path.dirname(resolvedOutput), `temp-speech-${Date.now()}.aiff`);

        if (isWin) {
          emitProgress({ type: 'step', label: 'Executing PowerShell SAPI offline synth' });
          const psCommand = `Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.SetOutputToWaveFile('${tempWav}'); $synth.Speak('${text.replace(/'/g, "''").replace(/\r?\n/g, ' ')}'); $synth.Dispose();`;
          await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCommand], { windowsHide: true, timeout: 30000 });
          
          if (existsSync(tempWav)) {
            if (hasFfmpeg) {
              await execFileAsync('ffmpeg', ['-y', '-i', tempWav, '-acodec', 'libmp3lame', resolvedOutput], { windowsHide: true, timeout: 15000 });
              const { unlink } = await import('node:fs/promises');
              await unlink(tempWav).catch(() => {});
            } else {
              const { rename } = await import('node:fs/promises');
              await rename(tempWav, resolvedOutput);
              emitProgress({ type: 'step', label: 'Offline speech generated without FFmpeg conversion' });
            }
            emitProgress({ type: 'tool:end', label: 'Offline speech generated successfully (Windows SAPI)', detail: outputPath });
            return { success: true, provider: 'local-offline', model: 'windows-sapi', outputPath: resolvedOutput };
          }
        } else if (isMac) {
          emitProgress({ type: 'step', label: 'Executing macOS say offline synth' });
          await execFileAsync('say', ['-o', tempAiff, text], { timeout: 30000 });
          
          if (existsSync(tempAiff)) {
            if (hasFfmpeg) {
              await execFileAsync('ffmpeg', ['-y', '-i', tempAiff, '-acodec', 'libmp3lame', resolvedOutput], { windowsHide: true, timeout: 15000 });
              const { unlink } = await import('node:fs/promises');
              await unlink(tempAiff).catch(() => {});
            } else {
              const { rename } = await import('node:fs/promises');
              await rename(tempAiff, resolvedOutput);
              emitProgress({ type: 'step', label: 'Offline speech generated without FFmpeg conversion' });
            }
            emitProgress({ type: 'tool:end', label: 'Offline speech generated successfully (macOS say)', detail: outputPath });
            return { success: true, provider: 'local-offline', model: 'macos-say', outputPath: resolvedOutput };
          }
        } else {
          emitProgress({ type: 'step', label: 'Executing Linux espeak offline synth' });
          const hasEspeak = await commandExists('espeak');
          if (hasEspeak) {
            await execFileAsync('espeak', ['-w', tempWav, text], { timeout: 30000 });
            if (existsSync(tempWav)) {
              if (hasFfmpeg) {
                await execFileAsync('ffmpeg', ['-y', '-i', tempWav, '-acodec', 'libmp3lame', resolvedOutput], { windowsHide: true, timeout: 15000 });
                const { unlink } = await import('node:fs/promises');
                await unlink(tempWav).catch(() => {});
              } else {
                const { rename } = await import('node:fs/promises');
                await rename(tempWav, resolvedOutput);
              }
              emitProgress({ type: 'tool:end', label: 'Offline speech generated successfully (Linux espeak)', detail: outputPath });
              return { success: true, provider: 'local-offline', model: 'linux-espeak', outputPath: resolvedOutput };
            }
          } else {
            const hasFestival = await commandExists('festival');
            if (hasFestival) {
              const hasText2wave = await commandExists('text2wave');
              if (hasText2wave) {
                const tempTxt = path.join(path.dirname(resolvedOutput), `temp-speech-${Date.now()}.txt`);
                const { writeFile: writeTxtFile, unlink: deleteTxtFile } = await import('node:fs/promises');
                await writeTxtFile(tempTxt, text, 'utf8');
                await execFileAsync('text2wave', [tempTxt, '-o', tempWav], { timeout: 30000 });
                await deleteTxtFile(tempTxt).catch(() => {});
                if (existsSync(tempWav)) {
                  if (hasFfmpeg) {
                    await execFileAsync('ffmpeg', ['-y', '-i', tempWav, '-acodec', 'libmp3lame', resolvedOutput], { windowsHide: true, timeout: 15000 });
                    const { unlink } = await import('node:fs/promises');
                    await unlink(tempWav).catch(() => {});
                  } else {
                    const { rename } = await import('node:fs/promises');
                    await rename(tempWav, resolvedOutput);
                  }
                  emitProgress({ type: 'tool:end', label: 'Offline speech generated successfully (Linux festival)', detail: outputPath });
                  return { success: true, provider: 'local-offline', model: 'linux-festival', outputPath: resolvedOutput };
                }
              }
            }
          }
        }
      } catch (offlineError: any) {
        emitProgress({ type: 'step', label: 'Offline synthesis failed', detail: offlineError.message });
      }

      emitProgress({ type: 'tool:error', label: 'Speech generation failed', detail: 'No providers or offline fallbacks succeeded' });
      return {
        error: 'No active speech providers available, and local offline speech synthesis failed or is not configured on this OS.',
      };
    },
  }),
};
