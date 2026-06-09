export type ApprovalDecision = 'allowed' | 'blocked';

const blockedIntentPattern = /\b(delete|drop|wipe|reset|transfer money|send payout|revoke)\b/i;

export function checkReadOnlyIntent(prompt: string): { decision: ApprovalDecision; reason?: string } {
  if (blockedIntentPattern.test(prompt)) {
    return { decision: 'blocked', reason: 'This CLI scaffold is read-only for app operations. It can guide, draft, research, and generate assets only.' };
  }
  return { decision: 'allowed' };
}
