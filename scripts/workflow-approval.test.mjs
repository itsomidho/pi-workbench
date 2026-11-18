import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assertApprovedPlan } from './workflow-approval.mjs';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-approval-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'artifacts'));
  const plan = '1. Implement the approved feature.\n2. Verify it.';
  const writeTask = (status = 'implementing', value = plan) => fs.writeFileSync(path.join(dir, 'TASK.md'), `# Task\n\n| Status | ${status} |\n\n## Plan\n${value}\n\n## Next\nContinue.\n`);
  const file = path.join(dir, 'artifacts/shared-context.json');
  const record = { planVersion: 1, approvedPlanHash: crypto.createHash('sha256').update(plan).digest('hex') };
  writeTask(); fs.writeFileSync(file, JSON.stringify(record));
  return { dir, file, record, writeTask };
}

test('approved plans remain valid across current-session stages', t => {
  const f = fixture(t);
  for (const status of ['implementing', 'reviewing', 'fixing', 'qa', 'testing', 'auditing', 'finishing']) {
    f.writeTask(status); assert.doesNotThrow(() => assertApprovedPlan(f.dir));
  }
});

test('changed plans and missing approval metadata cannot start or resume execution', t => {
  const f = fixture(t);
  f.writeTask('implementing', '1. A different plan.');
  assert.throws(() => assertApprovedPlan(f.dir), /approval is required again/);
  f.writeTask();
  for (const record of [{}, { ...f.record, planVersion: 0 }, { approvedPlanHash: f.record.approvedPlanHash }]) {
    fs.writeFileSync(f.file, JSON.stringify(record));
    assert.throws(() => assertApprovedPlan(f.dir), /approval is required again/);
  }
  fs.unlinkSync(f.file);
  assert.throws(() => assertApprovedPlan(f.dir), /Missing approval record/);
});

test('planning, blocked, done, and placeholder plans cannot execute', t => {
  const f = fixture(t);
  for (const status of ['planning', 'awaiting-approval', 'blocked', 'done']) {
    f.writeTask(status); assert.throws(() => assertApprovedPlan(f.dir), /not approved for execution/);
  }
  f.writeTask('implementing', 'Not approved yet.');
  assert.throws(() => assertApprovedPlan(f.dir), /approval is required again/);
});
