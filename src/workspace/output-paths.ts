import { workspaceLayout } from './paths.js';
import path from 'node:path';

export function getOutputDir(kind: 'osint' | 'pentest' | 'images' | 'screenshots' | 'camera' | 'computer-use' | 'browser') {
  const layout = workspaceLayout();
  const map = {
    osint: layout.osint,
    pentest: layout.pentest,
    images: layout.images,
    screenshots: path.join(layout.outputs, 'screenshots'),
    camera: path.join(layout.outputs, 'camera'),
    'computer-use': path.join(layout.outputs, 'computer-use'),
    browser: path.join(layout.outputs, 'browser'),
  } as const;
  return map[kind];
}

export function getWorkspaceRoot() {
  return workspaceLayout().root;
}
