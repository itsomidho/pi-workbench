import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const env = (dir) => ({ ...process.env, PI_STANDARDS_DIR: path.join(dir, 'standards'), PI_TASKS_DIR: path.join(dir, 'tasks') });

test('domain project and task lifecycle use isolated paths', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-workbench-'));
  const localEnv = env(dir);
  execFileSync(process.execPath, ['scripts/init-project.mjs', 'wordpress', 'sample-site'], { cwd: root, env: localEnv });
  const project = path.join(dir, 'standards/wordpress/projects/sample-site.md');
  assert.ok(fs.existsSync(project));
  execFileSync(process.execPath, ['scripts/create-task.mjs', 'wordpress', 'sample-site', 'seo-fix', 'Fix SEO'], { cwd: root, env: localEnv });
  const taskRoot = path.join(dir, 'tasks/wordpress/sample-site');
  const task = fs.readdirSync(taskRoot)[0];
  const identifier = `wordpress/sample-site/${task}`;
  const invalid = spawnSync(process.execPath, ['scripts/task-transition.mjs', identifier, 'implementing'], { cwd: root, env: localEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  assert.notEqual(invalid.status, 0);
  execFileSync(process.execPath, ['scripts/task-transition.mjs', identifier, 'awaiting-approval'], { cwd: root, env: localEnv });
  const taskFile = path.join(taskRoot, task, 'TASK.md');
  let taskText = fs.readFileSync(taskFile, 'utf8').replace('Not approved yet.', '1. Inspect the affected files.\n2. Implement and verify the fix.');
  fs.writeFileSync(taskFile, taskText);
  execFileSync(process.execPath, ['scripts/task-approve.mjs', identifier], { cwd: root, env: localEnv });
  assert.match(fs.readFileSync(taskFile, 'utf8'), /\| Status \| implementing \|/);
  assert.match(fs.readFileSync(path.join(taskRoot, task, 'artifacts/shared-context.json'), 'utf8'), /approvedPlanHash/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('unknown domains fail without creating files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-workbench-'));
  const result = spawnSync(process.execPath, ['scripts/init-project.mjs', 'unknown', 'sample'], { cwd: root, env: env(dir), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  assert.notEqual(result.status, 0);
  assert.equal(fs.existsSync(path.join(dir, 'standards')), false);
  fs.rmSync(dir, { recursive: true, force: true });
});
