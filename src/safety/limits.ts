export const limits = {
  managerSteps: 8,
  subagentSteps: 5,
  researchResults: 5,
  docsCacheTtlMs: 1000 * 60 * 60 * 24,
};

export function clampText(input: string, max = 6000) {
  return input.length <= max ? input : `${input.slice(0, max)}\n...[trimmed]`;
}
