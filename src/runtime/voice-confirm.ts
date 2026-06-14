import type { ConfirmationHandler, ConfirmationRequest } from './confirm.js';

let utteranceWaiter: ((text: string) => void) | undefined;
let waitingForApproval = false;

export function isWaitingForVoiceApproval() {
  return waitingForApproval;
}

/** Route a final user transcript to an in-flight voice approval prompt. Returns true if consumed. */
export function deliverVoiceUtterance(text: string) {
  if (!utteranceWaiter) return false;
  const resolve = utteranceWaiter;
  utteranceWaiter = undefined;
  waitingForApproval = false;
  resolve(text);
  return true;
}

export function waitForVoiceUtterance(timeoutMs = 20_000): Promise<string> {
  return new Promise((resolve, reject) => {
    waitingForApproval = true;
    const timer = setTimeout(() => {
      utteranceWaiter = undefined;
      waitingForApproval = false;
      reject(new Error('Voice approval timed out. Say yes, no, or session.'));
    }, timeoutMs);
    utteranceWaiter = (text) => {
      clearTimeout(timer);
      waitingForApproval = false;
      resolve(text);
    };
  });
}

export function parseVoiceApproval(text: string): boolean | 'session' | null {
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
  if (/^(yes|yeah|yep|yup|sure|ok|okay|approve|approved|proceed|go ahead|do it|affirmative)\b/.test(normalized)) return true;
  if (/^(no|nope|nah|cancel|stop|deny|denied|don't|do not|negative)\b/.test(normalized)) return false;
  if (/^(session|always|for session|this session)\b/.test(normalized)) return 'session';
  return null;
}

function spokenSummary(request: ConfirmationRequest) {
  const action = request.action || request.summary;
  const tool = request.targetTools?.[0] || request.toolSlug;
  return `${action} using ${tool}`;
}

export function createVoiceConfirmation(speak: (text: string) => Promise<void>): ConfirmationHandler {
  return async (request) => {
    await speak(`ZilMate needs permission to ${spokenSummary(request)}. Say yes, no, or session.`);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const utterance = await waitForVoiceUtterance();
      const decision = parseVoiceApproval(utterance);
      if (decision === null) {
        await speak('Say yes, no, or session.');
        continue;
      }
      if (decision === true) await speak('Approved.');
      if (decision === false) await speak('Cancelled.');
      if (decision === 'session') await speak('Approved for this session.');
      return decision;
    }

    return false;
  };
}
