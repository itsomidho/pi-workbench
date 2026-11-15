#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = '0.2.0';

function usage() {
  console.log(`Pi Workbench ${version}

Usage:
  piw init <domain> <project>
  piw task create <domain> <project> <slug> <title>
  piw task list
  piw task status <domain>/<project>/<date-slug> <status>
  piw task transition <domain>/<project>/<date-slug> <status>
  piw adapter create <name> [destination]
  piw check
  piw doctor
  piw version
  piw help`);
}

function run(command, args = []) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

const [group, action, ...args] = process.argv.slice(2);
if (!group || group === 'help' || group === '--help' || group === '-h') {
  usage();
  process.exit(0);
}
if (group === 'version' || group === '--version' || group === '-v') {
  console.log(version);
  process.exit(0);
}

switch (`${group}:${action ?? ''}`) {
  case 'init:':
    run(process.execPath, ['scripts/init-project.mjs', ...args]);
    break;
  case 'task:create':
    run(process.execPath, ['scripts/create-task.mjs', ...args]);
    break;
  case 'task:list':
    run(process.execPath, ['scripts/list-tasks.mjs', ...args]);
    break;
  case 'task:status':
  case 'task:transition':
    run(process.execPath, ['scripts/task-transition.mjs', ...args]);
    break;
  case 'adapter:create':
    run(process.execPath, ['scripts/create-adapter.mjs', ...args]);
    break;
  case 'check':
    run('npm', ['run', 'check']);
    break;
  case 'doctor':
    run('bash', ['scripts/doctor.sh']);
    break;
  default:
    console.error(`Unknown command: ${group}${action ? ` ${action}` : ''}`);
    usage();
    process.exit(2);
}
