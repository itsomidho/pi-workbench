import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const required = [
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
  'adapters/adapter-template/manifest.json',
  'scripts/create-adapter.mjs',
  'scripts/init-project.mjs',
];
const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error('Missing required files:\n' + missing.join('\n'));
  process.exit(1);
}

const projectsRoot = path.join(root, 'domains');
const bundledProjects = [];
function scanForProjectFiles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scanForProjectFiles(full);
    else if (entry.name.endsWith('.md') && entry.name !== 'PROJECT.template.md' && full.includes(`${path.sep}standards${path.sep}projects${path.sep}`)) {
      bundledProjects.push(path.relative(root, full));
    }
  }
}
scanForProjectFiles(projectsRoot);
if (bundledProjects.length) {
  console.error('Real project files must not ship in pi-workbench:\n' + bundledProjects.join('\n'));
  process.exit(1);
}

for (const forbidden of ['standards', 'agents']) {
  if (fs.existsSync(path.join(root, forbidden)) && fs.readdirSync(path.join(root, forbidden)).length === 0) {
    console.error(`Unused empty root directory exists: ${forbidden}/`);
    process.exit(1);
  }
}
console.log(`Portable Pi workbench checks passed (${required.length} required files).`);
