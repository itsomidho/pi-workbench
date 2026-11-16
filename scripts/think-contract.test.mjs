import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('think entry points disclose fallback and keep advisor routing separate', () => {
  for (const file of ['skills/think/SKILL.md', 'workflows/think.md']) {
    const text = read(file);
    assert.match(text, /Advisor unavailable; coordinator-only analysis/, file);
    assert.match(text, /verified read-only or tool-less execution boundary/, file);
    assert.match(text, /delegated runtime/, file);
    assert.match(text, /Pi commands, not shell commands/, file);
    assert.match(text, /response metadata/, file);
    assert.match(text, /unknown/, file);
  }
});

test('think skill preserves approval and does not require unavailable harness tools', () => {
  const text = read('skills/think/SKILL.md');
  assert.match(text, /Hand off \(only after the user says go\)/);
  assert.match(text, /local note after approval/);
  assert.match(text, /main-session work or unsupported domains/);
  assert.doesNotMatch(text, /AskUserQuestion|TodoWrite|TaskCreate|clawd-tasks|invoke it with the Skill tool/);
});

test('advisor instructions distinguish reasoning guidance from permission enforcement', () => {
  const text = read('skills/think-advisor/SKILL.md');
  assert.match(text, /do not enforce permissions/);
  assert.match(text, /tool-less run must use the supplied brief/);
  assert.match(text, /Do not edit files, create notes, install packages, invoke skills, delegate/);
});
