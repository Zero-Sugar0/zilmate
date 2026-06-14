import { generateText } from 'ai';
import { models } from '../config/models.js';
import type { ZilMateJob } from './types.js';

export type AnomalyAssessment = {
  normal: boolean;
  severity: 'low' | 'medium' | 'high';
  reason: string;
  suggestedRoute?: string;
};

const recentFingerprints: string[] = [];
const MAX_FINGERPRINTS = 50;

function fingerprint(job: ZilMateJob) {
  return `${job.source?.type ?? 'manual'}:${job.task.slice(0, 120)}`;
}

export function recordJobFingerprint(job: ZilMateJob) {
  recentFingerprints.unshift(fingerprint(job));
  if (recentFingerprints.length > MAX_FINGERPRINTS) recentFingerprints.pop();
}

export async function assessJobAnomaly(job: ZilMateJob, context?: string): Promise<AnomalyAssessment> {
  const fp = fingerprint(job);
  const duplicateCount = recentFingerprints.filter((item) => item === fp).length;
  if (duplicateCount >= 3) {
    return {
      normal: false,
      severity: 'medium',
      reason: 'Repeated similar job in short window',
      suggestedRoute: 'confirm-with-user',
    };
  }

  const suspicious = /\b(delete all|wipe|format|rm -rf|shutdown|disable firewall|exfiltrate)\b/i.test(job.task);
  if (suspicious) {
    return {
      normal: false,
      severity: 'high',
      reason: 'Task contains potentially destructive phrasing',
      suggestedRoute: 'require-approval',
    };
  }

  try {
    const result = await generateText({
      model: models.help,
      prompt: `Classify if this automated job is normal. Reply JSON only: {"normal":true|false,"severity":"low|medium|high","reason":"...","suggestedRoute":"auto|confirm-with-user|require-approval"}

Job task: ${job.task}
Source: ${JSON.stringify(job.source)}
Context: ${context ?? '(none)'}
Recent patterns: ${recentFingerprints.slice(0, 8).join(' | ') || '(none)'}`,
    });
    const match = result.text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as AnomalyAssessment;
  } catch {
    // fall through
  }

  return { normal: true, severity: 'low', reason: 'No anomaly heuristics triggered' };
}
