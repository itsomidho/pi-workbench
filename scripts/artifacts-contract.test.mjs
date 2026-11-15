import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(new URL('..', import.meta.url).pathname);

test('tasks initialize shared context and stage handoff briefs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-workbench-artifacts-'));
  const standards = path.join(dir, 'standards');
  const tasks = path.join(dir, 'tasks');
  const env = { ...process.env, PI_STANDARDS_DIR: standards, PI_TASKS_DIR: tasks };
  execFileSync(process.execPath, ['scripts/init-project.mjs', 'wordpress', 'sample-site'], { cwd: root, env });
  execFileSync(process.execPath, ['scripts/create-task.mjs', 'wordpress', 'sample-site', 'brief-test', 'Brief test'], { cwd: root, env });
  const taskDir = path.join(tasks, 'wordpress', 'sample-site', fs.readdirSync(path.join(tasks, 'wordpress', 'sample-site'))[0]);
  const contextFile = path.join(taskDir, 'artifacts/shared-context.json');
  assert.equal(JSON.parse(fs.readFileSync(contextFile, 'utf8')).schemaVersion, 1);
  execFileSync(process.execPath, ['scripts/task-artifacts.mjs', 'write', taskDir, '02-implement', 'Implemented the approved plan'], { cwd: root, env });
  const handoff = JSON.parse(fs.readFileSync(path.join(taskDir, 'artifacts/briefs/02-implement.json'), 'utf8'));
  assert.equal(handoff.stage, '02-implement');
  assert.equal(handoff.summary, 'Implemented the approved plan');
  fs.rmSync(dir, { recursive: true, force: true });
});
