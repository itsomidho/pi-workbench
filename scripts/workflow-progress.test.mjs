import assert from 'node:assert/strict';
import test from 'node:test';
import { previousStage, nextWorkflowStage, validHandoff } from './workflow-progress.mjs';

test('stage handoffs from old runs or retries cannot satisfy a new attempt', () => {
  const brief = { schemaVersion: 1, stage: '02-implement', status: 'completed', attemptId: 'old', summary: 'Old result', changedFiles: [], findings: [], commandsRun: [], knownRisks: [], nextChecks: [], evidence: [] };
  assert.equal(validHandoff(brief, '02-implement', 'new'), false);
  assert.equal(validHandoff(brief, '02-implement', undefined), false);
  assert.equal(validHandoff(brief, '02-implement', 'old'), true);
  assert.equal(validHandoff({ ...brief, findings: null }, '02-implement', 'old'), false);
});

test('optional fix and re-review receive the actual preceding handoff', () => {
  assert.equal(previousStage('implement', 0), null);
  assert.equal(previousStage('review', 0), 'implement');
  assert.equal(previousStage('review', 1), 'fix');
  assert.equal(previousStage('fix', 1), 'review');
  assert.equal(previousStage('qa', 0), 'review');
  assert.equal(previousStage('qa', 1), 'review');
});

test('review findings drive bounded fix loops', () => {
  const result = { findings: [{ severity: 'high' }] };
  assert.equal(nextWorkflowStage('review', 0, 2, result), 'fix');
  assert.equal(nextWorkflowStage('review', 2, 2, result), 'blocked');
  assert.equal(nextWorkflowStage('fix', 1, 2, {}), 'review');
  assert.equal(nextWorkflowStage('review', 0, 2, { findings: [] }), 'qa');
});

test('blocking implementation, QA, tests, audit, or finish cannot silently complete', () => {
  for (const stage of ['implement', 'qa', 'test', 'audit', 'finish']) {
    assert.equal(nextWorkflowStage(stage, 0, 2, { findings: [{ severity: 'medium' }] }), 'blocked');
    assert.equal(nextWorkflowStage(stage, 0, 2, { findings: [{ severity: 'low', blocking: true }] }), 'blocked');
  }
  assert.equal(nextWorkflowStage('finish', 0, 2, { findings: [{ severity: 'high', blocking: false }] }), 'done');
});
