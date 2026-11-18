import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildTaskReport, reportStatuses, taskDirectory } from './report-data.mjs';

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const e = escapeHtml;
const md = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_[\]#!|]/g, '\\$&');
const label = value => String(value).replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
const tone = status => ['passed', 'completed', 'met', 'yes', 'recorded'].includes(status) ? 'good' : ['failed', 'unmet', 'blocked'].includes(status) ? 'bad' : ['stopped', 'skipped', 'open'].includes(status) ? 'warn' : 'neutral';
const badge = status => `<span class="badge ${tone(status)}">${e(label(status))}</span>`;
const copy = value => `<p class="copy">${e(value)}</p>`;
const empty = value => `<p class="empty">${e(value)}</p>`;
const bullets = items => items.length ? `<ul class="list">${items.map(item => `<li>${e(item)}</li>`).join('')}</ul>` : empty('Not recorded.');
const proof = items => items.length ? `<ul class="evidence">${items.map(item => `<li>${e(item)}</li>`).join('')}</ul>` : '';
const section = (id, title, content, count = '') => `<section id="${id}" aria-labelledby="${id}-heading"><div class="section-top"><h2 id="${id}-heading">${title}</h2>${count ? `<span class="count">${e(count)}</span>` : ''}</div>${content}</section>`;
const panel = content => `<div class="panel">${content}</div>`;
function counts(report) { return Object.fromEntries(['passed', 'failed', 'skipped', 'unverified'].map(status => [status, report.verification.filter(item => item.status === status).length])); }
function validate(report) {
  if (report?.schemaVersion !== 1 || !reportStatuses.includes(report.task?.status) || !report.issue || !report.plan || !report.outcome || !report.delivery || !report.usage || !['changes', 'verification', 'acceptanceCriteria', 'findings', 'risks', 'nextSteps', 'stages', 'warnings'].every(key => Array.isArray(report[key]))) throw new Error('Unsupported or incomplete task report schema.');
}

export function renderHtml(report) {
  validate(report);
  const n = counts(report);
  const css = fs.readFileSync(new URL('../templates/report.css', import.meta.url), 'utf8');
  const nav = [['overview', 'Overview'], ['issue', 'Issue & goal'], ['plan', 'Plan & decisions'], ['changes', 'Changes'], ['verification', 'Verification'], ['outcome', 'Outcome'], ['risks', 'Risks & next steps'], ['delivery', 'Delivery'], ['details', 'Stage details']];
  const navigation = nav.map(([id, title], index) => `<a href="#${id}"><span aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>${title}</a>`).join('');
  const changed = report.changes.length ? `<div class="table-wrap" tabindex="0" role="region" aria-label="Changed files"><table><caption>Changes recorded by the coordinator or stage handoffs; not an automatic repository diff.</caption><thead><tr><th scope="col">File</th><th scope="col">What changed and why</th></tr></thead><tbody>${report.changes.map(item => `<tr><td><code>${e(item.file)}</code></td><td>${copy(item.summary)}<span class="source">${e(item.source)}</span></td></tr>`).join('')}</tbody></table></div>` : panel(empty('No file changes recorded. This does not prove the repository is unchanged.'));
  const checked = report.verification.length ? `<div class="table-wrap" tabindex="0" role="region" aria-label="Verification checks"><table><caption>Statuses are based on recorded results. A command name alone remains unverified.</caption><thead><tr><th scope="col">Check / command</th><th scope="col">Status</th><th scope="col">Result & evidence</th></tr></thead><tbody>${report.verification.map(item => `<tr><td>${copy(item.name)}${item.command ? `<code>${e(item.command)}</code>` : ''}<span class="source">${e(item.source)}</span></td><td>${badge(item.status)}</td><td>${copy(item.result)}${proof(item.evidence)}</td></tr>`).join('')}</tbody></table></div>` : panel(empty('No verification checks recorded. Do not interpret this as a pass.'));
  const criteria = report.acceptanceCriteria.length ? `<ul class="criteria">${report.acceptanceCriteria.map(item => `<li><div class="criterion-head">${copy(item.criterion)}${badge(item.status)}</div>${proof(item.evidence)}</li>`).join('')}</ul>` : empty('Acceptance criteria were not recorded. Completion is not independently verified.');
  const findings = report.findings.length ? `<details><summary>Reported findings · ${report.findings.length}<small>Historical reports; resolution is unknown unless explicitly recorded.</small></summary><div class="detail-body"><ul class="criteria">${report.findings.map(item => `<li><div class="criterion-head">${copy(`[${item.severity}] ${item.summary}`)}${badge(item.status)}</div>${item.file ? `<code>${e(item.file)}${item.line !== null ? `:${e(item.line)}` : ''}</code>` : ''}${proof(item.evidence)}<span class="source">${e(item.source)}${item.blocking === null ? ' · Blocking status not recorded' : item.blocking ? ' · Reported blocking' : ' · Reported non-blocking'}</span></li>`).join('')}</ul></div></details>` : '';
  const deliveries = `<div class="delivery">${['committed', 'published', 'deployed'].map(key => panel(`<h3>${label(key)}</h3>${badge(report.delivery[key].status)}${proof(report.delivery[key].evidence)}`)).join('')}</div>`;
  const stages = report.stages.length ? `<ol class="stage-list">${report.stages.map(item => `<li><details><summary>${e(item.stage)}<small>Handoff: ${e(item.status)} · ${e(item.createdAt ?? 'date unknown')}</small></summary><div class="detail-body">${copy(item.summary)}${proof(item.evidence)}<code class="source">${e(item.source)}</code></div></details></li>`).join('')}</ol>` : panel(empty('No managed stage handoffs. This may be main-session work or an early stop.'));
  const stats = `<div class="stats"><div class="stat"><div class="eyebrow">Task state</div><div class="stat-value">${e(label(report.task.status))}</div><div class="stat-note">Lifecycle: ${e(report.task.lifecycleStatus)}</div></div><div class="stat"><div class="eyebrow">Recorded changes</div><div class="stat-value">${report.changes.length}</div><div class="stat-note">Files with recorded explanations</div></div><div class="stat"><div class="eyebrow">Verification</div><div class="stat-value">${n.passed} / ${report.verification.length}</div><div class="stat-note">Passed / recorded checks</div></div><div class="stat"><div class="eyebrow">Acceptance</div><div class="stat-value">${report.acceptanceCriteria.filter(c => c.status === 'met').length} / ${report.acceptanceCriteria.length}</div><div class="stat-note">Met with recorded evidence</div></div></div>`;
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><meta name="referrer" content="no-referrer"><title>${e(report.task.title)} — Task report</title><style>${css}</style></head><body><a class="skip" href="#main">Skip to report</a><div class="shell"><aside class="sidebar"><div class="brand"><span class="brand-mark" aria-hidden="true"></span>PI WORKBENCH</div><p class="eyebrow">Task intelligence</p><nav aria-label="Report sections">${navigation}</nav><p class="sidebar-note">Self-contained · Offline ready<br>Print with Ctrl+P or ⌘P<br>Evidence, not assumptions.</p></aside><main id="main" tabindex="-1"><header class="hero" id="overview"><div class="hero-top"><span class="eyebrow">Task report / ${e(report.task.domain)}</span>${badge(report.task.status)}</div><h1>${e(report.task.title)}</h1><p class="lede copy">${e(report.outcome.summary)}</p><div class="meta"><span>Project <strong>${e(report.task.project)}</strong></span><span>Execution <strong>${e(report.task.execution)}</strong></span><span>Report generated <strong>${e(report.generatedAt)}</strong></span></div><code class="source">${e(report.task.id)}</code></header>${stats}
${section('issue', 'Issue & goal', `<div class="grid-two">${panel(`<h3>Original request</h3>${copy(report.issue.request)}`)}${panel(`<h3>Intended outcome</h3>${copy(report.issue.goal)}`)}</div>`)}
${section('plan', 'Plan & decisions', panel(`<div class="section-top"><h3>Plan approval</h3>${badge(report.plan.approval)}</div>${copy(report.plan.content)}<hr class="rule"><h3>Decisions & constraints</h3>${copy(report.plan.decisions)}<hr class="rule"><h3>Plan deviations</h3>${bullets(report.plan.deviations)}`))}
${section('changes', 'Changes', changed, `${report.changes.length} recorded files`)}
${section('verification', 'Verification', `<div class="checks">${Object.entries(n).map(([status, count]) => `<span class="badge ${tone(status)}">${count} ${e(label(status))}</span>`).join('')}</div>${checked}`)}
${section('outcome', 'Outcome & acceptance', panel(`${copy(report.outcome.summary)}${report.outcome.reason ? `<div class="callout">${e(report.outcome.reason)}</div>` : ''}<hr class="rule">${criteria}`) + findings)}
${section('risks', 'Risks & next steps', `<div class="grid-two">${panel(`<h3>Reported risks & limitations</h3>${bullets(report.risks)}`)}${panel(`<h3>Follow-up work</h3>${bullets(report.nextSteps)}`)}</div>`)}
${section('delivery', 'Delivery status', deliveries)}
${section('details', 'Stage details', stages)}
<section aria-labelledby="usage-heading"><h2 id="usage-heading">Recorded usage</h2><div class="usage"><span>Responses <strong>${e(report.usage.responses)}</strong></span><span>Input tokens <strong>${e(report.usage.inputTokens)}</strong></span><span>Output tokens <strong>${e(report.usage.outputTokens)}</strong></span><span>Reported cost <strong>${report.usage.reportedCost === null ? 'Unknown' : e(report.usage.reportedCost)}</strong></span></div><p class="source">Response models: ${e(report.usage.models.join(', ') || 'Unknown — no physical response metadata recorded.')}</p></section><footer class="foot">${bullets(report.warnings)}<p>Schema v${report.schemaVersion} · Generated from the same data as FINAL.md and reports/final.json. Stage completion does not imply deployment or independent review.</p></footer></main></div></body></html>\n`;
}

export function renderMarkdown(report) {
  validate(report);
  const lines = [`# ${md(report.task.title)} — Task report`, '', `- Task: ${md(report.task.id)}`, `- Domain / project: ${md(report.task.domain)} / ${md(report.task.project)}`, `- Execution: ${md(report.task.execution)}`, `- Status: ${md(report.task.status)} (lifecycle: ${md(report.task.lifecycleStatus)})`, `- Report generated: ${md(report.generatedAt)}`, '', '## Issue and goal', '', md(report.issue.request), '', `Goal: ${md(report.issue.goal)}`, '', '## Plan and decisions', '', `Approval: ${md(report.plan.approval)}`, '', md(report.plan.content), '', md(report.plan.decisions), '', '### Deviations', ...report.plan.deviations.map(s => `- ${md(s)}`), ...(report.plan.deviations.length ? [] : ['Not recorded.']), '', '## Changes', ...report.changes.map(c => `- ${md(c.file)} — ${md(c.summary)} (${md(c.source)})`), ...(report.changes.length ? [] : ['No file changes recorded.']), '', '## Verification'];
  for (const c of report.verification) lines.push('', `### ${md(c.name)} — ${md(c.status)}`, c.command ? `Command: ${md(c.command)}` : '', md(c.result), ...c.evidence.map(s => `- ${md(s)}`), `Source: ${md(c.source)}`);
  if (!report.verification.length) lines.push('No checks recorded; verification is unverified.');
  lines.push('', '## Outcome and acceptance', '', md(report.outcome.summary), md(report.outcome.reason), ...report.acceptanceCriteria.map(c => `- [${md(c.status)}] ${md(c.criterion)}${c.evidence.length ? ` — ${md(c.evidence.join('; '))}` : ''}`));
  if (!report.acceptanceCriteria.length) lines.push('Acceptance criteria not recorded.');
  lines.push('', '## Reported findings', ...report.findings.map(f => `- [${md(f.severity)} / ${md(f.status)}] ${md(f.summary)} — ${md(f.file)}${f.line !== null ? `:${md(f.line)}` : ''} (${md(f.source)})`), ...(report.findings.length ? [] : ['No findings recorded; this is not a guarantee that none exist.']), '', '## Risks and limitations', ...report.risks.map(s => `- ${md(s)}`), ...(report.risks.length ? [] : ['Not recorded.']), '', '## Next steps', ...report.nextSteps.map(s => `- ${md(s)}`), ...(report.nextSteps.length ? [] : ['Not recorded.']), '', '## Delivery status');
  for (const key of ['committed', 'published', 'deployed']) lines.push(`- ${label(key)}: ${md(report.delivery[key].status)}${report.delivery[key].evidence.length ? ` — ${md(report.delivery[key].evidence.join('; '))}` : ''}`);
  lines.push('', '## Stage summaries', ...report.stages.flatMap(s => [`- ${md(s.stage)} — ${md(s.summary)} (${md(s.source)}; handoff: ${md(s.status)})`, ...s.evidence.map(item => `  - ${md(item)}`)]), '', '## Usage', `- Responses: ${md(report.usage.responses)}`, `- Input / output tokens: ${md(report.usage.inputTokens)} / ${md(report.usage.outputTokens)}`, `- Reported cost: ${md(report.usage.reportedCost ?? 'Unknown')}`, `- Response models: ${md(report.usage.models.join(', ') || 'Unknown')}`, '', '## Report limitations', ...report.warnings.map(s => `- ${md(s)}`), '', 'HTML: reports/final.html', 'Structured data: reports/final.json', '');
  return lines.join('\n');
}
function atomic(file, content) {
  if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) throw new Error('Refusing to overwrite a symlinked report.');
  const tmp = `${file}.${crypto.randomUUID()}.tmp`;
  try { fs.writeFileSync(tmp, content, { flag: 'wx', mode: 0o600 }); fs.renameSync(tmp, file); }
  finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}
export function writeTaskReport(directory, options = {}) {
  const dir = taskDirectory(directory, options.tasksRoot);
  const report = buildTaskReport(dir, options);
  const html = renderHtml(report), markdown = renderMarkdown(report);
  const destination = path.join(dir, 'reports');
  if (fs.existsSync(destination) && (fs.lstatSync(destination).isSymbolicLink() || !fs.statSync(destination).isDirectory())) throw new Error('Unsafe reports directory.');
  fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
  const paths = { json: path.join(destination, 'final.json'), html: path.join(destination, 'final.html'), markdown: path.join(dir, 'FINAL.md') };
  for (const file of Object.values(paths)) {
    if (fs.existsSync(file) && (fs.lstatSync(file).isSymbolicLink() || !fs.statSync(file).isFile())) throw new Error('Refusing to overwrite a symlinked report or non-file output.');
  }
  atomic(paths.json, JSON.stringify(report, null, 2) + '\n');
  atomic(paths.html, html);
  atomic(paths.markdown, markdown); // Compatibility marker is written last.
  return { report, paths };
}
