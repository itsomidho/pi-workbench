import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const required = [
  'CHANGELOG.md',
  'docs/installation.md',
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
for (const domainEntry of fs.readdirSync(domainsRoot, { withFileTypes: true })) {
  if (!domainEntry.isDirectory()) continue;
  const domainDir = path.join(domainsRoot, domainEntry.name);
  const manifestFile = path.join(domainDir, 'domain.json');
  if (!fs.existsSync(manifestFile)) continue;
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (manifest.schemaVersion !== 1 || manifest.id !== domainEntry.name) throw new Error(`Invalid domain manifest: ${manifestFile}`);
  for (const key of ['roles', 'skills', 'standards', 'workflows', 'qualityGates']) {
    if (typeof manifest[key] !== 'string' || !fs.existsSync(path.resolve(domainDir, manifest[key]))) throw new Error(`Domain manifest ${manifestFile} points to missing ${key}`);
  }
}

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
