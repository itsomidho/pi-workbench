#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const [domain, project, slug, noteFile] = process.argv.slice(2);
const valid = value => /^[a-z][a-z0-9-]*$/.test(value ?? '');
if (!valid(domain) || !valid(project) || !valid(slug) || !noteFile) {
  console.error('Usage: node scripts/create-task-from-think.mjs <domain> <project> <slug> <think-note>');
  process.exit(2);
}
const note = fs.readFileSync(path.resolve(noteFile), 'utf8');
const title = note.match(/^#\s+(.+)$/m)?.[1] ?? slug;
const section = (name, next = '## ') => note.match(new RegExp(`^## ${name}\\n([\\s\\S]*?)(?=\\n${next}|$)`, 'm'))?.[1]?.trim() ?? '';
const decision = section('Decision');
const plan = section('Plan');
const handoff = section('Handoff brief');
const complexity = note.match(/^\| Complexity \| (simple|moderate|complex) \|$/mi)?.[1]?.toLowerCase() ?? 'moderate';
if (!plan || /^None\.?$/i.test(plan)) throw new Error('Think note has no actionable Plan section');
const standardsRoot = process.env.PI_STANDARDS_DIR ?? path.join(process.env.HOME ?? '.', '.pi/standards');
const tasksRoot = process.env.PI_TASKS_DIR ?? path.join(process.env.HOME ?? '.', '.pi/tasks');
const projectFile = path.join(standardsRoot, domain, 'projects', `${project}.md`);
if (!fs.existsSync(projectFile)) throw new Error(`No local project standards file: ${projectFile}`);
const date = new Date().toISOString().slice(0, 10);
const dir = path.join(tasksRoot, domain, project, `${date}-${slug}`);
if (fs.existsSync(dir)) throw new Error(`Task already exists: ${dir}`);
fs.mkdirSync(path.join(dir, 'artifacts', 'briefs'), { recursive: true });
const task = `# Task: ${title}\n\n| Domain | ${domain} |\n| Project | ${project} |\n| Status | planning |\n| Started | ${date} |\n| Standards | ${projectFile} |\n| Think note | ${path.resolve(noteFile)} |\n\n## Brief\n${handoff || decision || title}\n\n## Decisions and constraints\n${decision || '- See the linked think note.'}\n\n## Plan\n${plan}\n\n## Files changed\nNone.\n\n## Open findings\nNone.\n\n## Next step\nReview the plan and move the task to awaiting-approval.\n`;
fs.writeFileSync(path.join(dir, 'TASK.md'), task);
const shared = { schemaVersion: 1, taskId: path.relative(tasksRoot, dir), domain, project, title, goal: handoff || title, complexity, acceptanceCriteria: [], scope: { allowed: [], forbidden: [] }, standards: [], planVersion: 0, approvedPlanHash: null, status: 'planning', sourceThinkNote: path.resolve(noteFile), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
fs.writeFileSync(path.join(dir, 'artifacts', 'shared-context.json'), JSON.stringify(shared, null, 2) + '\n');
console.log(dir);
