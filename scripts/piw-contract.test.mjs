import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const cli = fileURLToPath(new URL('./piw.mjs', import.meta.url));

test('piw exposes help and version', () => {
  const help = execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.match(help, /piw task create/);
  assert.match(help, /piw model-capabilities init/);
  assert.equal(execFileSync(process.execPath, [cli, 'version'], { encoding: 'utf8' }).trim(), JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
});

test('public command reference covers CLI help and registered Pi commands', () => {
  const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
  const readme = read('README.md');
  const rows = [...readme.matchAll(/^\| `([^`]+)` \|/gm)].map(match => match[1]);
  const hasRow = command => rows.some(row => row === command || row.startsWith(`${command} `));
  const help = execFileSync(process.execPath, [cli, 'help'], { encoding: 'utf8' });
  for (const [, command] of help.matchAll(/^  (piw [^<\[\n]+)/gm)) {
    assert.ok(hasRow(command.trim()), `Missing README command: ${command.trim()}`);
  }
  for (const file of ['model-router', 'task-workflow', 'workflow-orchestrator']) {
    for (const [, command] of read(`extensions/${file}.ts`).matchAll(/registerCommand\("([a-z-]+)"/g)) {
      assert.ok(hasRow(`/${command}`), `Missing README command: /${command}`);
    }
  }
  for (const name of fs.readdirSync(new URL('../docs/', import.meta.url)).filter(name => name.endsWith('.md'))) {
    assert.match(read(`docs/${name}`), /^## Workbench commands\n/m, name);
  }
  const usage = read('docs/model-router-usage.md');
  assert.match(usage, /^## Session model scope$/m);
  for (const flag of ['--models', '--model', '--list-models']) {
    assert.ok(hasRow(`piw run ${flag}`), `Missing README option: ${flag}`);
    assert.ok(usage.includes(`piw run ${flag}`), `Missing router guide option: ${flag}`);
  }
});

test('archive updater refuses Git checkouts before reading release metadata', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'piw source update-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(new URL('./update.mjs', import.meta.url), path.join(dir, 'scripts/update.mjs'));
  // A .git file also represents a worktree, not just a .git directory.
  fs.writeFileSync(path.join(dir, '.git'), 'gitdir: /not-used');
  const bin = path.join(dir, 'bin'), marker = path.join(dir, 'network-attempted');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'curl'), '#!/bin/sh\nprintf attempted > "$PI_UPDATE_TEST_MARKER"\nexit 99\n', { mode: 0o755 });
  const env = { ...process.env, HOME: dir, PI_WORKBENCH_HOME: dir, PATH: bin, PI_UPDATE_TEST_MARKER: marker };
  assert.throws(() => execFileSync(process.execPath, [path.join(dir, 'scripts/update.mjs'), '--yes'], { env, encoding: 'utf8', stdio: 'pipe' }), error => {
    assert.equal(error.status, 2);
    assert.match(error.stderr, /Source checkout detected/);
    return true;
  });
  assert.equal(fs.existsSync(marker), false, 'Guard tests must never contact a live updater or touch the real installation');
});

test('structural checks work from a source path containing spaces', t => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'piw source checks-'));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const source = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
  const copy = path.join(parent, 'workbench with spaces');
  fs.cpSync(source, copy, { recursive: true, filter: file => !path.relative(source, file).split(path.sep).some(part => ['.git', 'node_modules'].includes(part)) });
  const output = execFileSync(process.execPath, [path.join(copy, 'scripts/verify-workflows.mjs')], { encoding: 'utf8' });
  assert.match(output, /Portable Pi workbench checks passed/);
});

test('piw run defaults to router/auto and passes Pi arguments through', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'piw-run-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const fakePi = path.join(dir, 'pi');
  fs.writeFileSync(fakePi, '#!/bin/sh\nprintf "cwd=%s\\n" "$PWD"\nprintf "%s\\n" "$@"\n', { mode: 0o755 });
  const cases = [
    { args: ['--no-session'], forwarded: ['--model', 'router/auto', '--no-session'] },
    { args: ['Explain this fixture'], forwarded: ['--model', 'router/auto', 'Explain this fixture'] },
    { args: ['@brief.md', '--no-session'], forwarded: ['--model', 'router/auto', '@brief.md', '--no-session'] },
    { args: ['--', '--model', 'literal prompt'], forwarded: ['--model', 'router/auto', '--', '--model', 'literal prompt'] },
    { args: ['--model', 'example/model', 'Explain this fixture'], forwarded: ['--model', 'example/model', 'Explain this fixture'] },
    { args: ['--model=example/model', 'Explain this fixture'], forwarded: ['--model=example/model', 'Explain this fixture'] },
  ];
  for (const { args, forwarded } of cases) {
    const output = execFileSync(process.execPath, [cli, 'run', ...args], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, PI_WORKBENCH_CONFIG_DIR: path.join(dir, 'providers') },
    });
    assert.deepEqual(output.trim().split('\n'), [`cwd=${process.cwd()}`, ...forwarded], JSON.stringify(args));
  }
});
