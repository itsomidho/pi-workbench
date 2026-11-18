import fs from 'node:fs';
import path from 'node:path';
import { initMainSessionTask, tasksRoot } from './report-data.mjs';
import { writeTaskReport } from './report-render.mjs';

const [action, target, statusOrTitle, ...rest] = process.argv.slice(2);
try {
  if (action === 'init') {
    console.log(initMainSessionTask(target, [statusOrTitle, ...rest].filter(Boolean).join(' ')));
  } else if (action === 'generate') {
    if (!target || rest.length > 1) throw new Error('Usage: piw report generate <task-directory> [completed|blocked|stopped|in-progress] [details.json]');
    let details;
    if (rest[0]) {
      const file = path.resolve(rest[0]);
      if (!fs.statSync(file).isFile() || fs.statSync(file).size > 4 * 1024 * 1024) throw new Error('Report details must be a JSON file smaller than 4 MiB.');
      details = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!details || typeof details !== 'object' || Array.isArray(details)) throw new Error('Report details must be a JSON object.');
    }
    const result = writeTaskReport(path.resolve(target), { status: statusOrTitle, details });
    console.log(JSON.stringify({ status: result.report.task.status, ...result.paths }, null, 2));
  } else {
    throw new Error(`Usage: piw report init <slug> <title> | piw report generate <task-directory> [status] [details.json]\nTask workspace: ${tasksRoot()}`);
  }
} catch (error) {
  console.error(error instanceof SyntaxError ? 'Invalid JSON in report details; no report was generated.' : error.message);
  process.exitCode = 1;
}
