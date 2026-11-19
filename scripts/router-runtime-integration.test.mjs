import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(new URL('..', import.meta.url).pathname);
for (const scenario of ['fallback', 'exhausted']) test(`real Pi router ${scenario} excludes every failed physical candidate`, t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-router-dispatch-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const agent = path.join(dir, 'agent'); fs.mkdirSync(agent);
  fs.writeFileSync(path.join(agent, 'settings.json'), JSON.stringify({ retry: { enabled: true, maxRetries: 4, baseDelayMs: 1 } }));
  const log = path.join(dir, 'dispatch.jsonl');
  const env = { ...process.env, PI_CODING_AGENT_DIR: agent, PI_ROUTER_ROLE: 'think', PI_MOCK_ROUTER_SCENARIO: scenario, PI_MOCK_ROUTER_LOG: log, PI_OFFLINE: '1' };
  delete env.PI_ROUTER_PROVIDER; delete env.PI_ROUTER_MODEL;
  const result = spawnSync('pi', ['-ne', '-e', './scripts/mock-router-extension.mjs', '-e', './extensions/model-router.ts', '--model', 'router/auto', '--models', 'router-fixture/*', '--no-tools', '--no-mcp', '--no-context-files', '--no-session', '--mode', 'json', '-p', 'Return the router fixture result.'], { cwd: root, env, encoding: 'utf8', timeout: 20000 });
  assert.ifError(result.error);
  const attempts = fs.readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(attempts.map(item => item.model), ['primary', 'secondary', 'tertiary'], result.stderr);
  const messages = result.stdout.split('\n').flatMap(line => { try { const event = JSON.parse(line); return event.type === 'message_end' && event.message?.role === 'assistant' ? [event.message] : []; } catch { return []; } });
  if (scenario === 'fallback') {
    assert.equal(result.status, 0, result.stderr);
    assert.ok(messages.some(message => message.provider === 'router-fixture' && message.model === 'tertiary' && message.stopReason === 'stop'));
    assert.match(result.stdout, /ROUTER_FIXTURE_OK/);
  } else {
    // Pi JSON mode may exit 0 after delivering an error event; inspect response
    // metadata rather than mistake process completion for model success.
    assert.ok(messages.some(message => message.stopReason === 'error' && /No accessible model/.test(message.errorMessage ?? '')));
    assert.ok(!messages.some(message => message.stopReason === 'stop'));
    assert.match(result.stdout + result.stderr, /No accessible model/);
  }
});
