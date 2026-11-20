import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { workbenchPaths } from './workbench-paths.mjs';

const cli = fileURLToPath(new URL('./piw.mjs', import.meta.url));
function fixture(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'piw-paths-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  return home;
}

test('fresh defaults ignore empty and relative XDG paths without creating files', t => {
  const home = fixture(t);
  assert.deepEqual(workbenchPaths({ HOME: home, XDG_CONFIG_HOME: 'relative', XDG_STATE_HOME: '' }), {
    config: path.join(home, '.config/pi-workbench'),
    state: path.join(home, '.local/state/pi-workbench'),
    modelCapabilities: path.join(home, '.config/pi-workbench/model-capabilities.json'),
    providers: path.join(home, '.config/pi-workbench/providers'),
    standards: path.join(home, '.config/pi-workbench/standards'),
    tasks: path.join(home, '.local/state/pi-workbench/tasks'),
    think: path.join(home, '.local/state/pi-workbench/think'),
  });
  assert.deepEqual(fs.readdirSync(home), []);
});

test('existing legacy paths remain active per item; XDG wins conflicts and explicit overrides win both', t => {
  const home = fixture(t);
  const env = { HOME: home, XDG_CONFIG_HOME: path.join(home, 'custom config'), XDG_STATE_HOME: path.join(home, 'custom state') };
  for (const name of ['.pi/tasks', '.pi/think', '.pi/standards', '.config/pi-workbench/providers']) fs.mkdirSync(path.join(home, name), { recursive: true });
  const policy = path.join(home, '.pi/model-capabilities.json');
  fs.writeFileSync(policy, 'legacy');
  const paths = workbenchPaths(env);
  assert.equal(paths.modelCapabilities, policy);
  assert.equal(paths.providers, path.join(home, '.config/pi-workbench/providers'));
  assert.equal(paths.standards, path.join(home, '.pi/standards'));
  assert.equal(paths.think, path.join(home, '.pi/think'));
  assert.equal(paths.tasks, path.join(home, '.pi/tasks'));
  const next = path.join(paths.state, 'tasks');
  fs.mkdirSync(next, { recursive: true });
  assert.equal(workbenchPaths(env).tasks, next);
  assert.equal(workbenchPaths({ ...env, PI_TASKS_DIR: '~/.pi/tasks' }).tasks, path.join(home, '.pi/tasks'));
  assert.equal(fs.readFileSync(policy, 'utf8'), 'legacy');
  assert.ok(fs.existsSync(path.join(home, '.pi/tasks')));
});

test('CLI paths, project setup, reports, and model validation agree on custom XDG roots', t => {
  const home = fixture(t);
  const env = { HOME: home, XDG_CONFIG_HOME: path.join(home, 'custom config'), XDG_STATE_HOME: path.join(home, 'custom state'), PATH: process.env.PATH };
  const run = (...args) => execFileSync(process.execPath, [cli, ...args], { env, encoding: 'utf8' }).trim();
  const paths = JSON.parse(run('paths'));
  assert.deepEqual(paths, JSON.parse(JSON.stringify(workbenchPaths(env))));
  run('init', 'nextjs', 'fixture');
  assert.ok(fs.existsSync(path.join(paths.standards, 'nextjs/projects/fixture.md')));
  run('report', 'init', 'fixture', 'Fixture report');
  assert.equal(fs.readdirSync(path.join(paths.tasks, 'general/main-session')).length, 1);
  fs.writeFileSync(paths.modelCapabilities, JSON.stringify({ 'example/model': { capabilities: ['coding'], tier: 'strong' } }));
  assert.ok(run('model-capabilities', 'validate').includes(paths.modelCapabilities));
  assert.equal(fs.existsSync(path.join(home, '.pi')), false);
});
