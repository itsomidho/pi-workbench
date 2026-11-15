import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const cli = new URL('./piw.mjs', import.meta.url).pathname;

test('piw exposes help and version', () => {
  const help = execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.match(help, /piw task create/);
  assert.equal(execFileSync(process.execPath, [cli, 'version'], { encoding: 'utf8' }).trim(), '0.5.9');
});

test('piw run defaults to router/auto and passes Pi arguments through', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'piw-run-'));
  const fakePi = path.join(dir, 'pi');
  fs.writeFileSync(fakePi, '#!/bin/sh\nprintf "cwd=%s\\n" "$PWD"\nprintf "%s\\n" "$@"\n', { mode: 0o755 });
  const output = execFileSync(process.execPath, [cli, 'run', '--no-session'], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
  });
  assert.deepEqual(output.trim().split('\n'), [`cwd=${process.cwd()}`, '--model', 'router/auto', '--no-session']);
  fs.rmSync(dir, { recursive: true, force: true });
});
