#!/usr/bin/env node
import { workbenchPaths } from "./workbench-paths.mjs";
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const identifier = process.argv[2];
const parts = identifier?.split('/') ?? [];
if (parts.length !== 3 || !/^[a-z][a-z0-9-]*$/.test(parts[0]) || !/^[a-z][a-z0-9-]*$/.test(parts[1]) || !/^\d{4}-\d{2}-\d{2}-[a-z][a-z0-9-]*$/.test(parts[2])) throw new Error('Usage: node scripts/task-approve.mjs <domain>/<project>/<date-slug>');
const root = path.resolve(workbenchPaths().tasks);
const dir = path.resolve(root, ...parts);
const file = path.join(dir, 'TASK.md');
if (!dir.startsWith(`${root}${path.sep}`) || !fs.existsSync(file)) throw new Error(`Task not found: ${identifier}`);
let text = fs.readFileSync(file, 'utf8');
const current = text.match(/^\| Status \| (.+) \|$/m)?.[1];
if (current !== 'awaiting-approval') throw new Error(`Approval requires status awaiting-approval; current status is ${current ?? 'unknown'}`);
const plan = text.match(/## Plan\n([\s\S]*?)(?=\n## |$)/)?.[1]?.trim() ?? '';
if (!plan || /^Not approved yet\.?$/i.test(plan)) throw new Error('Cannot approve an empty or unprepared plan');
text = text.replace(/^(\| Status \| ).*?( \|)$/m, '$1implementing$2').replace('## Decisions and constraints\n', '## Decisions and constraints\n- Plan approved by user through Pi task workflow.\n');
fs.writeFileSync(file, text);
const sharedFile = path.join(dir, 'artifacts/shared-context.json');
if (fs.existsSync(sharedFile)) {
  const shared = JSON.parse(fs.readFileSync(sharedFile, 'utf8'));
  shared.planVersion = (shared.planVersion ?? 0) + 1;
  shared.approvedPlanHash = crypto.createHash('sha256').update(plan).digest('hex');
  shared.status = 'implementing';
  shared.updatedAt = new Date().toISOString();
  fs.writeFileSync(sharedFile, JSON.stringify(shared, null, 2) + '\n');
}
console.log(`${identifier}: awaiting-approval -> implementing`);
