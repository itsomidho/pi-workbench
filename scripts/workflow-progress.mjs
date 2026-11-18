export const executionStages = ['implement', 'review', 'fix', 'qa', 'test', 'audit', 'finish'];

export function validHandoff(value, expectedStage, attemptId) {
  return typeof attemptId === 'string' && value?.attemptId === attemptId && value?.schemaVersion === 1 && value.stage === expectedStage && value.status === 'completed' && typeof value.summary === 'string' && ['changedFiles', 'findings', 'commandsRun', 'knownRisks', 'nextChecks', 'evidence'].every(key => Array.isArray(value[key]));
}

export function previousStage(stage, fixRounds) {
  if (stage === 'review') return fixRounds > 0 ? 'fix' : 'implement';
  if (stage === 'qa') return 'review'; // Fix is optional and must not hide the last review.
  return executionStages[executionStages.indexOf(stage) - 1] ?? null;
}

export function nextWorkflowStage(stage, fixRounds, maxFixRounds, result) {
  const blocking = (Array.isArray(result?.findings) ? result.findings : []).some(finding =>
    finding?.blocking === true || (finding?.blocking !== false && ['critical', 'high', 'medium'].includes(finding?.severity)));
  if (stage === 'review') return blocking ? (fixRounds < maxFixRounds ? 'fix' : 'blocked') : 'qa';
  if (stage === 'fix') return 'review';
  if (blocking) return 'blocked'; // Later-stage failures need a decision, not a false completion.
  return executionStages[executionStages.indexOf(stage) + 1] ?? 'done';
}
