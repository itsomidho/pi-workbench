#!/usr/bin/env node
import { workbenchPaths } from "./workbench-paths.mjs";
import fs from 'node:fs';
import path from 'node:path';

const root = workbenchPaths().tasks;
if (!fs.existsSync(root)) { console.log('No Pi task workspace exists.'); process.exit(0); }
for (const domain of fs.readdirSync(root).sort()) {
  const domainDir = path.join(root, domain);
  if (!fs.statSync(domainDir).isDirectory()) continue;
  for (const project of fs.readdirSync(domainDir).sort()) {
    const projectDir = path.join(domainDir, project);
    if (!fs.statSync(projectDir).isDirectory()) continue;
    for (const task of fs.readdirSync(projectDir).sort()) {
      const file = path.join(projectDir, task, 'TASK.md');
      if (!fs.existsSync(file)) continue;
      const text = fs.readFileSync(file, 'utf8');
      const title = text.match(/^# Task: (.+)$/m)?.[1] ?? task;
      const status = text.match(/^\| Status \| (.+) \|$/m)?.[1] ?? 'unknown';
      console.log(`${domain}/${project}/${task}\t${status}\t${title}`);
    }
  }
}
