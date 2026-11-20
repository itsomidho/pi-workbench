#!/usr/bin/env node
import { workbenchPaths } from "./workbench-paths.mjs";
import fs from 'node:fs';
import path from 'node:path';

const [taskDirArg, patchJson] = process.argv.slice(2);
if (!taskDirArg || !patchJson) {
  console.error('Usage: node scripts/workflow-state.mjs <task-directory> <json-patch>');
  process.exit(2);
}
const root = path.resolve(workbenchPaths().tasks);
const taskDir = path.resolve(taskDirArg);
if (!taskDir.startsWith(`${root}${path.sep}`) || !fs.existsSync(path.join(taskDir, 'TASK.md'))) throw new Error(`Invalid task directory: ${taskDir}`);
const file = path.join(taskDir, 'artifacts', 'state.json');
const current = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { schemaVersion: 1 };
const patch = JSON.parse(patchJson);
const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
console.log(file);
