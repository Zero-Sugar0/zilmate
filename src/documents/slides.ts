import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pptxgenModule from 'pptxgenjs';
import { workspaceLayout } from '../workspace/paths.js';

const PptxGenJS = (pptxgenModule as unknown as { default: typeof pptxgenModule }).default ?? pptxgenModule;

export type SlideInput = {
  title: string;
  markdown: string;
  theme?: 'dark' | 'light' | 'zilmate';
  filename?: string;
};

type SlideLike = {
  background: { color: string };
  addText: (text: string, opts: Record<string, unknown>) => void;
  addShape: (shape: string, opts: Record<string, unknown>) => void;
};

function parseSlides(markdown: string) {
  const chunks = markdown.split(/\n---+\n/).map((chunk) => chunk.trim()).filter(Boolean);
  return chunks.map((chunk) => {
    const lines = chunk.split('\n');
    let title = '';
    const body: string[] = [];
    for (const line of lines) {
      const heading = /^#{1,2}\s+(.+)/.exec(line);
      if (heading && !title) {
        title = heading[1]!.trim();
        continue;
      }
      body.push(line.replace(/^[-*]\s+/, '• '));
    }
    return { title: title || 'Slide', body: body.join('\n').trim() };
  });
}

const themes = {
  dark: { bg: '1E1E2E', title: '89B4FA', text: 'CDD6F4', accent: 'F5C2E7' },
  light: { bg: 'FFFFFF', title: '1E66F5', text: '1E1E2E', accent: '8839EF' },
  zilmate: { bg: '0F172A', title: '22D3EE', text: 'E2E8F0', accent: 'A78BFA' },
};

export async function generateSlideDeck(input: SlideInput) {
  const slides = parseSlides(input.markdown);
  if (slides.length === 0) {
    slides.push({ title: input.title, body: input.markdown.trim() });
  }

  const theme = themes[input.theme ?? 'zilmate'];
  const PptxCtor = PptxGenJS as unknown as { new(): { author: string; title: string; layout: string; addSlide: () => SlideLike; writeFile: (opts: { fileName: string }) => Promise<void> } };
  const pptx = new PptxCtor();
  pptx.author = 'ZilMate';
  pptx.title = input.title;
  pptx.layout = 'LAYOUT_16x9';

  for (const slideData of slides) {
    const slide = pptx.addSlide();
    slide.background = { color: theme.bg };
    slide.addText(slideData.title, {
      x: 0.5,
      y: 0.4,
      w: 9,
      h: 1,
      fontSize: 32,
      bold: true,
      color: theme.title,
      fontFace: 'Arial',
    });
    if (slideData.body) {
      slide.addText(slideData.body, {
        x: 0.6,
        y: 1.5,
        w: 8.8,
        h: 4.5,
        fontSize: 18,
        color: theme.text,
        fontFace: 'Arial',
        valign: 'top',
      });
    }
    slide.addShape('rect', {
      x: 0.5,
      y: 5.2,
      w: 2,
      h: 0.08,
      fill: { color: theme.accent },
      line: { color: theme.accent },
    });
  }

  const outDir = path.join(workspaceLayout().outputs, 'slides');
  await mkdir(outDir, { recursive: true });
  const filename = input.filename || `${input.title.replace(/[^\w.-]+/g, '-').slice(0, 60)}.pptx`;
  const filePath = path.join(outDir, filename.endsWith('.pptx') ? filename : `${filename}.pptx`);
  await pptx.writeFile({ fileName: filePath });

  const mdPath = filePath.replace(/\.pptx$/i, '.md');
  await writeFile(mdPath, input.markdown, 'utf8');

  return { path: filePath, markdownPath: mdPath, slideCount: slides.length, format: 'pptx' as const };
}
