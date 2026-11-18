import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const pack = path.resolve(new URL('../domains/wordpress', import.meta.url).pathname);

test('WordPress guide reference files resolve beside the installed skill', () => {
  const guide = path.join(pack, 'skills/wordpress-guide');
  const text = fs.readFileSync(path.join(guide, 'SKILL.md'), 'utf8');
  const references = [...text.matchAll(/^- \*\*`([^`]+\.md)`\*\*/gm)].map(match => match[1]);
  assert.ok(references.length >= 10);
  for (const reference of references) assert.ok(fs.statSync(path.resolve(guide, reference)).isFile(), reference);
});

test('WordPress roles use bundled rules and domain-scoped private project facts', () => {
  const roles = path.join(pack, 'roles');
  for (const file of fs.readdirSync(roles).filter(name => name.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(roles, file), 'utf8');
    assert.match(text, /\.\.\/standards\/README\.md/, file);
    assert.match(text, /\$PI_STANDARDS_DIR\/wordpress\/projects\//, file);
    assert.doesNotMatch(text, /\$PI_STANDARDS_DIR\/(?:README\.md|checklists\/)/, file);
    for (const reference of [...text.matchAll(/`(\.\.\/[^`]+\.(?:md))`/g)].map(match => match[1])) {
      assert.ok(fs.statSync(path.resolve(roles, reference)).isFile(), `${file}: ${reference}`);
    }
  }
});

test('WordPress workflow startup, task template, and MR helper paths exist without root-level local rules', () => {
  const development = path.join(pack, 'workflows/development');
  const review = path.join(pack, 'workflows/merge-request-review');
  const text = fs.readFileSync(path.join(development, 'SKILL.md'), 'utf8');
  assert.match(text, /\$PI_TASKS_DIR\/wordpress\//);
  assert.ok(fs.statSync(path.resolve(development, '../../../../workflows/TASK.template.md')).isFile());
  for (const folder of [development, review]) {
    const body = fs.readFileSync(path.join(folder, 'SKILL.md'), 'utf8');
    assert.match(body, /\.\.\/\.\.\/standards\/(?:README|checklists\/INDEX)\.md/);
    assert.doesNotMatch(body, /\$PI_STANDARDS_DIR\/(?:README\.md|checklists\/)/);
  }
  assert.ok(fs.statSync(path.join(review, 'scripts/diff_lines.py')).isFile());
  assert.match(fs.readFileSync(path.join(review, 'SKILL.md'), 'utf8'), /python3 "\$MR_HELPER"/);
});

test('WordPress REST guidance does not rely on warnings or sanitizers as validation boundaries', () => {
  const guide = path.join(pack, 'skills/wordpress-guide');
  const rest = fs.readFileSync(path.join(guide, 'rest-api.md'), 'utf8');
  const security = fs.readFileSync(path.join(guide, 'security.md'), 'utf8');
  assert.doesNotMatch(rest, /refuses to register|won't register/);
  assert.match(rest, /does not refuse registration/);
  assert.match(rest, /schema validation can be bypassed/);
  for (const text of [rest, security]) assert.match(text, /'validate_callback'\s*=>\s*'rest_validate_request_arg'/);
});
