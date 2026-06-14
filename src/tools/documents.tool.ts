import { tool } from 'ai';
import { z } from 'zod';
import { generateText } from 'ai';
import { models } from '../config/models.js';
import { emitProgress } from '../runtime/progress.js';
import { generatePdfDocument } from '../documents/pdf.js';
import { generateSlideDeck } from '../documents/slides.js';

async function expandContent(kind: 'pdf' | 'slides', title: string, content: string, audience?: string) {
  const result = await generateText({
    model: models.manager,
    prompt: `Create ${kind === 'slides' ? 'a slide deck' : 'a document'} titled "${title}".
Audience: ${audience || 'general'}
Source notes:
${content}

${kind === 'slides'
  ? 'Return markdown with slides separated by --- lines. Each slide: # title then bullet points. 6-12 slides.'
  : 'Return polished markdown with # title, ## sections, paragraphs, and bullet lists.'}`,
  });
  return result.text.trim();
}

export const documentTools = {
  generatePdf: tool({
    description: 'Generate a PDF report/document from markdown or a topic brief. Saves to workspace outputs/pdf/.',
    inputSchema: z.object({
      title: z.string().min(2),
      content: z.string().min(10).describe('Markdown body or brief to expand'),
      expandWithAi: z.boolean().optional().describe('Use AI to expand brief into full document'),
      audience: z.string().optional(),
      filename: z.string().optional(),
    }),
    execute: async ({ title, content, expandWithAi, audience, filename }) => {
      emitProgress({ type: 'step', label: 'Generating PDF', detail: title });
      const markdown = expandWithAi ? await expandContent('pdf', title, content, audience) : content;
      const result = await generatePdfDocument({ title, markdown, ...(filename ? { filename } : {}) });
      return { ...result, title, bytesEstimate: markdown.length };
    },
  }),

  generateSlideDeck: tool({
    description: 'Generate a PowerPoint (.pptx) slide deck from markdown (--- between slides) or a topic brief. Kimi-style decks saved to workspace outputs/slides/.',
    inputSchema: z.object({
      title: z.string().min(2),
      content: z.string().min(10).describe('Markdown slides or brief to expand'),
      expandWithAi: z.boolean().optional(),
      theme: z.enum(['dark', 'light', 'zilmate']).optional(),
      audience: z.string().optional(),
      filename: z.string().optional(),
    }),
    execute: async ({ title, content, expandWithAi, theme, audience, filename }) => {
      emitProgress({ type: 'step', label: 'Generating slide deck', detail: title });
      const markdown = expandWithAi ? await expandContent('slides', title, content, audience) : content;
      const result = await generateSlideDeck({
        title,
        markdown,
        theme: theme ?? 'zilmate',
        ...(filename ? { filename } : {}),
      });
      return { ...result, title, hint: 'Open the .pptx in PowerPoint, Keynote, or Google Slides.' };
    },
  }),
};
