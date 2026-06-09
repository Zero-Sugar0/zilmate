import chalk from 'chalk';
import { marked } from 'marked';
import type { Tokens } from 'marked';
import type { ProgressEvent } from '../runtime/progress.js';

const maxWidth = () => Math.min(process.stdout.columns || 96, 110);
const divider = (color = chalk.gray) => color('─'.repeat(Math.min(maxWidth(), 88)));

function stripInline(markdown: string) {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .trim();
}

function renderInline(markdown: string) {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, href) => `${chalk.blue.underline(text)} ${chalk.gray(`(${href})`)}`)
    .replace(/`([^`]+)`/g, (_match, code) => chalk.yellow(code))
    .replace(/\*\*([^*]+)\*\*/g, (_match, text) => chalk.bold(text))
    .replace(/__([^_]+)__/g, (_match, text) => chalk.bold(text))
    .replace(/\*([^*]+)\*/g, (_match, text) => chalk.italic(text))
    .replace(/_([^_]+)_/g, (_match, text) => chalk.italic(text));
}

function renderHeading(token: Tokens.Heading) {
  const text = stripInline(token.text);
  if (token.depth === 1) {
    return `${chalk.cyan(divider())}\n${chalk.bold.cyanBright(text)}\n${chalk.cyan(divider())}`;
  }
  if (token.depth === 2) return `${chalk.bold.cyan(text)}\n${chalk.cyan('─'.repeat(Math.min(text.length, 60)))}`;
  return chalk.bold.underline(text);
}

function renderList(token: Tokens.List, indent = 0) {
  const pad = ' '.repeat(indent);
  return token.items
    .map((item, index) => {
      const marker = token.ordered ? chalk.cyan(`${index + 1}.`) : chalk.cyan('•');
      const raw = 'text' in item ? String(item.text) : '';
      const text = renderInline(stripInline(raw).replace(/\n+/g, ' '));
      return `${pad}${marker} ${text}`;
    })
    .join('\n');
}

function renderCode(token: Tokens.Code) {
  const lang = token.lang ? chalk.gray(` ${token.lang}`) : '';
  return `${chalk.gray(`┌─ code${lang}`)}\n${chalk.cyan(token.text)}\n${chalk.gray('└─')}`;
}

function renderBlockquote(token: Tokens.Blockquote) {
  const body = renderTokens(token.tokens || [], 0)
    .split('\n')
    .map((line) => `${chalk.gray('│')} ${chalk.gray.italic(line)}`)
    .join('\n');
  return body;
}

function renderTable(token: Tokens.Table) {
  const header = token.header.map((cell) => chalk.bold(stripInline(cell.text))).join(chalk.gray(' | '));
  const rows = token.rows.map((row) => row.map((cell) => stripInline(cell.text)).join(' | '));
  return [header, chalk.gray('─'.repeat(Math.min(header.length, maxWidth()))), ...rows].join('\n');
}

function renderTokens(tokens: unknown[], indent = 0): string {
  const chunks: string[] = [];
  for (const rawToken of tokens) {
    const token = rawToken as Tokens.Generic;
    switch (token.type) {
      case 'heading':
        chunks.push(renderHeading(token as Tokens.Heading));
        break;
      case 'paragraph':
        chunks.push(renderInline(token.text));
        break;
      case 'list':
        chunks.push(renderList(token as Tokens.List, indent));
        break;
      case 'code':
        chunks.push(renderCode(token as Tokens.Code));
        break;
      case 'blockquote':
        chunks.push(renderBlockquote(token as Tokens.Blockquote));
        break;
      case 'table':
        chunks.push(renderTable(token as Tokens.Table));
        break;
      case 'hr':
        chunks.push(divider());
        break;
      case 'space':
        break;
      default:
        if ('raw' in token) chunks.push(renderInline(String(token.raw).trim()));
    }
  }
  return chunks.filter(Boolean).join('\n\n');
}

export function renderMarkdown(markdown: string) {
  const cleaned = markdown.trim();
  if (!cleaned) return '';
  return renderTokens(marked.lexer(cleaned));
}

export function printMarkdown(markdown: string) {
  console.log(renderMarkdown(markdown));
}

export function printJson(value: unknown) {
  console.log(chalk.gray(JSON.stringify(value, null, 2)));
}

export function printTitle(title: string, subtitle?: string) {
  console.log(chalk.cyan(divider(chalk.cyan)));
  console.log(chalk.bold.cyanBright(title));
  if (subtitle) console.log(chalk.gray(subtitle));
  console.log(chalk.cyan(divider(chalk.cyan)));
}

export function printStatus(label: string, value: string) {
  console.log(`${chalk.gray(label)} ${chalk.white(value)}`);
}

export function printAssistant(markdown: string) {
  console.log(chalk.bold.cyan('\nZilMate'));
  console.log(divider());
  printMarkdown(markdown);
  console.log('');
}

export function printUserPrompt() {
  return chalk.bold.green('you> ');
}

export function printThinking() {
  printProgress({ type: 'thinking', label: 'Thinking' });
}

export function printProgress(event: ProgressEvent) {
  const icons: Record<ProgressEvent['type'], string> = {
    thinking: '…',
    step: '→',
    'tool:start': '▶',
    'tool:end': '✓',
    'tool:error': '!',
    'search:start': '⌕',
    'search:end': '✓',
    'fetch:start': '↓',
    'fetch:end': '✓',
    done: '✓',
  };
  const colors: Record<ProgressEvent['type'], (value: string) => string> = {
    thinking: chalk.gray,
    step: chalk.magenta,
    'tool:start': chalk.cyan,
    'tool:end': chalk.green,
    'tool:error': chalk.red,
    'search:start': chalk.blue,
    'search:end': chalk.green,
    'fetch:start': chalk.blue,
    'fetch:end': chalk.green,
    done: chalk.green,
  };
  const icon = icons[event.type];
  const color = colors[event.type];
  const detail = event.detail ? chalk.gray(` — ${event.detail.length > 120 ? `${event.detail.slice(0, 117)}...` : event.detail}`) : '';
  console.log(`${color(`${icon} ${event.label}`)}${detail}`);
}

export function printError(message: string) {
  console.error(chalk.red(message));
}



