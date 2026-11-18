import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(new URL('..', import.meta.url).pathname);
for (const scenario of ['blocked', 'missing', 'corrupt', 'stop', 'stop-turn', 'abort']) test(`real Pi produces all report formats when ${scenario}`, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-report-runtime-'));
  const env = { ...process.env, PI_CONFIG_DIR: root, PI_TASKS_DIR: path.join(dir, 'tasks'), PI_STANDARDS_DIR: path.join(dir, 'standards'), PI_MOCK_REPORT_SCENARIO: scenario === 'corrupt' ? 'missing' : scenario, PI_OFFLINE: '1' };
  execFileSync(process.execPath, ['scripts/init-project.mjs', 'wordpress', 'report-site'], { cwd: root, env });
  execFileSync(process.execPath, ['scripts/create-task.mjs', 'wordpress', 'report-site', 'report-case', 'Report lifecycle case'], { cwd: root, env });
  const base = path.join(env.PI_TASKS_DIR, 'wordpress/report-site');
  const taskName = fs.readdirSync(base)[0], taskDir = path.join(base, taskName), id = `wordpress/report-site/${taskName}`;
  const taskFile = path.join(taskDir, 'TASK.md');
  fs.writeFileSync(taskFile, fs.readFileSync(taskFile, 'utf8').replace('Not approved yet.', '1. Execute the approved task.\n2. Report evidence.'));
  execFileSync(process.execPath, ['scripts/task-transition.mjs', id, 'awaiting-approval'], { cwd: root, env });
  execFileSync(process.execPath, ['scripts/task-approve.mjs', id], { cwd: root, env });
  if (scenario === 'corrupt') fs.writeFileSync(path.join(taskDir, 'artifacts/briefs/02-implement.json'), '{corrupt handoff');
  if (['stop', 'stop-turn', 'abort'].includes(scenario)) {
    const state = { taskDir, identifier: id, stage: 'implement', fixRounds: 0, maxFixRounds: 2, handoffRetries: 0, active: true, runId: 'seed-run', attemptId: 'seed-attempt' };
    fs.writeFileSync(path.join(env.PI_TASKS_DIR, 'orchestration.json'), JSON.stringify(state));
    fs.writeFileSync(path.join(taskDir, 'artifacts/state.json'), JSON.stringify(state));
  }
  const child = spawn('pi', ['--mode', 'rpc', '-ne', '-e', './scripts/mock-pi-extension.mjs', '-e', './extensions/model-router.ts', '-e', './extensions/workflow-orchestrator.ts', '--provider', 'mock-local', '--model', 'mock-model', '--no-session'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '', buffer = '', abortSent = false;
  const closed = new Promise((resolve, reject) => { child.once('close', resolve); child.once('error', reject); });
  t.after(async () => { if (child.exitCode === null) child.kill('SIGKILL'); await closed; fs.rmSync(dir, { recursive: true, force: true }); });
  child.stderr.on('data', data => { stderr += data; });
  child.stdout.on('data', data => {
    buffer += data;
    let end;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
      let value;
      try { value = JSON.parse(line); } catch { continue; }
      if (['abort', 'stop-turn'].includes(scenario) && value.type === 'agent_start' && !abortSent) {
        abortSent = true;
        child.stdin.write(JSON.stringify(scenario === 'abort' ? { id: 'abort', type: 'abort' } : { id: 'stop-turn', type: 'prompt', message: '/task-go-stop' }) + '\n');
      }
    }
  });
  const message = scenario === 'stop' ? '/task-go-stop' : ['abort', 'stop-turn'].includes(scenario) ? 'Wait for cancellation' : `/task-go ${id}`;
  child.stdin.write(JSON.stringify({ id: 'run', type: 'prompt', message }) + '\n');
  const deadline = Date.now() + 15000;
  while (!fs.existsSync(path.join(taskDir, 'FINAL.md')) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(fs.existsSync(path.join(taskDir, 'FINAL.md')), `No report: ${stderr}`);
  const report = JSON.parse(fs.readFileSync(path.join(taskDir, 'reports/final.json'), 'utf8'));
  assert.equal(report.task.status, ['stop', 'stop-turn', 'abort'].includes(scenario) ? 'stopped' : 'blocked');
  assert.ok(fs.readFileSync(path.join(taskDir, 'reports/final.html'), 'utf8').includes('Task report'));
  if (scenario === 'blocked') assert.equal(report.findings[0].summary, 'A blocking issue requires a decision.');
  if (['missing', 'corrupt'].includes(scenario)) assert.match(report.outcome.reason, /Missing valid implement handoff/);
  if (scenario === 'corrupt') assert.ok(report.warnings.some(w => w.includes('invalid JSON')));
  if (['abort', 'stop-turn'].includes(scenario)) assert.ok(abortSent);
  if (scenario === 'stop-turn') assert.match(report.outcome.reason, /after the current turn/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(env.PI_TASKS_DIR, 'orchestration.json'), 'utf8')).active, false);
  child.stdin.end();
  await closed;
});
