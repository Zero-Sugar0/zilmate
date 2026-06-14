import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { createWriteStream } from 'node:fs';
import { workspaceLayout } from '../workspace/paths.js';

export type PdfInput = {
  title: string;
  markdown: string;
  filename?: string;
};

function markdownToBlocks(markdown: string) {
  const lines = markdown.split('\n');
  const blocks: Array<{ type: 'h1' | 'h2' | 'h3' | 'p' | 'li'; text: string }> = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('# ')) blocks.push({ type: 'h1', text: trimmed.slice(2) });
    else if (trimmed.startsWith('## ')) blocks.push({ type: 'h2', text: trimmed.slice(3) });
    else if (trimmed.startsWith('### ')) blocks.push({ type: 'h3', text: trimmed.slice(4) });
    else if (/^[-*]\s+/.test(trimmed)) blocks.push({ type: 'li', text: trimmed.replace(/^[-*]\s+/, '') });
    else blocks.push({ type: 'p', text: trimmed });
  }
  return blocks;
}

export async function generatePdfDocument(input: PdfInput) {
  const outDir = path.join(workspaceLayout().outputs, 'pdf');
  await mkdir(outDir, { recursive: true });
  const filename = input.filename || `${input.title.replace(/[^\w.-]+/g, '-').slice(0, 60)}.pdf`;
  const filePath = path.join(outDir, filename.endsWith('.pdf') ? filename : `${filename}.pdf`);

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 54, size: 'A4' });
    const stream = createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(22).fillColor('#0F172A').text(input.title, { align: 'left' });
    doc.moveDown(0.5);
    doc.moveTo(54, doc.y).lineTo(541, doc.y).strokeColor('#22D3EE').lineWidth(2).stroke();
    doc.moveDown(1);

    for (const block of markdownToBlocks(input.markdown)) {
      if (doc.y > 720) doc.addPage();
      if (block.type === 'h1') {
        doc.moveDown(0.5).fontSize(18).fillColor('#1E293B').text(block.text);
      } else if (block.type === 'h2') {
        doc.moveDown(0.4).fontSize(15).fillColor('#334155').text(block.text);
      } else if (block.type === 'h3') {
        doc.moveDown(0.3).fontSize(13).fillColor('#475569').text(block.text);
      } else if (block.type === 'li') {
        doc.fontSize(11).fillColor('#334155').text(`• ${block.text}`, { indent: 12 });
      } else {
        doc.moveDown(0.2).fontSize(11).fillColor('#334155').text(block.text, { align: 'left' });
      }
    }

    doc.end();
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  return { path: filePath, format: 'pdf' as const, pageEstimate: Math.max(1, Math.ceil(input.markdown.length / 2500)) };
}
