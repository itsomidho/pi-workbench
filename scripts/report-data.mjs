import { workbenchPaths } from "./workbench-paths.mjs";
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const reportStatuses = ['completed', 'blocked', 'stopped', 'in-progress'];
export const tasksRoot = () => workbenchPaths().tasks;
const list = value => Array.isArray(value) ? value.slice(0, 250) : [];
const text = value => typeof value === 'string' ? value.slice(0, 16000) : '';
const evidence = value => list(typeof value === 'string' ? [value] : value).map(item => typeof item === 'string' ? text(item) : ['description', 'file', 'path', 'result'].map(key => text(item?.[key])).filter(Boolean).join(' · ')).filter(Boolean);
const oneOf = (value, values, fallback) => values.includes(value) ? value : fallback;
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

export function redactText(value, explicitValues = []) {
  let result = String(value);
  for (const secret of explicitValues.filter(v => typeof v === 'string' && v.length >= 3).sort((a, b) => b.length - a.length)) result = result.split(secret).join('[REDACTED]');
  return result
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]')
    .replace(/\b((?:authorization|cookie|set-cookie)["']?\s*:\s*)[^\r\n]*/gi, '$1[REDACTED]')
    .replace(/(--(?:password|token|api-key|secret)(?:=|\s+))(?:"[^"\n]*"|'[^'\n]*'|[^\s]+)/gi, '$1[REDACTED]')
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9+/_=.:-]+/gi, '$1 [REDACTED]')
    .replace(/\b((?:[A-Z0-9_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|API_KEY|APIKEY|ACCESS_KEY|PRIVATE_KEY)[A-Z0-9_]*|authorization|cookie|set-cookie)["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;&\n]+)/gi, '$1[REDACTED]')
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16})\b/g, '[REDACTED]');
}
function redactObject(value, secrets) {
  if (typeof value === 'string') return redactText(value, secrets);
  if (Array.isArray(value)) return value.map(item => redactObject(item, secrets));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactObject(item, secrets)]));
  return value;
}
export function taskDirectory(directory, root = tasksRoot()) {
  const realRoot = fs.realpathSync(root), real = fs.realpathSync(directory);
  if (!real.startsWith(realRoot + path.sep) || !fs.statSync(real).isDirectory()) throw new Error('Report task directory must be inside the configured task workspace.');
  return real;
}
function section(task, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return task.match(new RegExp(`^## ${escaped}\\r?\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'))?.[1]?.trim() ?? '';
}
function field(task, name) { return task.match(new RegExp(`^\\| ${name} \\| (.*?) \\|\\r?$`, 'm'))?.[1] ?? ''; }
function check(item, source) {
  if (typeof item === 'string') return { name: text(item), command: text(item), status: 'unverified', result: 'Command recorded without an outcome.', evidence: [], source };
  const proof = evidence(item?.evidence);
  const result = text(item?.result) || text(item?.summary);
  const exit = typeof item?.exitCode === 'number' && Number.isInteger(item.exitCode) ? item.exitCode : null;
  let status = oneOf(item?.status, ['passed', 'failed', 'skipped', 'unverified'], exit === null ? 'unverified' : exit === 0 ? 'passed' : 'failed');
  if (exit !== null && exit !== 0) status = 'failed';
  if (status === 'passed' && exit === null && !proof.length && !result) status = 'unverified';
  return { name: text(item?.name) || text(item?.command) || 'Unnamed check', command: text(item?.command), status, result: result || (exit === null ? 'No result recorded.' : `Exit code: ${exit}`), evidence: proof, source };
}
function criteria(items) {
  return list(items).map(item => {
    const proof = evidence(item?.evidence);
    const status = oneOf(item?.status, ['met', 'unmet', 'unverified'], 'unverified');
    return { criterion: typeof item === 'string' ? text(item) : text(item?.criterion), status: status === 'met' && !proof.length ? 'unverified' : status, evidence: proof };
  }).filter(item => item.criterion);
}
function delivery(item) {
  const proof = evidence(item?.evidence);
  const status = oneOf(item?.status, ['yes', 'no', 'unknown'], 'unknown');
  return { status: status === 'yes' && !proof.length ? 'unknown' : status, evidence: proof };
}

export function buildTaskReport(directory, options = {}) {
  const dir = taskDirectory(directory, options.tasksRoot);
  const warnings = [];
  function read(relative, required = false) {
    const file = path.join(dir, relative);
    try {
      const real = fs.realpathSync(file);
      if (!real.startsWith(dir + path.sep) || !fs.statSync(real).isFile() || fs.statSync(real).size > 4 * 1024 * 1024) throw new Error('Unsafe or oversized report input');
      return fs.readFileSync(real, 'utf8');
    } catch {
      if (required) throw new Error(`Missing, oversized, or unsafe report input: ${relative}`);
      if (fs.existsSync(file)) warnings.push(`${relative} was unavailable, oversized, or unsafe and was omitted.`);
      return '';
    }
  }
  function json(relative) {
    const content = read(relative);
    if (!content) return {};
    let value;
    try { value = JSON.parse(content); } catch { warnings.push(`${relative} contained invalid JSON and was omitted.`); return {}; }
    if (!value || typeof value !== 'object' || Array.isArray(value)) { warnings.push(`${relative} did not contain a JSON object and was omitted.`); return {}; }
    return value;
  }
  const task = read('TASK.md', true);
  const shared = json('artifacts/shared-context.json');
  const state = json('artifacts/state.json');
  const runId = options.runId ?? state.runId;
  const briefs = [];
  const briefsPath = path.join(dir, 'artifacts/briefs');
  let briefFiles = [];
  if (fs.existsSync(briefsPath)) {
    try {
      if (!fs.realpathSync(briefsPath).startsWith(dir + path.sep) || !fs.statSync(briefsPath).isDirectory()) throw new Error('Unsafe briefs directory');
      briefFiles = fs.readdirSync(briefsPath).filter(name => /^\d{2}-[a-z0-9-]+\.json$/.test(name)).sort().slice(0, 250);
    } catch { warnings.push('artifacts/briefs was unavailable, unsafe, or not a directory and was omitted.'); }
  }
  for (const file of briefFiles) {
    const relative = `artifacts/briefs/${file}`;
    const value = json(relative);
    if (runId && value.runId !== runId) continue;
    if (value.schemaVersion !== 1 || typeof value.summary !== 'string') { warnings.push(`${relative} was not a recognized stage handoff.`); continue; }
    briefs.push({ ...value, source: relative });
  }
  if (!runId && briefs.length) warnings.push('Legacy handoffs have no run identifier; review their dates before relying on them.');
  const saved = json('artifacts/report-details.json');
  const meta = { ...briefs.reduce((all, brief) => ({ ...all, ...(brief.reportDetails && typeof brief.reportDetails === 'object' ? brief.reportDetails : {}) }), {}), ...saved, ...(options.details ?? {}) };
  const planText = section(task, 'Plan');
  const hash = crypto.createHash('sha256').update(planText).digest('hex');
  const approved = Boolean(planText && shared.planVersion > 0 && shared.approvedPlanHash === hash);
  const lifecycle = field(task, 'Status') || text(shared.status) || 'unknown';
  const status = options.status ?? (state.active ? 'in-progress' : state.reportStatus) ?? ({ done: 'completed', blocked: 'blocked', stopped: 'stopped' }[lifecycle] ?? 'in-progress');
  if (!reportStatuses.includes(status)) throw new Error(`Invalid report status: ${status}`);
  if (state.active && status !== 'in-progress') throw new Error('Managed task is still active; wait or stop it before generating a terminal report.');
  const taskCriteria = section(task, 'Acceptance criteria').split('\n').map(line => line.replace(/^\s*[-*]\s*(?:\[[ xX]\]\s*)?/, '').trim()).filter(line => line && !/^Record measurable criteria/.test(line));
  const taskDeviations = section(task, 'Plan deviations');
  const changes = new Map();
  for (const b of briefs) for (const file of list(b.changedFiles)) if (typeof file === 'string') changes.set(file, { file: text(file), summary: text(b.summary), source: b.source });
  for (const item of list(meta.changes)) if (typeof item?.file === 'string') changes.set(item.file, { file: text(item.file), summary: text(item.summary) || 'No explanation recorded.', source: 'report details' });
  const verification = briefs.flatMap(b => list(b.commandsRun).map(c => check(c, b.source))).concat(list(meta.verification).map(c => check(c, 'report details')));
  const findings = briefs.flatMap(b => list(b.findings).map(item => ({ id: text(item?.id), severity: text(item?.severity) || 'info', summary: typeof item === 'string' ? text(item) : text(item?.summary), file: text(item?.file), line: Number.isInteger(item?.line) ? item.line : null, status: oneOf(item?.status, ['open', 'resolved', 'accepted', 'unknown'], 'unknown'), blocking: typeof item?.blocking === 'boolean' ? item.blocking : null, evidence: evidence(item?.evidence), source: b.source })));
  const usage = { responses: 0, inputTokens: 0, outputTokens: 0, reportedCost: null, models: [] };
  const models = new Set();
  for (const line of read('artifacts/usage.jsonl').split('\n').filter(Boolean)) {
    let item;
    try { item = JSON.parse(line); } catch { warnings.push('An invalid usage record was omitted.'); continue; }
    if (!item || typeof item !== 'object' || Array.isArray(item) || !item.usage || typeof item.usage !== 'object' || Array.isArray(item.usage)) { warnings.push('An invalid usage record was omitted.'); continue; }
    if (runId && item.runId !== runId) continue;
    usage.responses++;
    usage.inputTokens += finite(item.usage?.input ?? item.usage?.inputTokens);
    usage.outputTokens += finite(item.usage?.output ?? item.usage?.outputTokens);
    const cost = item.usage?.cost?.total ?? item.usage?.cost;
    if (typeof cost === 'number' && Number.isFinite(cost) && cost >= 0) usage.reportedCost = (usage.reportedCost ?? 0) + cost;
    if (typeof item.provider === 'string' && item.provider !== 'router' && typeof item.model === 'string') models.add(`${item.provider}/${item.model}`);
  }
  usage.models = [...models].slice(0, 250);
  const baselineCriteria = criteria(list(shared.acceptanceCriteria).length ? shared.acceptanceCriteria : taskCriteria);
  const allCriteria = new Map(baselineCriteria.map(item => [item.criterion, item]));
  for (const item of criteria(meta.acceptanceCriteria)) allCriteria.set(item.criterion, item);
  const now = options.generatedAt ?? new Date().toISOString();
  const report = {
    schemaVersion: 1,
    generatedAt: now,
    task: { id: text(shared.taskId) || path.relative(fs.realpathSync(options.tasksRoot ?? tasksRoot()), dir), title: text(shared.title) || task.match(/^# (?:Task: )?(.+)$/m)?.[1] || path.basename(dir), domain: text(shared.domain) || field(task, 'Domain') || 'general', project: text(shared.project) || field(task, 'Project') || 'main-session', execution: oneOf(shared.execution, ['main-session', 'managed'], runId || state.stage ? 'managed' : 'main-session'), status, lifecycleStatus: lifecycle, startedAt: text(shared.createdAt) || field(task, 'Started') || null },
    issue: { request: section(task, 'Brief') || 'Not recorded.', goal: text(shared.goal) || section(task, 'Brief') || 'Not recorded.' },
    plan: { approval: approved ? 'recorded' : 'unverified', content: planText || 'Not recorded.', decisions: section(task, 'Decisions and constraints') || 'Not recorded.', deviations: evidence(meta.planDeviations ?? (taskDeviations && taskDeviations !== 'Not recorded.' ? [taskDeviations] : [])) },
    changes: [...changes.values()].slice(0, 250),
    verification: verification.slice(0, 250),
    acceptanceCriteria: [...allCriteria.values()].slice(0, 250),
    findings: findings.slice(0, 250),
    outcome: { summary: text(meta.summary) || text(briefs.at(-1)?.summary) || 'No outcome summary recorded.', reason: text(options.reason) || text(state.reportReason) || '' },
    risks: [...new Set([...briefs.flatMap(b => evidence(b.knownRisks)), ...evidence(meta.risks)])].slice(0, 250),
    nextSteps: [...new Set([...briefs.flatMap(b => evidence(b.nextChecks)), ...evidence(meta.nextSteps)])].slice(0, 250),
    delivery: { committed: delivery(meta.delivery?.committed), published: delivery(meta.delivery?.published), deployed: delivery(meta.delivery?.deployed) },
    stages: briefs.map(b => ({ stage: text(b.stage), status: text(b.status) || 'unknown', summary: text(b.summary), createdAt: text(b.createdAt) || null, source: b.source, evidence: evidence(b.evidence) })),
    usage,
    warnings: [...new Set([...warnings, 'Reports contain recorded evidence, not independent verification. Missing evidence remains unverified.', 'Secret redaction is best-effort. Review before sharing; personal data and unrecognized secrets may remain.', 'Inputs are limited to 4 MiB per file, 250 items per collection, and 16,000 characters per field.'])],
  };
  return redactObject(report, list(meta.redactValues));
}

export function initMainSessionTask(slug, title, root = tasksRoot()) {
  if (!/^[a-z][a-z0-9-]*$/.test(slug ?? '') || !title?.trim() || /[\r\n]/.test(title)) throw new Error('Use a lowercase slug and a single-line task title.');
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const realRoot = fs.realpathSync(root);
  let parent = realRoot;
  for (const part of ['general', 'main-session']) {
    parent = path.join(parent, part);
    if (fs.existsSync(parent) && (fs.lstatSync(parent).isSymbolicLink() || !fs.statSync(parent).isDirectory())) throw new Error('Unsafe main-session task parent.');
    fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  }
  if (!fs.realpathSync(parent).startsWith(realRoot + path.sep)) throw new Error('Unsafe main-session task location.');
  const dir = path.join(parent, `${new Date().toISOString().slice(0, 10)}-${slug}`);
  fs.mkdirSync(dir, { mode: 0o700 });
  fs.mkdirSync(path.join(dir, 'artifacts/briefs'), { recursive: true, mode: 0o700 });
  const now = new Date().toISOString();
  fs.writeFileSync(path.join(dir, 'TASK.md'), `# Task: ${title.trim()}\n\n| Domain | general |\n| Project | main-session |\n| Status | planning |\n| Started | ${now} |\n\n## Brief\n${title.trim()}\n\n## Decisions and constraints\nRecord the approved scope and constraints.\n\n## Plan\nNot approved yet.\n\n## Next step\nRecord the approved plan and evidence. Reporting does not launch a managed workflow.\n`, { mode: 0o600 });
  fs.writeFileSync(path.join(dir, 'artifacts/shared-context.json'), JSON.stringify({ schemaVersion: 1, taskId: path.relative(realRoot, dir), domain: 'general', project: 'main-session', title: title.trim(), goal: title.trim(), execution: 'main-session', acceptanceCriteria: [], planVersion: 0, approvedPlanHash: null, status: 'planning', createdAt: now }, null, 2) + '\n', { mode: 0o600 });
  return dir;
}
