import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const root = new URL('..', import.meta.url).pathname;

test('Pi runtime executes a model through the mock provider extension', () => {
  const output = execFileSync('pi', ['-ne', '-e', './scripts/mock-pi-extension.mjs', '--provider', 'mock-local', '--model', 'mock-model', '--no-session', '--mode', 'text', '--print', 'Say hello'], { cwd: root, encoding: 'utf8', timeout: 15000 });
  assert.match(output, /mock response/);
});
