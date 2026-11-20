#!/usr/bin/env node
import { workbenchPaths } from "./workbench-paths.mjs";
import fs from 'node:fs';
import path from 'node:path';

const [identifier, next] = process.argv.slice(2);
const allowed = new Set(['planning', 'awaiting-approval', 'implementing', 'reviewing', 'fixing', 'qa', 'testing', 'auditing', 'finishing', 'done', 'blocked']);
const transitions = {
  planning: new Set(['awaiting-approval', 'blocked']),
  'awaiting-approval': new Set(['planning', 'blocked']),
  implementing: new Set(['reviewing', 'blocked']),
  reviewing: new Set(['fixing', 'qa', 'testing', 'auditing', 'finishing', 'blocked']),
  fixing: new Set(['reviewing', 'blocked']),
  qa: new Set(['fixing', 'testing', 'auditing', 'finishing', 'blocked']),
  testing: new Set(['fixing', 'auditing', 'finishing', 'blocked']),
  auditing: new Set(['fixing', 'finishing', 'blocked']),
  finishing: new Set(['done', 'blocked']),
  blocked: new Set(['planning', 'awaiting-approval']),
  done: new Set(),
};
if (!identifier || !allowed.has(next)) {
  console.error('Usage: node scripts/task-transition.mjs <domain>/<project>/<date-slug> <next-status>');
  process.exit(2);
}
const parts = identifier.split('/');
if (parts.length !== 3 || !/^[a-z][a-z0-9-]*$/.test(parts[0]) || !/^[a-z][a-z0-9-]*$/.test(parts[1]) || !/^\d{4}-\d{2}-\d{2}-[a-z][a-z0-9-]*$/.test(parts[2])) throw new Error('Invalid task identifier');
const root = path.resolve(workbenchPaths().tasks);
const file = path.resolve(root, parts[0], parts[1], parts[2], 'TASK.md');
if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file)) throw new Error(`Task not found: ${file}`);
let text = fs.readFileSync(file, 'utf8');
const current = text.match(/^\| Status \| (.+) \|$/m)?.[1];
if (!current || !transitions[current]?.has(next)) throw new Error(`Invalid transition: ${current ?? 'unknown'} -> ${next}`);
text = text.replace(/^(\| Status \| ).*?( \|)$/m, `$1${next}$2`);
fs.writeFileSync(file, text);
console.log(`${identifier}: ${current} -> ${next}`);
