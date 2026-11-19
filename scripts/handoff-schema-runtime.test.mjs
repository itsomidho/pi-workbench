import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const valid = {
  stage: '08-finish', summary: 'Structured evidence fixture, not real application verification.',
  commandsRun: [
    { command: 'fixture-pass', exitCode: 0, result: 'Mock result: passed.' },
    { command: 'fixture-fail', status: 'passed', exitCode: 2, result: 'Mock result: failed.' },
    { command: 'fixture-skip', status: 'skipped', result: 'Not available in this fixture.' },
    { command: 'fixture-unknown' },
  ],
  reportDetails: {
    changes: [{ file: 'fixture.js', summary: 'Mock change description.' }],
    verification: [{ name: 'Unsupported success claim', status: 'passed' }],
    acceptanceCriteria: [
      { criterion: 'Mock evidence survives', status: 'met', evidence: ['Mock payload reached the generated report.'] },
      { criterion: 'No evidence supplied', status: 'met' },
    ],
    delivery: {
      committed: { status: 'no', evidence: ['Fixture does not commit.'] },
      published: { status: 'yes' },
      deployed: { status: 'yes', evidence: ['Synthetic deployment evidence for normalization testing only.'] },
    },
  },
};
const cases = [
  ['structured evidence', {}, true],
  ['command prose', { commandsRun: ['npm test passed'] }],
  ['invalid exit code', { commandsRun: [{ command: 'npm test', exitCode: 'not-observed' }] }],
  ['invalid check status', { commandsRun: [{ command: 'npm test', status: 'success' }] }],
  ['verification prose', { reportDetails: { verification: ['npm test passed'] } }],
  ['unnamed verification', { reportDetails: { verification: [{ command: 'npm test', exitCode: 0 }] } }],
  ['acceptance prose', { reportDetails: { acceptanceCriteria: ['Everything works'] } }],
  ['invalid acceptance status', { reportDetails: { acceptanceCriteria: [{ criterion: 'Everything works', status: 'passed' }] } }],
  ['non-text evidence', { commandsRun: [{ command: 'npm test', evidence: [{ description: 'Prose object' }] }] }],
  ['change prose', { reportDetails: { changes: ['Updated the utility'] } }],
  ['delivery prose', { reportDetails: { delivery: { committed: 'no' } } }],
  ['invalid delivery status', { reportDetails: { delivery: { committed: { status: 'done' } } } }],
  ['unknown delivery fields', { reportDetails: { delivery: { actionsNotPerformed: ['commit'] } } }],
];

for (const [name, override, accepted = false] of cases) test(`real Pi handoff schema: ${name}`, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-handoff-schema-'));
  const payload = { ...valid, ...override };
  const env = { ...process.env, PI_CONFIG_DIR: root, PI_TASKS_DIR: path.join(dir, 'tasks'), PI_STANDARDS_DIR: path.join(dir, 'standards'), PI_MOCK_HANDOFF_PAYLOAD: JSON.stringify(payload), PI_OFFLINE: '1' };
  delete env.PI_MOCK_REPORT_SCENARIO;
  delete env.PI_MOCK_EXPECT_DOMAIN;
  delete env.PI_MOCK_EXPECT_ROLE;
  execFileSync(process.execPath, ['scripts/init-project.mjs', 'nextjs', 'schema-fixture'], { cwd: root, env });
  execFileSync(process.execPath, ['scripts/create-task.mjs', 'nextjs', 'schema-fixture', 'evidence', 'Schema evidence fixture'], { cwd: root, env });
  const base = path.join(env.PI_TASKS_DIR, 'nextjs/schema-fixture');
  const taskName = fs.readdirSync(base)[0];
  const taskDir = path.join(base, taskName), id = `nextjs/schema-fixture/${taskName}`;
  const file = path.join(taskDir, 'TASK.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('Not approved yet.', '1. Exercise structured handoff validation.\n2. Check conservative report states.'));
  execFileSync(process.execPath, ['scripts/task-transition.mjs', id, 'awaiting-approval'], { cwd: root, env });
  execFileSync(process.execPath, ['scripts/task-approve.mjs', id], { cwd: root, env });
  const state = { taskDir, identifier: id, stage: 'finish', fixRounds: 0, maxFixRounds: 2, handoffRetries: 0, active: false, runId: 'schema-run' };
  fs.writeFileSync(path.join(env.PI_TASKS_DIR, 'orchestration.json'), JSON.stringify(state));
  const child = spawn('pi', ['--mode', 'rpc', '-ne', '-e', './scripts/mock-pi-extension.mjs', '-e', './extensions/model-router.ts', '-e', './extensions/workflow-orchestrator.ts', '--provider', 'mock-local', '--model', 'mock-model', '--no-session'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '', buffer = '';
  const toolErrors = [];
  const closed = new Promise((resolve, reject) => { child.once('close', resolve); child.once('error', reject); });
  t.after(async () => {
    if (child.exitCode === null) child.kill('SIGKILL');
    await closed;
    fs.rmSync(dir, { recursive: true, force: true });
  });
  child.stderr.on('data', data => { stderr += data; });
  child.stdout.on('data', data => {
    buffer += data;
    let end;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
      let event;
      try { event = JSON.parse(line); } catch { continue; }
      if (event.type === 'tool_execution_end' && event.isError) toolErrors.push(event.result);
    }
  });
  child.stdin.write(JSON.stringify({ id: 'schema', type: 'prompt', message: `/task-go-resume ${id}` }) + '\n');
  const deadline = Date.now() + 15000;
  while (!fs.existsSync(path.join(taskDir, 'FINAL.md')) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(fs.existsSync(path.join(taskDir, 'FINAL.md')), stderr || 'No final report');
  child.stdin.end();
  await closed;
  const report = JSON.parse(fs.readFileSync(path.join(taskDir, 'reports/final.json'), 'utf8'));
  assert.equal(report.task.status, accepted ? 'completed' : 'blocked');
  if (accepted) {
    assert.deepEqual(toolErrors, []);
    assert.deepEqual(report.verification.map(check => check.status), ['passed', 'failed', 'skipped', 'unverified', 'unverified']);
    assert.equal(report.changes.find(change => change.file === 'fixture.js').summary, 'Mock change description.');
    assert.equal(report.acceptanceCriteria.find(item => item.criterion === 'Mock evidence survives').status, 'met');
    assert.equal(report.acceptanceCriteria.find(item => item.criterion === 'No evidence supplied').status, 'unverified');
    assert.deepEqual(Object.values(report.delivery).map(item => item.status), ['no', 'unknown', 'yes']);
  } else {
    assert.equal(toolErrors.length, 2, 'Invalid arguments must fail at the Pi boundary and exhaust exactly one bounded handoff retry');
    assert.equal(fs.existsSync(path.join(taskDir, 'artifacts/briefs/08-finish.json')), false);
    assert.match(report.outcome.reason, /Missing valid finish handoff after one retry/);
  }
});
