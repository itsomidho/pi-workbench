import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const initialVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version;
const nextVersion = '0.5.14-smoke.1'; // Fixture only; never a published release.
const locate = name => fs.realpathSync(execFileSync('sh', ['-c', `command -v ${name}`], { encoding: 'utf8' }).trim());
const realPi = locate('pi'), realNpm = locate('npm');

function fixture(t, customAgent = false) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'piw consumer lifecycle '));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const home = path.join(base, 'home'), app = path.join(home, '.pi-workbench');
  const bin = path.join(base, 'transport'), prefix = path.join(base, 'prefix');
  const agent = customAgent === 'relative' ? path.join(home, 'custom agent') : customAgent ? path.join(base, 'custom agent') : path.join(home, '.pi/agent');
  for (const dir of [home, bin, agent, path.join(base, 'tmp')]) fs.mkdirSync(dir, { recursive: true });
  fs.cpSync(root, app, { recursive: true, filter: file => !path.relative(root, file).split(path.sep).some(p => ['.git', 'node_modules'].includes(p)) });
  fs.writeFileSync(path.join(agent, 'settings.json'), JSON.stringify({ packages: [], fixtureMarker: 'preserve-settings' }));
  fs.writeFileSync(path.join(agent, 'auth.json'), 'fixture-auth-state');
  const env = {
    HOME: home, XDG_CONFIG_HOME: path.join(home, '.config'), TMPDIR: path.join(base, 'tmp'),
    PATH: [bin, path.join(prefix, 'bin'), path.dirname(process.execPath), process.env.PATH].join(path.delimiter),
    PI_WORKBENCH_HOME: app, PI_OFFLINE: '1', PI_SKIP_VERSION_CHECK: '1', PI_TELEMETRY: '0',
    npm_config_prefix: prefix, npm_config_cache: path.join(base, 'cache'),
    npm_config_update_notifier: 'false', npm_config_audit: 'false', npm_config_fund: 'false',
    PI_TEST_ARCHIVE: path.join(base, 'release.tar.gz'), PI_TEST_CURL_MARKER: path.join(base, 'curl-contact'),
    PI_TEST_FAIL_PI: '0', PI_TEST_FAIL_NPM: '0', PI_TEST_FAIL_ROLLBACK: '0',
  };
  if (customAgent) env.PI_AGENT_DIR = agent;
  const wrapper = (name, source) => fs.writeFileSync(path.join(bin, name), '#!/usr/bin/env node\n' + source, { mode: 0o755 });
  wrapper('pi', `import {spawnSync} from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path';
if(process.env.PI_TEST_FAIL_PI==='1' && process.argv[2]==='install') {
 const dir=process.env.PI_CODING_AGENT_DIR||process.env.PI_AGENT_DIR||path.join(process.env.HOME,'.pi/agent');
 fs.writeFileSync(path.join(dir,'settings.json'),JSON.stringify({packages:[],fixtureMarker:'partially-mutated'}));
 process.exit(42);
}
const p=spawnSync(process.execPath,[${JSON.stringify(realPi)},...process.argv.slice(2)],{stdio:'inherit'}); process.exit(p.status??1);`);
  wrapper('npm', `import {spawnSync} from 'node:child_process';
const args=process.argv.slice(2);
if(process.env.PI_TEST_FAIL_ROLLBACK==='1' && args[0]==='install' && args.some(a=>a.endsWith('pi-workbench-${initialVersion}.tgz'))) process.exit(44);
const p=spawnSync(process.execPath,[${JSON.stringify(realNpm)},...args],{stdio:'inherit'});
if(process.env.PI_TEST_FAIL_NPM==='1' && args[0]==='install' && args.some(a=>a.endsWith('pi-workbench-${nextVersion}.tgz'))) process.exit(43);
process.exit(p.status??1);`);
  wrapper('curl', `import fs from 'node:fs';
const a=process.argv.slice(2); fs.appendFileSync(process.env.PI_TEST_CURL_MARKER,'contact\\n');
if(a.includes('-o')) { if(!a.includes('https://fixture.invalid/release.tar.gz'))process.exit(91); fs.copyFileSync(process.env.PI_TEST_ARCHIVE,a[a.indexOf('-o')+1]); }
else { if(!a.includes('https://api.github.com/repos/itsomidho/pi-workbench/releases/latest'))process.exit(92); console.log(JSON.stringify({tag_name:'v${nextVersion}',tarball_url:'https://fixture.invalid/release.tar.gz'})); }`);
  const run = (cmd, args, extra = {}) => spawnSync(cmd, args, { cwd: home, env: { ...env, ...extra }, encoding: 'utf8', timeout: 90000 });
  const ok = result => { assert.equal(result.status, 0, result.stderr + '\n' + result.stdout); return result.stdout.trim(); };
  ok(run('bash', [path.join(app, 'scripts/install.sh')]));
  const candidate = path.join(base, 'candidate');
  fs.cpSync(app, candidate, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(candidate, 'package.json')));
  fs.writeFileSync(path.join(candidate, 'package.json'), JSON.stringify({ ...manifest, version: nextVersion }));
  ok(run('tar', ['-czf', env.PI_TEST_ARCHIVE, '-C', base, 'candidate']));
  const cli = path.join(prefix, 'bin/piw');
  const version = () => ok(run(cli, ['version']));
  const appVersion = () => JSON.parse(fs.readFileSync(path.join(app, 'package.json'))).version;
  const settings = () => JSON.parse(fs.readFileSync(path.join(agent, 'settings.json')));
  const checkState = () => {
    assert.equal(fs.readFileSync(path.join(agent, 'auth.json'), 'utf8'), 'fixture-auth-state');
    assert.equal(settings().fixtureMarker, 'preserve-settings');
    assert.deepEqual(settings().packages.map(item => path.resolve(agent, typeof item === 'string' ? item : item.source)), [app]);
  };
  return { base, home, app, agent, env, cli, run, ok, version, appVersion, settings, checkState };
}

test('real consumer install and archive update keep CLI, registration and private state aligned', t => {
  const f = fixture(t);
  assert.equal(f.version(), initialVersion); f.checkState();
  const configured = f.settings();
  configured.packages = configured.packages.map(source => ({ source, skills: [], extensions: ['extensions/model-router.ts'] }));
  fs.writeFileSync(path.join(f.agent, 'settings.json'), JSON.stringify(configured));
  f.ok(f.run(f.cli, ['update', '--yes']));
  assert.deepEqual(f.settings(), configured, 'Updates must preserve resource filters and unrelated settings');
  assert.equal(f.appVersion(), nextVersion);
  assert.equal(f.version(), nextVersion); f.checkState();
  f.ok(f.run(f.cli, ['domain', 'check']));
});

test('installer honors PI_AGENT_DIR for the actual Pi registration', t => {
  const f = fixture(t, true);
  f.checkState();
  assert.equal(fs.existsSync(path.join(f.home, '.pi/agent/settings.json')), false);
});

test('relative agent paths remain stable when updating from the directory being replaced', t => {
  const f = fixture(t, 'relative');
  const result = spawnSync(f.cli, ['update', '--yes'], { cwd: f.app, env: { ...f.env, PI_CODING_AGENT_DIR: path.relative(f.app, f.agent) }, encoding: 'utf8', timeout: 90000 });
  f.ok(result);
  assert.equal(f.version(), nextVersion); f.checkState();
});

for (const [name, failure] of [['Pi registration', 'PI_TEST_FAIL_PI'], ['partially completed npm install', 'PI_TEST_FAIL_NPM']]) {
  test(`failed ${name} restores application, global CLI and private state`, t => {
    const f = fixture(t);
    const result = f.run(f.cli, ['update', '--yes'], { [failure]: '1' });
    assert.notEqual(result.status, 0, 'Injected failure must fail the update');
    assert.equal(f.appVersion(), initialVersion, result.stderr);
    assert.equal(f.version(), initialVersion, 'Global CLI must roll back with the application');
    f.checkState();
  });
}

test('archive identity mismatch is rejected before installation changes', t => {
  const f = fixture(t);
  const manifestFile = path.join(f.base, 'candidate/package.json');
  const candidate = JSON.parse(fs.readFileSync(manifestFile));
  fs.writeFileSync(manifestFile, JSON.stringify({ ...candidate, name: 'not-workbench' }));
  f.ok(f.run('tar', ['-czf', f.env.PI_TEST_ARCHIVE, '-C', f.base, 'candidate']));
  const result = f.run(f.cli, ['update', '--yes']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /identity\/version/);
  assert.equal(f.appVersion(), initialVersion);
  assert.equal(f.version(), initialVersion); f.checkState();
});

test('incomplete rollback retains recovery archives and reports the failure', t => {
  const f = fixture(t);
  const result = f.run(f.cli, ['update', '--yes'], { PI_TEST_FAIL_PI: '1', PI_TEST_FAIL_ROLLBACK: '1' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Rollback incomplete: global CLI/);
  assert.match(result.stderr, /Recovery files retained/);
  const recovery = fs.readdirSync(path.join(f.base, 'tmp')).find(name => name.startsWith('pi-workbench-update-'));
  assert.ok(recovery, 'Recovery directory must survive a failed rollback');
  assert.ok(fs.readdirSync(path.join(f.base, 'tmp', recovery, 'previous-package')).some(name => name.endsWith('.tgz')));
  assert.equal(f.appVersion(), initialVersion); f.checkState();
});

test('archive updater refuses a Git target even when its own module is outside Git', t => {
  const f = fixture(t);
  const copy = path.join(f.base, 'external');
  fs.cpSync(f.app, copy, { recursive: true });
  fs.writeFileSync(path.join(f.app, '.git'), 'gitdir: /fixture-only');
  const result = f.run(process.execPath, [path.join(copy, 'scripts/update.mjs'), '--yes']);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /Source checkout detected/);
  assert.equal(fs.existsSync(f.env.PI_TEST_CURL_MARKER), false);
  assert.equal(f.appVersion(), initialVersion);
});
