import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(new URL('..', import.meta.url).pathname);

test('complete task artifact lifecycle reaches a final report input set', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-workbench-e2e-'));
  const env = { ...process.env, PI_STANDARDS_DIR: path.join(dir, 'standards'), PI_TASKS_DIR: path.join(dir, 'tasks') };
  execFileSync(process.execPath, ['scripts/init-project.mjs', 'wordpress', 'sample-site'], { cwd: root, env });
  execFileSync(process.execPath, ['scripts/create-task.mjs', 'wordpress', 'sample-site', 'full-flow', 'Full workflow'], { cwd: root, env });
  const taskBase = path.join(dir, 'tasks/wordpress/sample-site');
  const taskName = fs.readdirSync(taskBase)[0];
  const taskDir = path.join(taskBase, taskName);
  const id = `wordpress/sample-site/${taskName}`;
  const taskFile = path.join(taskDir, 'TASK.md');
  fs.writeFileSync(taskFile, fs.readFileSync(taskFile, 'utf8').replace('Not approved yet.', '1. Implement the change.\n2. Run verification.'));
  execFileSync(process.execPath, ['scripts/task-transition.mjs', id, 'awaiting-approval'], { cwd: root, env });
  execFileSync(process.execPath, ['scripts/task-approve.mjs', id], { cwd: root, env });
  const stages = [
    ['02-implement', 'Implementation complete'],
    ['03-review', 'Review found a blocking issue'],
    ['04-fix', 'Fixed the blocking issue'],
    ['05-qa', 'QA passed'],
    ['06-test', 'Tests passed'],
    ['07-audit', 'Audit passed'],
    ['08-finish', 'Final verification complete'],
  ];
  for (const [stage, summary] of stages) execFileSync(process.execPath, ['scripts/task-artifacts.mjs', 'write', taskDir, stage, summary], { cwd: root, env });
  const briefs = fs.readdirSync(path.join(taskDir, 'artifacts/briefs')).sort();
  assert.deepEqual(briefs, stages.map(([stage]) => `${stage}.json`));
  const context = JSON.parse(fs.readFileSync(path.join(taskDir, 'artifacts/shared-context.json'), 'utf8'));
  assert.equal(context.approvedPlanHash.length, 64);
  assert.equal(JSON.parse(fs.readFileSync(path.join(taskDir, 'artifacts/briefs/08-finish.json'), 'utf8')).status, 'completed');
  fs.rmSync(dir, { recursive: true, force: true });
});
