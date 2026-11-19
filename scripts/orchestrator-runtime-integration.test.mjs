import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import test from 'node:test';
import { discoverDomains } from './domains.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);

const cases = [...discoverDomains(root).domains.filter(d => d.routes.development?.engine === 'managed-development-v1').map(d => ({ domain: d.id })), { domain: 'sample' }, { domain: 'nextjs', fixLoop: true }];
for (const { domain, fixLoop = false } of cases) test(`Pi RPC runs ${domain} managed workflow through finish with a mock model${fixLoop ? ' and review/fix/re-review' : ''}`, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-workbench-runtime-'));
  const env = { ...process.env, PI_STANDARDS_DIR: path.join(dir, 'standards'), PI_TASKS_DIR: path.join(dir, 'tasks') };
  if (domain === 'sample') {
    const app = path.join(dir, 'app');
    const pack = path.join(app, 'domains/sample');
    fs.cpSync(path.join(root, 'domains/wordpress'), pack, { recursive: true });
    const manifestFile = path.join(pack, 'domain.json');
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    manifest.id = 'sample'; manifest.name = 'Synthetic domain';
    fs.writeFileSync(manifestFile, JSON.stringify(manifest));
    for (const role of fs.readdirSync(path.join(pack, 'roles'))) fs.writeFileSync(path.join(pack, 'roles', role), 'SAMPLE RUNTIME ROLE');
    env.PI_CONFIG_DIR = app;
    env.PI_MOCK_EXPECT_ROLE = 'SAMPLE RUNTIME ROLE';
  }
  env.PI_MOCK_EXPECT_DOMAIN = domain;
  if (fixLoop) env.PI_MOCK_FIX_LOOP = '1';
  else delete env.PI_MOCK_FIX_LOOP;
  env.PI_ROUTER_ROLE = 'think';
  env.PI_MOCK_APPROVED_TASK = '';
  execFileSync(process.execPath, ['scripts/init-project.mjs', domain, 'sample-site'], { cwd: root, env });
  execFileSync(process.execPath, ['scripts/create-task.mjs', domain, 'sample-site', 'runtime-flow', 'Runtime flow'], { cwd: root, env });
  const taskBase = path.join(dir, `tasks/${domain}/sample-site`);
  const taskName = fs.readdirSync(taskBase)[0];
  const taskDir = path.join(taskBase, taskName);
  const identifier = `${domain}/sample-site/${taskName}`;
  const taskFile = path.join(taskDir, 'TASK.md');
  fs.writeFileSync(taskFile, fs.readFileSync(taskFile, 'utf8').replace('Not approved yet.', '1. Run the implementation.\n2. Verify the result.'));
  execFileSync(process.execPath, ['scripts/task-transition.mjs', identifier, 'awaiting-approval'], { cwd: root, env });
  execFileSync(process.execPath, ['scripts/task-approve.mjs', identifier], { cwd: root, env });
  env.PI_MOCK_APPROVED_TASK = identifier;
  const child = spawn('pi', ['--mode', 'rpc', '-ne', '-e', './scripts/mock-pi-extension.mjs', '-e', './extensions/model-router.ts', '-e', './extensions/workflow-orchestrator.ts', '--provider', 'mock-local', '--model', 'mock-model', '--no-session'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stderr.on('data', () => {});
  const waitForAgentEnd = () => new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Mock Pi turn did not settle')); }, 10000);
    const listener = data => {
      buffer += data;
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
        try {
          if (JSON.parse(line).type === 'agent_end') {
            clearTimeout(timer); child.stdout.off('data', listener); resolve();
          }
        } catch { /* ignore non-JSON startup output */ }
      }
    };
    child.stdout.on('data', listener);
  });
  const firstGoTurn = waitForAgentEnd();
  child.stdin.write(`${JSON.stringify({ id: 'approval-before-handoff', type: 'prompt', message: 'go' })}\n`);
  await firstGoTurn;
  assert.equal(fs.existsSync(path.join(env.PI_TASKS_DIR, 'orchestration.json')), false, 'Plain go without a current handoff must not select a task globally');
  child.stdin.write(`${JSON.stringify({ id: 'approval', type: 'prompt', message: 'go' })}\n`);

  const deadline = Date.now() + 20000;
  while (!fs.existsSync(path.join(taskDir, 'FINAL.md')) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  if (!fs.existsSync(path.join(taskDir, 'FINAL.md'))) {
    child.kill('SIGKILL');
    throw new Error('Pi workflow did not reach FINAL.md within 20 seconds');
  }
  // Registered router commands must observe the role changed by the orchestrator's import.
  await new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Router status did not observe the managed role')); }, 5000);
    const listener = data => {
      buffer += data;
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
        if (line.includes('Role: ')) {
          clearTimeout(timer); child.stdout.off('data', listener);
          if (line.includes('Role: developer;')) resolve();
          else { child.kill('SIGKILL'); reject(new Error(`Unexpected router status: ${line}`)); }
        }
      }
    };
    child.stdout.on('data', listener);
    child.stdin.write(JSON.stringify({ id: 'router-state', type: 'prompt', message: '/router-status' }) + '\n');
  });
  child.stdin.write('{"type":"abort"}\n');
  child.stdin.end();
  await new Promise(resolve => child.once('close', resolve));
  if (fixLoop) {
    assert.ok(fs.existsSync(path.join(taskDir, 'artifacts/briefs/04-fix.json')));
    const run = JSON.parse(fs.readFileSync(path.join(env.PI_TASKS_DIR, 'orchestration.json'), 'utf8'));
    assert.equal(run.fixRounds, 1);
  }
  for (const stage of ['02-implement', '03-review', '05-qa', '06-test', '07-audit', '08-finish']) assert.ok(fs.existsSync(path.join(taskDir, 'artifacts', 'briefs', `${stage}.json`)), stage);
  assert.match(fs.readFileSync(path.join(taskDir, 'TASK.md'), 'utf8'), /\| Status \| done \|/);
  assert.ok(fs.existsSync(path.join(taskDir, 'reports/final.html')));
  const report = JSON.parse(fs.readFileSync(path.join(taskDir, 'reports/final.json'), 'utf8'));
  assert.equal(report.task.status, 'completed');
  assert.equal(report.task.domain, domain);
  assert.equal(report.task.execution, 'managed');
  assert.equal(report.plan.approval, 'recorded');
  assert.ok(report.verification.filter(check => check.source !== 'report details').every(check => check.status === 'unverified'), 'Command names alone must not pass');
  assert.equal(report.outcome.summary, 'Mock finish supplied structured report details.');
  assert.ok(report.verification.some(check => check.name === 'Mock structured check' && check.status === 'passed'));
  assert.ok(report.stages.every(stage => stage.evidence.includes('mock provider evidence')));
  fs.rmSync(dir, { recursive: true, force: true });
});
