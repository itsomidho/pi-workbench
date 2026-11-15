import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(new URL('..', import.meta.url).pathname);

test('Pi RPC runs the managed workflow through finish with a mock model', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-workbench-runtime-'));
  const env = { ...process.env, PI_STANDARDS_DIR: path.join(dir, 'standards'), PI_TASKS_DIR: path.join(dir, 'tasks') };
  execFileSync(process.execPath, ['scripts/init-project.mjs', 'wordpress', 'sample-site'], { cwd: root, env });
  execFileSync(process.execPath, ['scripts/create-task.mjs', 'wordpress', 'sample-site', 'runtime-flow', 'Runtime flow'], { cwd: root, env });
  const taskBase = path.join(dir, 'tasks/wordpress/sample-site');
  const taskName = fs.readdirSync(taskBase)[0];
  const taskDir = path.join(taskBase, taskName);
  const identifier = `wordpress/sample-site/${taskName}`;
  const taskFile = path.join(taskDir, 'TASK.md');
  fs.writeFileSync(taskFile, fs.readFileSync(taskFile, 'utf8').replace('Not approved yet.', '1. Run the implementation.\n2. Verify the result.'));
  execFileSync(process.execPath, ['scripts/task-transition.mjs', identifier, 'awaiting-approval'], { cwd: root, env });
  execFileSync(process.execPath, ['scripts/task-approve.mjs', identifier], { cwd: root, env });
  const child = spawn('pi', ['--mode', 'rpc', '-ne', '-e', './scripts/mock-pi-extension.mjs', '-e', './extensions/workflow-orchestrator.ts', '--provider', 'mock-local', '--model', 'mock-model', '--no-session'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdin.write(`${JSON.stringify({ id: 'runtime', type: 'prompt', message: `/task-go ${identifier}` })}\n`);
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  const deadline = Date.now() + 20000;
  while (!fs.existsSync(path.join(taskDir, 'FINAL.md')) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  if (!fs.existsSync(path.join(taskDir, 'FINAL.md'))) {
    child.kill('SIGKILL');
    throw new Error('Pi workflow did not reach FINAL.md within 20 seconds');
  }
  child.stdin.write('{"type":"abort"}\n');
  child.stdin.end();
  await new Promise(resolve => child.once('close', resolve));
  for (const stage of ['02-implement', '03-review', '05-qa', '06-test', '07-audit', '08-finish']) assert.ok(fs.existsSync(path.join(taskDir, 'artifacts', 'briefs', `${stage}.json`)), stage);
  assert.match(fs.readFileSync(path.join(taskDir, 'TASK.md'), 'utf8'), /\| Status \| done \|/);
  fs.rmSync(dir, { recursive: true, force: true });
});
