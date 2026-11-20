import { discoverDomains } from './domains.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const required = [
  'CHANGELOG.md',
  'docs/installation.md',
  'docs/adapters.md',
  'docs/domains.md',
  'docs/reports.md',
  'docs/readiness.md',
  'schemas/task-report.schema.json',
  'templates/report.css',
  'scripts/report-data.mjs',
  'scripts/report-render.mjs',
  'scripts/report-cli.mjs',
  'scripts/reports.test.mjs',
  'scripts/report-runtime-integration.test.mjs',
  'scripts/handoff-schema-runtime.test.mjs',
  'scripts/project-standards.mjs',
  'scripts/project-standards.test.mjs',
  'scripts/mock-router-extension.mjs',
  'scripts/router-runtime-integration.test.mjs',
  'scripts/tool-less-runtime.test.mjs',
  'scripts/model-capabilities.mjs',
  'scripts/model-capabilities.test.mjs',
  'scripts/workbench-paths.mjs',
  'scripts/workbench-paths.test.mjs',
  'scripts/domains.mjs',
  'scripts/domain-cli.mjs',
  'extensions/domain-discovery.ts',
  'scripts/domains.test.mjs',
  'scripts/workflow-approval.mjs',
  'scripts/workflow-approval.test.mjs',
  'scripts/workflow-progress.mjs',
  'scripts/workflow-progress.test.mjs',
  'scripts/router-role.mjs',
  'scripts/wordpress-pack-contract.test.mjs',
  'scripts/consumer-lifecycle.test.mjs',
  'scripts/adapter.mjs',
  'domains/wordpress/domain.json',
  'domains/wordpress/quality-gates.json',
  'domains/wordpress/standards/README.md',
  'domains/wordpress/standards/checklists/INDEX.md',
  'domains/wordpress/standards/checklists/security.md',
  'domains/wordpress/standards/projects/PROJECT.template.md',
  'skills/think/SKILL.md',
  'skills/think-advisor/SKILL.md',
  'workflows/TASK.template.md',
  'domains/wordpress/workflows/development/SKILL.md',
  'extensions/model-router.ts',
  'extensions/task-workflow.ts',
  'extensions/workflow-orchestrator.ts',
  'adapters/adapter-template/manifest.json',
  'scripts/create-adapter.mjs',
  'scripts/init-project.mjs',
  'scripts/task-artifacts.mjs',
  'scripts/workflow-state.mjs',
  'scripts/task-approve.mjs',
  'scripts/create-task-from-think.mjs',
  'scripts/mock-pi-extension.mjs',
  'scripts/orchestrator-runtime-integration.test.mjs',
];
const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error('Missing required files:\n' + missing.join('\n'));
  process.exit(1);
}

const domainsRoot = path.join(root, 'domains');
const discovery = discoverDomains(root);
if (discovery.errors.length) throw new Error(discovery.errors.map(item => `${item.domain}: ${item.error}`).join('\n'));

const bundledProjects = [];
function scanForProjectFiles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scanForProjectFiles(full);
    else if (entry.name.endsWith('.md') && entry.name !== 'PROJECT.template.md' && full.includes(`${path.sep}standards${path.sep}projects${path.sep}`)) bundledProjects.push(path.relative(root, full));
  }
}
scanForProjectFiles(domainsRoot);
if (bundledProjects.length) {
  console.error('Real project files must not ship in pi-workbench:\n' + bundledProjects.join('\n'));
  process.exit(1);
}
console.log(`Portable Pi workbench checks passed (${required.length} required files).`);
