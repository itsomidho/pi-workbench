import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { discoverDomains, detectDomain, loadDomain, domainStageContext } from './domains.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-domains-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const app = path.join(dir, 'app'), repo = path.join(dir, 'repo');
  fs.mkdirSync(repo, { recursive: true });
  fs.mkdirSync(app, { recursive: true });
  fs.cpSync(path.join(root, 'domains/wordpress'), path.join(app, 'domains/wordpress'), { recursive: true });
  return { app, repo, dir };
}
function addDomain(app, id = 'sample', engine = 'main-session') {
  const dir = path.join(app, 'domains', id);
  for (const folder of ['roles', 'skills', 'standards/projects', 'workflows/development']) fs.mkdirSync(path.join(dir, folder), { recursive: true });
  fs.writeFileSync(path.join(dir, 'quality-gates.json'), '{}');
  fs.writeFileSync(path.join(dir, 'standards/projects/PROJECT.template.md'), '# Project name\n');
  fs.writeFileSync(path.join(dir, 'workflows/development/SKILL.md'), `---\nname: ${id}-development\ndescription: Synthetic test workflow\n---\n# ${id} workflow\n`);
  const manifest = { schemaVersion: 1, id, name: id, roles: './roles', skills: './skills', standards: './standards', workflows: './workflows', qualityGates: './quality-gates.json', detection: { any: [{ all: [{ path: 'sample.lock' }, { path: 'composer.json', jsonDependency: 'sample/framework' }] }] }, routes: { development: { entry: './workflows/development/SKILL.md', engine } } };
  if (engine === 'managed-development-v1') {
    fs.cpSync(path.join(app, 'domains/wordpress/workflows/development/workflow.json'), path.join(dir, 'workflows/development/workflow.json'));
    fs.cpSync(path.join(app, 'domains/wordpress/roles'), path.join(dir, 'roles'), { recursive: true });
    for (const file of fs.readdirSync(path.join(dir, 'roles'))) fs.writeFileSync(path.join(dir, 'roles', file), `SAMPLE DOMAIN ROLE ${file}`);
    manifest.routes.development.stages = './workflows/development/workflow.json';
  }
  const file = path.join(dir, 'domain.json');
  fs.writeFileSync(file, JSON.stringify(manifest));
  return { dir, manifest, save: () => fs.writeFileSync(file, JSON.stringify(manifest)) };
}
function markSample(repo) {
  fs.writeFileSync(path.join(repo, 'sample.lock'), '');
  fs.writeFileSync(path.join(repo, 'composer.json'), JSON.stringify({ require: { 'sample/framework': '^1' } }));
}

test('WordPress detection uses strong WP/Sage/Bedrock signals, not Acorn alone', t => {
  const { app, repo } = fixture(t);
  assert.equal(detectDomain(repo, app).status, 'unsupported');
  fs.writeFileSync(path.join(repo, 'composer.json'), '{"require":{"roots/acorn":"*"}}');
  assert.equal(detectDomain(repo, app).selected, null);
  fs.writeFileSync(path.join(repo, 'composer.json'), '{"require":{"roots/sage":"*"}}');
  assert.equal(detectDomain(repo, app).selected, 'wordpress');
  fs.unlinkSync(path.join(repo, 'composer.json'));
  fs.mkdirSync(path.join(repo, 'web/app'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'web/wp'), { recursive: true });
  assert.equal(detectDomain(repo, app).selected, 'wordpress');
});

test('adding a domain discovers resources and routes without editing Think or package.json', t => {
  const { app, repo } = fixture(t);
  markSample(repo);
  assert.equal(detectDomain(repo, app).status, 'unsupported');
  addDomain(app);
  const discovery = discoverDomains(app);
  assert.deepEqual(discovery.errors, []);
  assert.equal(discovery.domains.length, 2);
  const result = detectDomain(repo, app);
  assert.equal(result.selected, 'sample');
  assert.deepEqual(result.matches[0].evidence, ['sample.lock', 'composer.json: sample/framework']);
  assert.match(result.matches[0].routes.development.entry, /sample\/workflows\/development\/SKILL.md$/);
  assert.throws(() => domainStageContext('sample', 'implement', app), /No supported managed/);
  assert.ok(discovery.domains.find(d => d.id === 'sample').skillPaths.some(p => p.endsWith('SKILL.md')));
});

test('mixed stacks are ambiguous and component directories are evaluated explicitly', t => {
  const { app, repo } = fixture(t);
  addDomain(app);
  markSample(repo);
  fs.mkdirSync(path.join(repo, 'wp-content'));
  const result = detectDomain(repo, app);
  assert.equal(result.status, 'ambiguous');
  assert.equal(result.selected, null);
  const component = path.join(repo, 'component');
  fs.mkdirSync(component);
  markSample(component);
  assert.equal(detectDomain(component, app).selected, 'sample');
});

test('invalid manifests are reported, not silently used or replaced with WordPress', t => {
  const { app, repo } = fixture(t);
  const pack = addDomain(app);
  fs.mkdirSync(path.join(repo, 'wp-content'));
  pack.manifest.routes.development.engine = 'imaginary-engine';
  pack.save();
  assert.equal(discoverDomains(app).errors.length, 1);
  assert.equal(detectDomain(repo, app).status, 'unconfirmed');
  assert.equal(detectDomain(repo, app).selected, null);
  pack.manifest.routes.development.engine = 'main-session';
  pack.manifest.routes.development.entry = '../../../package.json';
  pack.save();
  assert.throws(() => loadDomain(app, 'sample'));
});

test('pack traversal, symlink escapes, missing files, and duplicate skill names fail validation', t => {
  const { app, dir } = fixture(t);
  const pack = addDomain(app);
  assert.throws(() => loadDomain(app, '../wordpress'), /Invalid domain id/);
  fs.writeFileSync(path.join(dir, 'outside.md'), 'outside');
  fs.symlinkSync(path.join(dir, 'outside.md'), path.join(pack.dir, 'outside.md'));
  pack.manifest.routes.development.entry = './outside.md'; pack.save();
  assert.throws(() => loadDomain(app, 'sample'), /escapes domain/);
  pack.manifest.routes.development.entry = './workflows/development/SKILL.md'; pack.save();
  fs.writeFileSync(path.join(pack.dir, 'workflows/development/SKILL.md'), '---\nname: wordpress-development\ndescription: duplicate\n---\n');
  assert.equal(discoverDomains(app).errors.length, 1);
  fs.unlinkSync(path.join(pack.dir, 'quality-gates.json'));
  assert.throws(() => loadDomain(app, 'sample'));
});

test('managed routes validate stages and load the selected domain role, never WP substitutes', t => {
  const { app } = fixture(t);
  const pack = addDomain(app, 'sample', 'managed-development-v1');
  const context = domainStageContext('sample', 'implement', app);
  assert.equal(context.role, 'developer');
  assert.equal(context.routerRole, 'developer');
  assert.match(context.text, /SAMPLE DOMAIN ROLE developer.md/);
  assert.match(context.text, /not a separate delegated agent/);
  const file = path.join(pack.dir, 'workflows/development/workflow.json');
  const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
  spec.stages.review.report = '99-custom';
  fs.writeFileSync(file, JSON.stringify(spec));
  assert.throws(() => domainStageContext('sample', 'implement', app), /Unsupported managed stage/);
});

test('detection does not read external repository symlinks or treat malformed JSON as a match', t => {
  const { app, repo, dir } = fixture(t);
  addDomain(app);
  fs.writeFileSync(path.join(dir, 'outside.json'), '{"require":{"roots/sage":"*"}}');
  fs.symlinkSync(path.join(dir, 'outside.json'), path.join(repo, 'composer.json'));
  assert.equal(detectDomain(repo, app).selected, null);
  fs.unlinkSync(path.join(repo, 'composer.json'));
  fs.writeFileSync(path.join(repo, 'composer.json'), '{');
  const result = detectDomain(repo, app);
  assert.equal(result.selected, null);
  assert.ok(result.errors.length);
});

test('domain CLI preserves caller repository directory and supports newly added packs', t => {
  const { app, repo } = fixture(t);
  addDomain(app); markSample(repo);
  const output = execFileSync(process.execPath, [path.join(root, 'scripts/piw.mjs'), 'domain', 'detect'], { cwd: repo, env: { ...process.env, PI_CONFIG_DIR: app }, encoding: 'utf8' });
  assert.equal(JSON.parse(output).selected, 'sample');
});

test('bundled packs identify Laravel, Django, and mixed applications without confusing Acorn', t => {
  const { repo } = fixture(t);
  assert.deepEqual(discoverDomains(root).errors, []);
  assert.deepEqual(discoverDomains(root).domains.map(d => d.id), ['django', 'laravel', 'nextjs', 'nuxt', 'wordpress']);
  fs.writeFileSync(path.join(repo, 'artisan'), '<?php');
  fs.writeFileSync(path.join(repo, 'composer.json'), '{"require":{"laravel/framework":"^12"}}');
  assert.equal(detectDomain(repo, root).selected, 'laravel');
  fs.writeFileSync(path.join(repo, 'manage.py'), 'print("unrelated Python tool")');
  assert.equal(detectDomain(repo, root).selected, 'laravel');
  fs.writeFileSync(path.join(repo, 'manage.py'), 'from django.core.management import execute_from_command_line\n');
  assert.equal(detectDomain(repo, root).status, 'ambiguous');
  fs.unlinkSync(path.join(repo, 'artisan'));
  assert.equal(detectDomain(repo, root).selected, 'django');
  fs.unlinkSync(path.join(repo, 'manage.py'));
  fs.writeFileSync(path.join(repo, 'composer.json'), '{"require":{"roots/acorn":"*"}}');
  assert.equal(detectDomain(repo, root).status, 'unsupported');
  fs.mkdirSync(path.join(repo, 'wp-content'));
  assert.equal(detectDomain(repo, root).selected, 'wordpress');
});

test('Next.js and Nuxt detection requires actual dependency keys, not React/Vue or configuration names', t => {
  const { repo } = fixture(t);
  const packageFile = path.join(repo, 'package.json');
  fs.writeFileSync(path.join(repo, 'next.config.ts'), 'export default {}');
  fs.writeFileSync(path.join(repo, 'nuxt.config.ts'), 'export default {}');
  for (const pkg of [
    { dependencies: { react: '*', vue: '*' } },
    { scripts: { build: 'next build', dev: 'nuxt dev' } },
    { peerDependencies: { next: '*', nuxt: '*' } },
  ]) {
    fs.writeFileSync(packageFile, JSON.stringify(pkg));
    assert.equal(detectDomain(repo, root).status, 'unsupported');
  }
  for (const [dependency, expected] of [['next', 'nextjs'], ['nuxt', 'nuxt']]) {
    for (const section of ['dependencies', 'devDependencies']) {
      fs.writeFileSync(packageFile, JSON.stringify({ [section]: { [dependency]: '^1' } }));
      const result = detectDomain(repo, root);
      assert.equal(result.selected, expected);
      assert.ok(result.matches[0].evidence.includes(`package.json: ${dependency}`));
    }
  }
  fs.writeFileSync(packageFile, JSON.stringify({ dependencies: { next: '*', nuxt: '*' } }));
  assert.equal(detectDomain(repo, root).status, 'ambiguous');
  assert.equal(detectDomain(repo, root).selected, null);
});

test('workspace component selection separates Next.js and Nuxt without recursive guessing', t => {
  const { repo } = fixture(t);
  fs.writeFileSync(path.join(repo, 'package.json'), '{"private":true,"workspaces":["apps/*"]}');
  for (const [name, dependency, expected] of [['react-site', 'next', 'nextjs'], ['vue-site', 'nuxt', 'nuxt']]) {
    const component = path.join(repo, 'apps', name);
    fs.mkdirSync(component, { recursive: true });
    fs.writeFileSync(path.join(component, 'package.json'), JSON.stringify({ dependencies: { [dependency]: '*' } }));
    assert.equal(detectDomain(component, root).selected, expected);
  }
  assert.equal(detectDomain(repo, root).status, 'unsupported');
});

test('frontend packs initialize local project templates through the installed CLI contract', t => {
  const { repo, dir } = fixture(t);
  const standards = path.join(dir, 'local-standards');
  for (const domain of ['nextjs', 'nuxt']) {
    execFileSync(process.execPath, [path.join(root, 'scripts/piw.mjs'), 'init', domain, 'sample-site'], {
      cwd: repo, env: { ...process.env, PI_CONFIG_DIR: root, PI_STANDARDS_DIR: standards },
    });
    const text = fs.readFileSync(path.join(standards, domain, 'projects/sample-site.md'), 'utf8');
    assert.match(text, /^# sample-site/);
    assert.ok(text.includes(`Domain: ${domain}`));
    assert.ok(text.includes('SSR/SSG/client-only'));
    assert.ok(text.includes('Package manager'));
  }
});

test('content signals are validated, bounded, and reject external symlinks', t => {
  const { app, repo, dir } = fixture(t);
  const pack = addDomain(app);
  pack.manifest.detection = { any: [{ all: [{ path: 'manage.py', contains: 'django.core.management' }] }] };
  pack.save();
  fs.writeFileSync(path.join(repo, 'manage.py'), 'django.core.management');
  assert.equal(detectDomain(repo, app).selected, 'sample');
  fs.writeFileSync(path.join(repo, 'manage.py'), 'django.core.management' + ' '.repeat(1024 * 1024));
  assert.equal(detectDomain(repo, app).selected, null);
  fs.unlinkSync(path.join(repo, 'manage.py'));
  fs.writeFileSync(path.join(dir, 'outside.py'), 'django.core.management');
  fs.symlinkSync(path.join(dir, 'outside.py'), path.join(repo, 'manage.py'));
  assert.equal(detectDomain(repo, app).selected, null);
  pack.manifest.detection.any[0].all[0].contains = '';
  pack.save();
  assert.throws(() => loadDomain(app, 'sample'), /Invalid contains/);
});

test('domain skills require actual frontmatter and an advertised description', t => {
  const { app } = fixture(t);
  const pack = addDomain(app);
  const file = path.join(pack.dir, 'workflows/development/SKILL.md');
  for (const text of ['# No frontmatter\nname: sample-development\ndescription: not metadata\n', '---\nname: sample-development\n---\n']) {
    fs.writeFileSync(file, text);
    assert.ok(discoverDomains(app).errors.some(item => item.domain === 'sample'));
  }
});

test('Pi hooks discover added skills on reload and attach evidence without launching work', async t => {
  const { app, repo } = fixture(t);
  const old = process.env.PI_CONFIG_DIR;
  process.env.PI_CONFIG_DIR = app;
  t.after(() => { if (old === undefined) delete process.env.PI_CONFIG_DIR; else process.env.PI_CONFIG_DIR = old; });
  const hooks = new Map();
  const extension = await import('../extensions/domain-discovery.ts');
  extension.default({ on: (name, handler) => hooks.set(name, handler) });
  const before = hooks.get('resources_discover')().skillPaths.length;
  addDomain(app); markSample(repo);
  assert.equal(hooks.get('resources_discover')().skillPaths.length, before + 1);
  const result = hooks.get('before_agent_start')({ prompt: '# Think workflow for Pi\nAdd an API' }, { cwd: repo });
  assert.match(result.message.content, /"selected":"sample"/);
  assert.match(result.message.content, /not execution approval/);
  assert.equal(hooks.get('before_agent_start')({ prompt: 'ordinary message' }, { cwd: repo }), undefined);
});
