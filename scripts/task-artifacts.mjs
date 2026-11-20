#!/usr/bin/env node
import { workbenchPaths } from "./workbench-paths.mjs";
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [command, taskDirArg, stage, ...summaryParts] = process.argv.slice(2);
if (!command || !taskDirArg) {
  console.error('Usage: node scripts/task-artifacts.mjs <init|write|context> <task-dir> [stage] [summary]');
  process.exit(2);
}
const root = path.resolve(workbenchPaths().tasks);
const taskDir = path.resolve(taskDirArg);
if (!taskDir.startsWith(`${root}${path.sep}`) || !fs.existsSync(path.join(taskDir, 'TASK.md'))) {
  throw new Error(`Invalid task directory: ${taskDir}`);
}
const artifactsDir = path.join(taskDir, 'artifacts');
const briefsDir = path.join(artifactsDir, 'briefs');
const stateFile = path.join(artifactsDir, 'shared-context.json');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const now = () => new Date().toISOString();

if (command === 'init') {
  if (fs.existsSync(stateFile)) throw new Error(`Artifacts already initialized: ${stateFile}`);
  fs.mkdirSync(briefsDir, { recursive: true });
  const task = fs.readFileSync(path.join(taskDir, 'TASK.md'), 'utf8');
  const domain = task.match(/^\| Domain \| (.+) \|$/m)?.[1] ?? 'unknown';
  const project = task.match(/^\| Project \| (.+?)(?: \(| \|)/m)?.[1] ?? 'unknown';
  const title = task.match(/^# Task: (.+)$/m)?.[1] ?? path.basename(taskDir);
  writeJson(stateFile, {
    schemaVersion: 1,
    taskId: path.relative(root, taskDir),
    domain,
    project,
    title,
    goal: title,
    acceptanceCriteria: [],
    scope: { allowed: [], forbidden: [] },
    standards: [],
    planVersion: 0,
    approvedPlanHash: null,
    status: 'planning',
    createdAt: now(),
    updatedAt: now(),
  });
  console.log(stateFile);
  process.exit(0);
}

if (!stage || !/^[0-9]{2}-[a-z][a-z0-9-]*$/.test(stage)) {
  console.error('Stage must be named like 01-plan or 03-review.');
  process.exit(2);
}
fs.mkdirSync(briefsDir, { recursive: true });
if (command === 'write') {
  const file = path.join(briefsDir, `${stage}.json`);
  if (fs.existsSync(file)) throw new Error(`Brief already exists: ${file}`);
  const state = fs.existsSync(stateFile) ? readJson(stateFile) : null;
  const summary = summaryParts.join(' ').trim();
  writeJson(file, {
    schemaVersion: 1,
    stage,
    status: 'completed',
    summary,
    inputs: state ? { taskId: state.taskId, planVersion: state.planVersion, approvedPlanHash: state.approvedPlanHash } : {},
    changedFiles: [],
    findings: [],
    commandsRun: [],
    knownRisks: [],
    nextChecks: [],
    evidence: [],
    createdAt: now(),
  });
  console.log(file);
  process.exit(0);
}
if (command === 'context') {
  if (!fs.existsSync(stateFile)) throw new Error(`Missing shared context: ${stateFile}`);
  const state = readJson(stateFile);
  const files = fs.readdirSync(briefsDir).filter(file => file.endsWith('.json')).sort();
  const previous = files.at(-1);
  console.log(JSON.stringify({ shared: state, previousBrief: previous ? readJson(path.join(briefsDir, previous)) : null }, null, 2));
  process.exit(0);
}
throw new Error(`Unknown artifact command: ${command}`);
