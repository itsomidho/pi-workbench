import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(new URL('..', import.meta.url).pathname);
for (const scenario of ['success', 'tool-call']) test(`real Pi invokes router tools and isolated Advisor (${scenario})`, t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-think-tools-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const marker = path.join(dir, 'must-not-exist');
  const log = path.join(dir, 'calls.log');
  const env = { ...process.env, PI_ROUTER_ROLE: 'developer', PI_THINK_FIXTURE_SCENARIO: scenario, PI_THINK_FIXTURE_LOG: log, PI_THINK_FIXTURE_MARKER: marker, PI_MODEL_CAPABILITIES_FILE: path.join(dir, 'missing-policy.json') };
  for (const key of ['PI_ROUTER_PROVIDER', 'PI_ROUTER_MODEL', 'PI_ROUTER_COMPLEXITY']) delete env[key];
  const child = spawnSync('pi', ['--mode', 'json', '--no-session', '-ne', '--no-mcp', '-ns', '-np', '-nc', '-e', './scripts/mock-think-tools-extension.mjs', '-e', './extensions/model-router.ts', '--provider', 'think-fixture', '--model', 'reasoning', '--models', 'think-fixture/reasoning', 'COORDINATOR_PRIVATE_HISTORY: test the tools'], { cwd: root, env, encoding: 'utf8', timeout: 20000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(child.status, 0, child.stderr + child.stdout);
  const events = child.stdout.split('\n').filter(Boolean).map(line => JSON.parse(line));
  const results = events.filter(e => e.type === 'message_end' && e.message.role === 'toolResult').map(e => e.message);
  assert.deepEqual(results.map(m => m.toolName), ['router_set_role', 'router_status', 'think_advisor', 'router_status']);
  assert.equal(results[0].isError, false);
  assert.equal(results[0].details.role, 'think');
  assert.equal(results[1].details.role, 'think');
  assert.equal(results[3].details.role, 'think', 'Advisor must not switch coordinator role');
  assert.equal(results[3].details.routingActive, false, 'direct physical selection remains direct');
  assert.equal(fs.readFileSync(log, 'utf8'), 'advisor:brief-only;tools=0\n');
  assert.equal(fs.existsSync(marker), false);
  if (scenario === 'success') {
    assert.equal(results[2].isError, false);
    assert.equal(results[2].details.physicalResponseModel, 'think-fixture/reasoning');
    assert.equal(results[2].details.effectiveRole, 'think-advisor');
    assert.match(results[2].details.analysis, /ADVISOR_ANALYSIS_OK/);
  } else {
    assert.equal(results[2].isError, true);
    assert.match(JSON.stringify(results[2].content), /did not complete successfully|attempted a tool call/);
  }
  const last = events.filter(e => e.type === 'message_end' && e.message.role === 'assistant').at(-1).message;
  assert.equal(last.stopReason, 'stop');
  assert.match(JSON.stringify(last.content), /COORDINATOR_FINISHED/);
});
