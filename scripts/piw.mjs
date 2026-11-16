#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;

function usage() {
  console.log(`Pi Workbench ${version}

Usage:
  piw init <domain> <project>
  piw init-from-think <domain> <project> <slug> <think-note>
  piw task create <domain> <project> <slug> <title>
  piw task list
  piw task status <domain>/<project>/<date-slug> <status>
  piw task transition <domain>/<project>/<date-slug> <status>
  piw task approve <domain>/<project>/<date-slug>
  piw task artifacts <init|write|context> <task-directory> [stage] [summary]
  piw adapter create <name> [destination]
  piw adapter check <path>
  piw adapter install <path>
  piw adapter configure <provider>
  piw adapter health <provider>
  piw adapter models <provider>
  piw adapter list
  piw adapter remove <provider>
  piw check
  piw doctor
  piw update [--check|--yes]
  piw run [pi arguments...]
  piw version
  piw help`);
}

function loadProviderEnv(args) {
  const providerFlag = args.findIndex((value) => value === '--provider' || value.startsWith('--provider='));
  const provider = providerFlag >= 0 ? (args[providerFlag].includes('=') ? args[providerFlag].split('=', 2)[1] : args[providerFlag + 1]) : null;
  const configDir = process.env.PI_WORKBENCH_CONFIG_DIR || path.join(process.env.HOME, '.config', 'pi-workbench', 'providers');
  const files = provider ? [path.join(configDir, `${provider}.env`)] : (fs.existsSync(configDir) ? fs.readdirSync(configDir).filter((name) => name.endsWith('.env')).map((name) => path.join(configDir, name)) : []);
  const env = { ...process.env };
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)="((?:[^"\\]|\\.)*)"$/);
      if (match) env[match[1]] = match[2].replaceAll('\\"', '"').replaceAll('\\\\', '\\');
    }
  }
  const caKey = Object.keys(env).find((key) => /_CA_CERT$/.test(key) && env[key]);
  if (caKey) env.NODE_EXTRA_CA_CERTS = env[caKey].replace(/^~(?=\/)/, process.env.HOME);
  return env;
}
function safeCwd() {
  try { return process.cwd(); } catch { return os.homedir(); }
}

function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, { cwd: options.cwd ?? root, stdio: 'inherit', env: options.env ?? process.env });
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
if (group === 'adapter') {
  run(process.execPath, [path.join(root, 'scripts', 'adapter.mjs'), action, ...args], { cwd: safeCwd() });
}
if (group === 'run') {
  const piArgs = [action && action.startsWith('--') ? action : undefined, ...args].filter(Boolean);
  run('pi', [
    ...(piArgs.some((value) => value === '--model' || value.startsWith('--model=')) ? [] : ['--model', 'router/auto']),
    ...piArgs,
  ], { cwd: safeCwd(), env: loadProviderEnv(piArgs) });
}

switch (`${group}:${action ?? ''}`) {
  case 'init:':
    run(process.execPath, ['scripts/init-project.mjs', ...args]);
    break;
  case 'init-from-think:':
    run(process.execPath, ['scripts/create-task-from-think.mjs', ...args]);
    break;
  case 'task:create':
    run(process.execPath, ['scripts/create-task.mjs', ...args]);
    break;
  case 'task:list':
    run(process.execPath, ['scripts/list-tasks.mjs', ...args]);
    break;
  case 'task:approve':
    run(process.execPath, ['scripts/task-approve.mjs', ...args]);
    break;
  case 'task:status':
  case 'task:transition':
    run(process.execPath, ['scripts/task-transition.mjs', ...args]);
    break;
  case 'task:artifacts':
    run(process.execPath, ['scripts/task-artifacts.mjs', ...args]);
    break;
  case 'adapter:create':
    run(process.execPath, ['scripts/create-adapter.mjs', ...args]);
    break;
  case 'check:':
    run('npm', ['run', 'check']);
    break;
  case 'doctor:':
    run('bash', ['scripts/doctor.sh']);
    break;
  case 'update:':
  case 'update:--check':
  case 'update:--yes':
    run(process.execPath, ['scripts/update.mjs', ...(action === '--check' || action === '--yes' ? [action, ...args] : args)]);
    break;
  case 'run:':
    run('pi', ['--model', 'router/auto', ...args], { cwd: safeCwd() });
    break;
  default:
    console.error(`Unknown command: ${group}${action ? ` ${action}` : ''}`);
    usage();
    process.exit(2);
}
