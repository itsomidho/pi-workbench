import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';
import { buildTaskReport, initMainSessionTask, redactText } from './report-data.mjs';
import { renderHtml, renderMarkdown, writeTaskReport } from './report-render.mjs';

const app = path.resolve(new URL('..', import.meta.url).pathname);
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-reports-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dir = initMainSessionTask('sample-task', 'A readable task report', root);
  const plan = '1. Fix the issue.\n2. Verify it.';
  fs.writeFileSync(path.join(dir, 'TASK.md'), `# Task: A readable task report\n\n| Domain | general |\n| Project | main-session |\n| Status | done |\n| Started | 2026-11-18 |\n\n## Brief\nThe original problem and requested behavior.\n\n## Decisions and constraints\nDo not publish.\n\n## Plan\n${plan}\n\n## Next step\nReport the result.\n`);
  const sharedFile = path.join(dir, 'artifacts/shared-context.json');
  const shared = JSON.parse(fs.readFileSync(sharedFile, 'utf8'));
  Object.assign(shared, { planVersion: 1, approvedPlanHash: crypto.createHash('sha256').update(plan).digest('hex'), acceptanceCriteria: ['Behavior is correct'] });
  fs.writeFileSync(sharedFile, JSON.stringify(shared));
  const writeBrief = (name, extra = {}) => fs.writeFileSync(path.join(dir, 'artifacts/briefs', `${name}.json`), JSON.stringify({ schemaVersion: 1, stage: name, status: 'completed', summary: `Summary of ${name}`, changedFiles: ['src/example.js'], commandsRun: [], findings: [], knownRisks: [], nextChecks: [], evidence: [], createdAt: '2026-11-18T12:00:00Z', ...extra }));
  return { root, dir, writeBrief, sharedFile };
}
function conforms(schema, value, at = 'report') {
  if (schema.const !== undefined) assert.equal(value, schema.const, at);
  if (schema.enum) assert.ok(schema.enum.includes(value), at);
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    assert.ok(types.includes(type) || (types.includes('integer') && Number.isInteger(value)), `${at}: ${type}`);
  }
  if (typeof value === 'number' && schema.minimum !== undefined) assert.ok(value >= schema.minimum, at);
  if (value && !Array.isArray(value) && typeof value === 'object' && schema.properties) {
    for (const key of schema.required ?? []) assert.ok(Object.hasOwn(value, key), `${at}.${key}`);
    if (schema.additionalProperties === false) for (const key of Object.keys(value)) assert.ok(Object.hasOwn(schema.properties, key), `${at}.${key}`);
    for (const [key, property] of Object.entries(schema.properties)) if (Object.hasOwn(value, key)) conforms(property, value[key], `${at}.${key}`);
  }
  if (Array.isArray(value) && schema.items) value.forEach((item, index) => conforms(schema.items, item, `${at}[${index}]`));
}

test('JSON, Markdown, and HTML share one evidence-backed report model', t => {
  const f = fixture(t);
  f.writeBrief('02-implement', { commandsRun: ['npm test', { command: 'npm run check', exitCode: 0 }, { command: 'npm run build', exitCode: 2 }], knownRisks: ['Application smoke test is pending.'] });
  const { report, paths } = writeTaskReport(f.dir, { tasksRoot: f.root, generatedAt: '2026-11-18T12:00:00Z', details: { summary: 'The change is implemented; build failed.', changes: [{ file: 'src/example.js', summary: 'Correct the invalid state transition.' }] } });
  assert.equal(report.task.status, 'completed');
  assert.equal(report.plan.approval, 'recorded');
  assert.equal(report.plan.content, '1. Fix the issue.\n2. Verify it.');
  assert.equal(report.issue.request, 'The original problem and requested behavior.');
  assert.deepEqual(report.verification.map(c => c.status), ['unverified', 'passed', 'failed']);
  assert.equal(report.acceptanceCriteria[0].status, 'unverified');
  assert.equal(report.delivery.deployed.status, 'unknown');
  assert.deepEqual(JSON.parse(fs.readFileSync(paths.json, 'utf8')), report);
  assert.equal(fs.readFileSync(paths.html, 'utf8'), renderHtml(report));
  assert.equal(fs.readFileSync(paths.markdown, 'utf8'), renderMarkdown(report));
  conforms(JSON.parse(fs.readFileSync(path.join(app, 'schemas/task-report.schema.json'), 'utf8')), report);
});

test('unproved success, acceptance, approval, and delivery stay unverified', t => {
  const f = fixture(t);
  const shared = JSON.parse(fs.readFileSync(f.sharedFile, 'utf8'));
  shared.approvedPlanHash = 'changed'; fs.writeFileSync(f.sharedFile, JSON.stringify(shared));
  const report = buildTaskReport(f.dir, { tasksRoot: f.root, details: { verification: [{ name: 'Claimed pass', status: 'passed' }, { name: 'Contradictory pass', status: 'passed', exitCode: 1 }], acceptanceCriteria: [{ criterion: 'It works', status: 'met' }], delivery: { deployed: { status: 'yes' } } } });
  assert.equal(report.plan.approval, 'unverified');
  assert.deepEqual(report.verification.map(c => c.status), ['unverified', 'failed']);
  assert.equal(report.acceptanceCriteria[0].status, 'unverified');
  assert.equal(report.delivery.deployed.status, 'unknown');
});

test('blocked, stopped, and in-progress reports do not pretend the task completed', t => {
  const f = fixture(t);
  for (const status of ['blocked', 'stopped', 'in-progress']) {
    const { report, paths } = writeTaskReport(f.dir, { tasksRoot: f.root, status, reason: 'Work paused for a decision.' });
    assert.equal(report.task.status, status);
    assert.ok(fs.readFileSync(paths.html, 'utf8').includes('Work paused for a decision.'));
  }
  assert.throws(() => buildTaskReport(f.dir, { tasksRoot: f.root, status: 'success-maybe' }), /Invalid report status/);
});

test('HTML and Markdown treat report content as text, never executable markup or links', t => {
  const f = fixture(t);
  const attack = '</style><script>alert(1)</script><img src="https://bad.invalid/a" onerror="alert(2)"> [click](javascript:alert(3))';
  const report = buildTaskReport(f.dir, { tasksRoot: f.root, details: { summary: attack, verification: [{ name: attack, command: attack, result: attack, status: 'unverified' }], changes: [{ file: attack, summary: attack }] } });
  const html = renderHtml(report), markdown = renderMarkdown(report);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!/<script\b|<img\b|onerror="|href="javascript:/i.test(html));
  assert.ok(!markdown.includes('<script>'));
  assert.ok(!markdown.includes('[click](javascript:'));
  assert.ok(html.includes("default-src 'none'"));
  assert.ok(!/<link\b|<iframe\b|<script\b|@import|url\(/i.test(html));
});

test('redaction applies to all outputs and excludes arbitrary metadata and secret lists', t => {
  const f = fixture(t);
  const secrets = ['my-explicit-private-value', 'sensitive-password', 'secret-bearer-token'];
  const { paths } = writeTaskReport(f.dir, { tasksRoot: f.root, details: { summary: `value ${secrets[0]} PASSWORD=${secrets[1]} Authorization: Bearer ${secrets[2]}`, redactValues: [secrets[0]], unexpectedRawLog: 'never-export-this', risks: ['https://name:privatepass@example.invalid?token=privatequery'] } });
  for (const file of Object.values(paths)) {
    const output = fs.readFileSync(file, 'utf8');
    for (const secret of [...secrets, 'privatepass', 'privatequery', 'never-export-this']) assert.ok(!output.includes(secret), secret);
    assert.ok(!output.includes('redactValues'));
    assert.match(output, /REDACTED/);
  }
  assert.ok(!redactText('-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----').includes('abc'));
});

test('reports only include the selected managed run and verified response model metadata', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.dir, 'artifacts/state.json'), JSON.stringify({ runId: 'new', active: false, reportStatus: 'blocked' }));
  f.writeBrief('02-implement', { runId: 'new' });
  f.writeBrief('08-finish', { runId: 'old', summary: 'Stale finished work' });
  fs.writeFileSync(path.join(f.dir, 'artifacts/usage.jsonl'), [
    { runId: 'old', provider: 'old', model: 'old', usage: { input: 5000 } },
    { runId: 'new', provider: 'router', model: 'auto', usage: { input: 5 } },
    { runId: 'new', provider: 'mock-local', model: 'mock-model', usage: { input: 10, output: 4, cost: { total: 0 } } },
  ].map(v => JSON.stringify(v)).join('\n'));
  const report = buildTaskReport(f.dir, { tasksRoot: f.root });
  assert.equal(report.task.status, 'blocked');
  assert.equal(report.task.execution, 'main-session'); // Explicit execution metadata wins over an inferred mode.
  assert.deepEqual(report.stages.map(s => s.stage), ['02-implement']);
  assert.deepEqual(report.usage.models, ['mock-local/mock-model']);
  assert.equal(report.usage.inputTokens, 15);
  assert.equal(report.usage.reportedCost, 0);
});

test('malformed usage records are omitted without crashing or inventing usage', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.dir, 'artifacts/usage.jsonl'), 'null\n[]\n42\n' + JSON.stringify({ provider: 'mock', model: 'x', usage: { input: 2 } }) + '\n');
  const report = buildTaskReport(f.dir, { tasksRoot: f.root });
  assert.equal(report.usage.responses, 1);
  assert.equal(report.usage.inputTokens, 2);
  assert.ok(report.warnings.some(w => w.includes('usage record')));
});

test('non-object optional metadata and a non-directory briefs path are omitted with warnings', t => {
  const f = fixture(t);
  fs.rmdirSync(path.join(f.dir, 'artifacts/briefs'));
  fs.writeFileSync(path.join(f.dir, 'artifacts/briefs'), 'Not a directory');
  fs.writeFileSync(path.join(f.dir, 'artifacts/report-details.json'), '[]');
  const report = buildTaskReport(f.dir, { tasksRoot: f.root });
  assert.ok(report.warnings.some(w => w.includes('artifacts/briefs')));
  assert.ok(report.warnings.some(w => w.includes('report-details.json')));
  assert.deepEqual(report.stages, []);
});

test('active managed runs cannot be overwritten by a terminal snapshot', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.dir, 'artifacts/state.json'), JSON.stringify({ active: true, runId: 'active' }));
  assert.throws(() => buildTaskReport(f.dir, { tasksRoot: f.root, status: 'completed' }), /still active/);
  assert.equal(buildTaskReport(f.dir, { tasksRoot: f.root }).task.status, 'in-progress');
});

test('baseline acceptance criteria survive empty finish metadata and optional corrupt inputs', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.dir, 'artifacts/report-details.json'), '{broken');
  const report = buildTaskReport(f.dir, { tasksRoot: f.root, details: { acceptanceCriteria: [] } });
  assert.equal(report.acceptanceCriteria[0].criterion, 'Behavior is correct');
  assert.ok(report.warnings.some(s => s.includes('invalid JSON')));
});

test('nonzero exit codes cannot be hidden as skipped and credential flags/cookies are redacted', t => {
  const f = fixture(t);
  const report = buildTaskReport(f.dir, { tasksRoot: f.root, details: { verification: [{ name: 'Actually failed', status: 'skipped', exitCode: 1 }] } });
  assert.equal(report.verification[0].status, 'failed');
  const output = redactText('--password flag-private-value\nCookie: session=private-session; another=private-cookie');
  assert.ok(!output.includes('flag-private-value'));
  assert.ok(!output.includes('private-session'));
  assert.ok(!output.includes('private-cookie'));
});

test('main-session initialization refuses symlinked parent directories', t => {
  const second = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-report-outside-'));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-report-link-root-'));
  t.after(() => { fs.rmSync(second, { recursive: true, force: true }); fs.rmSync(root, { recursive: true, force: true }); });
  fs.symlinkSync(second, path.join(root, 'general'));
  assert.throws(() => initMainSessionTask('escape-task', 'Do not escape', root), /Unsafe main-session task parent/);
  assert.deepEqual(fs.readdirSync(second), []);
});

test('unsafe output/input symlinks and directories outside the task root are rejected', t => {
  const f = fixture(t);
  const outside = path.join(f.root, 'outside.txt'); fs.writeFileSync(outside, 'private outside data');
  fs.symlinkSync(f.root, path.join(f.dir, 'reports'));
  assert.throws(() => writeTaskReport(f.dir, { tasksRoot: f.root }), /Unsafe reports/);
  fs.unlinkSync(path.join(f.dir, 'reports'));
  fs.symlinkSync(outside, path.join(f.dir, 'FINAL.md'));
  assert.throws(() => writeTaskReport(f.dir, { tasksRoot: f.root }), /symlinked report/);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'private outside data');
  assert.throws(() => writeTaskReport(f.root, { tasksRoot: f.root }), /inside the configured/);
  fs.unlinkSync(path.join(f.dir, 'FINAL.md'));
  fs.unlinkSync(path.join(f.dir, 'TASK.md')); fs.symlinkSync(outside, path.join(f.dir, 'TASK.md'));
  assert.throws(() => buildTaskReport(f.dir, { tasksRoot: f.root }), /unsafe report input/);
});

test('CLI supports approved main-session reporting without an invented framework domain', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-report-cli-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const env = { ...process.env, PI_TASKS_DIR: root };
  const cli = path.join(app, 'scripts/piw.mjs');
  const dir = execFileSync(process.execPath, [cli, 'report', 'init', 'cli-task', 'CLI report'], { env, encoding: 'utf8' }).trim();
  assert.ok(dir.includes('general/main-session/'));
  const output = JSON.parse(execFileSync(process.execPath, [cli, 'report', 'generate', dir, 'stopped'], { env, encoding: 'utf8' }));
  assert.equal(output.status, 'stopped');
  assert.ok(fs.existsSync(output.html));
  assert.equal(fs.existsSync(path.join(root, 'orchestration.json')), false);
  const invalid = spawnSync(process.execPath, [cli, 'report', 'generate', dir, 'nonsense'], { env, encoding: 'utf8' });
  assert.notEqual(invalid.status, 0);
});
