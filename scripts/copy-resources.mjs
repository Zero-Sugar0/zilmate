import { copyFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');

const srcPs1 = join(projectRoot, 'src', 'daemon', 'win-listener.ps1');
const destPs = join(projectRoot, 'dist', 'daemon', 'win-listener.ps1');

try {
  mkdirSync(dirname(destPs), { recursive: true });
  copyFileSync(srcPs1, destPs);
  console.log('✓ Copied win-listener.ps1 to dist/daemon/');
} catch (error) {
  console.error('Failed to copy win-listener.ps1:', error);
  process.exit(1);
}
