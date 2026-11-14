#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const [domain, project, slug, ...titleParts] = process.argv.slice(2);
const valid = value => /^[a-z][a-z0-9-]*$/.test(value ?? '');
if (!valid(domain) || !valid(project) || !valid(slug) || !titleParts.length) {
  console.error('Usage: node scripts/create-task.mjs <domain> <project> <slug> <title>');
  process.exit(2);
}
const standardsRoot = process.env.PI_STANDARDS_DIR ?? path.join(process.env.HOME ?? '.', '.pi/standards');
const standards = path.join(standardsRoot, domain);
const tasks = process.env.PI_TASKS_DIR ?? path.join(process.env.HOME ?? '.', '.pi/tasks');
const projectFile = path.join(standards, 'projects', `${project}.md`);
if (!fs.existsSync(projectFile)) throw new Error(`No local project standards file: ${projectFile}`);
const date = new Date().toISOString().slice(0, 10);
const dir = path.join(tasks, domain, project, `${date}-${slug}`);
if (fs.existsSync(dir)) throw new Error(`Task already exists: ${dir}`);
const template = fs.readFileSync(new URL('../workflows/TASK.template.md', import.meta.url), 'utf8');
const title = titleParts.join(' ');
const task = template
  .replace('<title>', title)
  .replace('<domain>', domain)
  .replace('<project>', project)
  .replace('<YYYY-MM-DD>', date)
  .replace('<local path>', '<fill in from repository>')
  .replace('<branch>', '<current branch>')
  .replace('<main / develop>', '<base branch>')
  .replace('<short sha>', '<base sha>')
  .replace('<Light / full>', 'full')
  .replace('<light / full>', 'full')
  .replace('<The approved plan (steps, files, data flow, caching). "Not approved yet" until the user approves. Light path: one line.>', 'Not approved yet.')
  .replace('<The user\'s request, verbatim, then a 2–4 line restatement: goal, affected area, acceptance criteria.>', title);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'TASK.md'), task);
console.log(dir);
