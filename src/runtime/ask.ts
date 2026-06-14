import { isConfirmationActive } from './confirm.js';

export type AskQuestionRequest = {
  question: string;
  options: Array<{ id: string; label: string; description?: string }>;
  allowMultiple?: boolean;
  required?: boolean;
};

export type AskHandler = (request: AskQuestionRequest) => Promise<string[] | null>;

let handler: AskHandler | undefined;

export function setAskHandler(next?: AskHandler) {
  handler = next;
}

export async function askUser(request: AskQuestionRequest): Promise<string[] | null> {
  if (isConfirmationActive()) return null;
  if (!handler) return null;
  return handler(request);
}

export async function withAskHandler<T>(ask: AskHandler | undefined, run: () => Promise<T>) {
  const previous = handler;
  handler = ask;
  try {
    return await run();
  } finally {
    handler = ask ?? previous;
  }
}
