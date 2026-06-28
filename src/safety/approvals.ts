import { generateText } from 'ai';
import { models } from '../config/models.js';

export type ApprovalDecision = 'allowed' | 'needs_confirmation';

const dangerousIntentPattern = /\b(delete|drop|wipe|reset|transfer money|send payout|revoke)\b/i;

export async function checkReadOnlyIntent(prompt: string): Promise<{ decision: ApprovalDecision; reason?: string; operation?: string }> {
  if (!prompt) return { decision: 'allowed' };

  // 1. First run the fast heuristic check
  const match = prompt.match(dangerousIntentPattern);
  if (match) {
    const operation = match[0].toLowerCase();
    return { 
      decision: 'needs_confirmation', 
      operation,
      reason: `This is a potentially destructive ${operation} operation on your system. This CLI scaffold requires explicit approval for severe actions.` 
    };
  }

  // 2. Perform semantic LLM check for shell commands and dangerous patterns
  try {
    const response = await generateText({
      model: models.help, // Use help/cheap model for speed and efficiency
      prompt: `Analyze the following system command or user instruction for safety.
We must block or flag any destructive, irreversible, or high-risk operations on the local machine (e.g., deleting root system files, altering partitions, killing critical processes, wiping databases, clean-deleting git directories, overwriting hosts file, or modifying master keys).

Input: "${prompt}"

Evaluate if this represents a destructive/dangerous operation.
Return ONLY a JSON block with two fields:
{
  "dangerous": true or false,
  "reason": "If dangerous, describe the risk (e.g., 'Attempts to perform system-wide directory removal' or 'Potentially deletes untracked repository files via git clean'). Else leave empty."
}
`
    });

    const parsedMatch = response.text.match(/\{[\s\S]*\}/);
    if (parsedMatch) {
      const parsed = JSON.parse(parsedMatch[0]);
      if (parsed.dangerous === true) {
        return {
          decision: 'needs_confirmation',
          operation: 'destructive_command',
          reason: parsed.reason || 'This is a potentially destructive system command.'
        };
      }
    }
  } catch (error) {
    // If LLM classification fails/times out, we fall back to a safe regex check
    const severeShellPattern = /\b(rm\s+-rf|shred\b|git\s+clean\s+-f|truncate\b|mkfs\b|format\b|kill\s+-9|dd\s+if=)\b/i;
    const fallbackMatch = prompt.match(severeShellPattern);
    if (fallbackMatch) {
      return {
        decision: 'needs_confirmation',
        operation: fallbackMatch[0].toLowerCase(),
        reason: `Potential critical threat command detected (${fallbackMatch[0]}). Requires verification.`
      };
    }
  }

  return { decision: 'allowed' };
}

