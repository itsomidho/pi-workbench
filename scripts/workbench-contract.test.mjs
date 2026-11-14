import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
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
  assert.throws(() => execFileSync(process.execPath, ['scripts/task-transition.mjs', identifier, 'implementing'], { cwd: root, env: localEnv }));
  execFileSync(process.execPath, ['scripts/task-transition.mjs', identifier, 'awaiting-approval'], { cwd: root, env: localEnv });
  assert.match(fs.readFileSync(path.join(taskRoot, task, 'TASK.md'), 'utf8'), /\| Status \| awaiting-approval \|/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('unknown domains fail without creating files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-workbench-'));
  assert.throws(() => execFileSync(process.execPath, ['scripts/init-project.mjs', 'unknown', 'sample'], { cwd: root, env: env(dir) }));
  assert.equal(fs.existsSync(path.join(dir, 'standards')), false);
  fs.rmSync(dir, { recursive: true, force: true });
});
