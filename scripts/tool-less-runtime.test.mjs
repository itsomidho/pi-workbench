import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(new URL('..', import.meta.url).pathname);
test('real Pi tool-less runtime rejects a provider-issued write call without creating its target', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-toolless-boundary-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const marker = path.join(dir, 'forbidden-model-write');
  const env = { ...process.env, PI_CODING_AGENT_DIR: path.join(dir, 'agent'), PI_MOCK_TOOLLESS_PROBE: marker, PI_OFFLINE: '1' };
  const r = spawnSync('pi', ['-ne', '-e', './scripts/mock-pi-extension.mjs', '--provider', 'mock-local', '--model', 'mock-model', '--no-tools', '--no-mcp', '--no-context-files', '--no-skills', '--no-prompt-templates', '--no-session', '--mode', 'json', '-p', 'Exercise the disabled-tool boundary.'], { cwd: root, env, encoding: 'utf8', timeout: 15000 });
  assert.ifError(r.error);
  assert.equal(fs.existsSync(marker), false, 'Even a forced provider tool call cannot bypass --no-tools');
  const events = r.stdout.split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
  assert.ok(events.some(event => event.type === 'tool_execution_end' && event.toolName === 'write' && event.isError));
  assert.match(r.stdout, /TOOLLESS_PROBE_FINISHED/);
});
