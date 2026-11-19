import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const cli = path.join(root, 'scripts', 'model-capabilities.mjs');

test('interactive capability policy init creates a restricted non-Tabdl policy', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-model-capabilities-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'model-capabilities.json');
  const input = [
    'openai-codex/gpt-5',
    'planning,coding,review',
    'strong',
    '',
    'openai-codex/gpt-5',
    '', '', '', '', '', '', 
  ].join('\n') + '\n';
  const output = execFileSync(process.execPath, [cli, 'init', file], { input, encoding: 'utf8' });
  assert.match(output, /Sample structure/);
  assert.match(output, /provider-a\/model-id/);
  assert.match(output, /provider-b\/model-id/);
  assert.equal(output.toLowerCase().includes('tabdl'), false);
  const policy = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(policy.version, 1);
  assert.equal(policy.defaults.allowUnlistedModels, false);
  assert.deepEqual(policy.models['openai-codex/gpt-5'].capabilities, ['planning', 'coding', 'review']);
  assert.deepEqual(policy.stages.planning, ['openai-codex/gpt-5']);
  assert.deepEqual(policy.stages.qa, []);
  assert.deepEqual(policy.stages.testing, []);
  assert.deepEqual(Object.keys(policy.stages), ['planning', 'coding', 'debugging', 'review', 'qa', 'testing', 'security']);
  assert.equal(Object.keys(policy.models).some(key => key.toLowerCase().includes('tabdl')), false);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.match(execFileSync(process.execPath, [cli, 'validate', file], { encoding: 'utf8' }), /Valid capability policy/);
  assert.match(execFileSync(process.execPath, [cli, 'list', file], { encoding: 'utf8' }), /openai-codex\/gpt-5/);
});

test('capability policy validation rejects unknown capabilities and stage models', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-model-capabilities-invalid-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'invalid.json');
  fs.writeFileSync(file, JSON.stringify({ version: 1, models: { 'anthropic/claude-test': { capabilities: ['unknown'], tier: 'strong' } } }));
  assert.throws(() => execFileSync(process.execPath, [cli, 'validate', file], { encoding: 'utf8', stdio: 'pipe' }), error => error.status === 2 && /Invalid capabilities/.test(error.stderr));
});
