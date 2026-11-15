import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const cli = new URL('./piw.mjs', import.meta.url).pathname;

test('piw exposes help and version', () => {
  const help = execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.match(help, /piw task create/);
  assert.equal(execFileSync(process.execPath, [cli, 'version'], { encoding: 'utf8' }).trim(), '0.3.4');
});
