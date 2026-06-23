import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { tool } from 'ai';
import { z } from 'zod';
import { emitProgress } from '../runtime/progress.js';
import { getOutputDir } from '../workspace/output-paths.js';
import { existsSync } from 'node:fs';

const execFileAsync = promisify(execFile);
const outputDir = getOutputDir('images');

async function runRembg(inputPath: string, outputPath: string) {
  const pyScript = `
from rembg import remove
from PIL import Image
import os

input_path = '${inputPath.replace(/\\/g, '\\\\')}'
output_path = '${outputPath.replace(/\\/g, '\\\\')}'

with open(input_path, 'rb') as i:
    input_data = i.read()
    output_data = remove(input_data)
    with open(output_path, 'wb') as o:
        o.write(output_data)
`.trim();

  const tempScriptPath = path.join(outputDir, `rembg-${Date.now()}.py`);
  await writeFile(tempScriptPath, pyScript, 'utf8');

  try {
    const py = process.platform === 'win32' ? 'python' : 'python3';
    await execFileAsync(py, [tempScriptPath], { timeout: 60000 });
  } finally {
    // Note: In production we might want to keep logs or cleanup
  }
}

export const imageIntelligenceTools = {
  removeBackground: tool({
    description: 'Remove the background from an image using professional-grade AI (rembg). Supports local files and returns a transparent PNG.',
    inputSchema: z.object({
      imagePath: z.string().describe('Absolute path to the input image file (JPG, PNG, etc.).'),
      outputFileName: z.string().optional().describe('Optional custom name for the output file (without extension).'),
    }),
    execute: async ({ imagePath, outputFileName }) => {
      if (!existsSync(imagePath)) throw new Error(`Input image not found: ${imagePath}`);

      emitProgress({ type: 'tool:start', label: 'Removing background', detail: imagePath });

      await mkdir(outputDir, { recursive: true });
      const name = outputFileName || `nobg-${path.basename(imagePath, path.extname(imagePath))}`;
      const outputPath = path.join(outputDir, `${name}-${Date.now()}.png`);

      await runRembg(imagePath, outputPath);

      emitProgress({ type: 'tool:end', label: 'Background removed', detail: outputPath });

      return {
        inputPath: imagePath,
        outputPath,
        format: 'transparent-png',
        status: 'success'
      };
    },
  }),
};
