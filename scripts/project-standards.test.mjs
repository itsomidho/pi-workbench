import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { findProjectStandards, localStandardsRoot } from './project-standards.mjs';

function fixture(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-project-facts-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const repo = path.join(home, 'sites/served academy'), root = path.join(home, 'standards'), dir = path.join(root, 'wordpress/projects');
  fs.mkdirSync(repo, { recursive: true }); fs.mkdirSync(dir, { recursive: true });
  const write = (name, text) => fs.writeFileSync(path.join(dir, name), text);
  const find = (directory = repo) => findProjectStandards(directory, 'wordpress', { home, standardsRoot: root });
  return { home, repo, root, dir, write, find };
}

test('project standards match home-relative table paths despite unrelated filenames and historical notes', t => {
  const f = fixture(t);
  f.write('academy.md', '| Local path | `~/sites/served academy` (moved; old `~/obsolete` is not served) |\n');
  f.write('other.md', 'Prose mentions ~/sites/served academy but does not declare it.');
  const r = f.find();
  assert.equal(r.status, 'matched'); assert.equal(r.selected, path.join(f.dir, 'academy.md'));
  assert.equal(r.matches[0].repository, fs.realpathSync(f.repo));
});

test('bullet template identity fields and custom home-relative standards roots resolve', t => {
  const f = fixture(t);
  for (const field of ['Local path', 'Repository/component absolute path', 'Repository path', 'Repository']) {
    f.write('project.md', `- ${field}: \`${f.repo}\`\n`);
    assert.equal(f.find().status, 'matched', field);
  }
  assert.equal(findProjectStandards(f.repo, 'wordpress', { home: f.home, standardsRoot: '~/standards' }).status, 'matched');
  const previous = process.env.PI_STANDARDS_DIR;
  process.env.PI_STANDARDS_DIR = '~/standards';
  t.after(() => { if (previous === undefined) delete process.env.PI_STANDARDS_DIR; else process.env.PI_STANDARDS_DIR = previous; });
  assert.equal(localStandardsRoot(f.home), f.root);
});

test('canonical symlink paths and true component directories match without sibling-prefix false positives', t => {
  const f = fixture(t), alias = path.join(f.home, 'alias'); fs.symlinkSync(f.repo, alias);
  f.write('project.md', `- Local path: ${alias}\n`);
  const child = path.join(f.repo, 'theme'); fs.mkdirSync(child);
  assert.equal(f.find(child).matches[0].relationship, 'component');
  const sibling = f.repo + '-other'; fs.mkdirSync(sibling);
  assert.equal(f.find(sibling).status, 'missing');
  assert.equal(f.find().status, 'matched');
});

test('multiple standards matches remain ambiguous instead of selecting the first', t => {
  const f = fixture(t);
  f.write('one.md', `- Local path: ${f.repo}\n`); f.write('two.md', `| Local path | \`${f.repo}\` |\n`);
  assert.equal(f.find().status, 'ambiguous'); assert.equal(f.find().selected, null);
});

test('templates, placeholders, stale paths, URL references and shell-like values do not invent matches', t => {
  const f = fixture(t);
  f.write('PROJECT.template.md', `- Local path: ${f.repo}\n`);
  f.write('empty.md', '- Local path: <fill in>\n- Remote: git@example.invalid/repo\n- Repository: $(touch unsafe)\n');
  f.write('old.md', `| Local path | \`~/obsolete\` (old ${f.repo}) |\n`);
  assert.equal(f.find().status, 'missing'); assert.equal(f.find().selected, null);
});

test('escaping standards symlinks and oversized files produce unconfirmed, not a false missing-project claim', t => {
  const f = fixture(t), outside = path.join(f.home, 'outside.md'); fs.writeFileSync(outside, `- Local path: ${f.repo}\n`);
  fs.symlinkSync(outside, path.join(f.dir, 'escape.md'));
  f.write('large.md', ' '.repeat(1024 * 1024 + 1));
  f.write('valid.md', `- Local path: ${f.repo}\n`);
  const r = f.find(); assert.equal(r.status, 'unconfirmed'); assert.equal(r.selected, null); assert.equal(r.errors.length, 2);
});

test('project standards directories cannot escape their configured root', t => {
  const f = fixture(t), other = path.join(f.home, 'outside'); fs.mkdirSync(other);
  fs.rmdirSync(f.dir); fs.symlinkSync(other, f.dir);
  assert.equal(f.find().status, 'unconfirmed'); assert.equal(f.find().selected, null);
  assert.throws(() => findProjectStandards(f.repo, '../other', { standardsRoot: f.root }), /Invalid standards domain/);
});

test('a dangling standards-directory symlink is unconfirmed rather than absent', t => {
  const f = fixture(t);
  fs.rmdirSync(f.dir); fs.symlinkSync(path.join(f.home, 'missing'), f.dir);
  const r = f.find(); assert.equal(r.status, 'unconfirmed'); assert.equal(r.selected, null);
});

test('bounded scans never silently choose a partial project match', t => {
  const f = fixture(t);
  for (let i = 0; i < 251; i++) f.write(`project-${String(i).padStart(3, '0')}.md`, `- Local path: ${i === 0 ? f.repo : '/does-not-exist'}\n`);
  const r = f.find(); assert.equal(r.status, 'unconfirmed'); assert.equal(r.selected, null); assert.ok(r.errors.some(e => e.includes('250')));
});

test('Think injection includes the effective standards root and exact matched project file', async t => {
  const f = fixture(t); fs.mkdirSync(path.join(f.repo, 'wp-content'));
  f.write('academy.md', '| Local path | `~/sites/served academy` |\n');
  const keys = ['HOME', 'PI_STANDARDS_DIR', 'PI_CONFIG_DIR'];
  const previous = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  process.env.HOME = f.home; process.env.PI_STANDARDS_DIR = f.root;
  process.env.PI_CONFIG_DIR = path.resolve(new URL('..', import.meta.url).pathname);
  t.after(() => { for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } });
  const hooks = new Map();
  const extension = await import('../extensions/domain-discovery.ts');
  extension.default({ on: (name, handler) => hooks.set(name, handler) });
  const r = hooks.get('before_agent_start')({ prompt: '# Think workflow for Pi\nInspect this project' }, { cwd: f.repo });
  assert.ok(r.message.content.includes(`Effective local standards root: ${f.root}`));
  assert.ok(r.message.content.includes(path.join(f.dir, 'academy.md')));
  assert.match(r.message.content, /"status":"matched"/);
  assert.match(r.message.content, /Read the selected project file/);
});
