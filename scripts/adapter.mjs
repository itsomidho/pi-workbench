#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';

const [action, ...args] = process.argv.slice(2);
const configDir = process.env.PI_WORKBENCH_CONFIG_DIR || path.join(os.homedir(), '.config', 'pi-workbench', 'providers');
const adaptersDir = process.env.PI_ADAPTERS_DIR || path.join(os.homedir(), '.pi-adapters');
fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });

function usage() {
  console.log(`Usage:
  piw adapter create <name> [destination]
  piw adapter check <path>
  piw adapter install <path>
  piw adapter configure <provider>
  piw adapter health <provider>
  piw adapter models <provider>
  piw adapter list
  piw adapter remove <provider>`);
}
function fail(message) { console.error(`Adapter error: ${message}`); process.exit(1); }
function manifestFor(provider) {
  const candidates = [path.resolve(provider), path.join(adaptersDir, `pi-${provider}`)];
  for (const candidate of candidates) {
    const file = path.join(candidate, 'manifest.json');
    if (fs.existsSync(file)) return { dir: candidate, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
  }
  return fail(`adapter '${provider}' was not found`);
}
function configPath(provider) { return path.join(configDir, `${provider}.env`); }
function readEnv(provider) {
  const file = configPath(provider);
  if (!fs.existsSync(file)) fail(`credentials are not configured; run: piw adapter configure ${provider}`);
  const values = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)="((?:[^"\\]|\\.)*)"$/);
    if (match) values[match[1]] = match[2].replaceAll('\\"', '"').replaceAll('\\\\', '\\');
  }
  return values;
}
function exec(command, commandArgs, cwd, env = process.env) {
  const result = spawnSync(command, commandArgs, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
function run(command, commandArgs, cwd, env = process.env) {
  exec(command, commandArgs, cwd, env);
  process.exit(0);
}
function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const input = process.stdin;
    const output = process.stdout;
    output.write(question);
    const rl = readline.createInterface({ input, output, terminal: Boolean(input.isTTY) });
    let restored = false;
    const restore = () => {
      if (!hidden || restored) return;
      restored = true;
      spawnSync('stty', ['echo'], { stdio: ['ignore', 'ignore', 'ignore'] });
    };
    if (hidden && input.isTTY) spawnSync('stty', ['-echo'], { stdio: ['ignore', 'ignore', 'ignore'] });
    rl.once('line', (answer) => {
      restore();
      rl.close();
      output.write(hidden ? '\\n' : '');
      resolve(answer.trim());
    });
    rl.once('close', restore);
  });
}

if (!action || action === 'help') { usage(); process.exit(0); }
if (action === 'create') {
  const name = args[0];
  const destination = args[1] || path.join(adaptersDir, `pi-${name}`);
  run(process.execPath, [path.join(path.dirname(new URL(import.meta.url).pathname), 'create-adapter.mjs'), name, destination], process.cwd());
}
if (action === 'check') {
  const { dir } = manifestFor(args[0]);
  run('npm', ['test'], dir);
  run('npm', ['run', 'check'], dir);
}
if (action === 'install') {
  const { dir, data } = manifestFor(args[0]);
  exec('npm', ['pack', '--pack-destination', os.tmpdir()], dir);
  const tarball = fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith(`${data.packageName}-`) && name.endsWith('.tgz')).sort().at(-1);
  if (!tarball) fail('npm did not create an adapter package archive');
  run('npm', ['install', '-g', '--force', path.join(os.tmpdir(), tarball)], dir);
  const preserved = `${dir}.pi-install-preserved`;
  fs.cpSync(dir, preserved, { recursive: true });
  try {
    exec('pi', ['install', dir], dir);
  } finally {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    fs.renameSync(preserved, dir);
  }
  console.log(`Installed adapter ${data.packageName} (provider ${data.id})`);
  console.log(`Configure it with: piw adapter configure ${data.id}`);
  process.exit(0);
}
if (action === 'configure') {
  const provider = args[0];
  const { data } = manifestFor(provider);
  const baseUrl = await ask(`${data.baseUrlEnv} (base URL): `);
  const apiKey = await ask(`${data.apiKeyEnv} (hidden): `, true);
  if (!baseUrl || !apiKey) fail('base URL and API key are required');
  const file = configPath(data.id);
  fs.writeFileSync(file, `${data.baseUrlEnv}="${baseUrl.replaceAll('"', '\\"')}"\n${data.apiKeyEnv}="${apiKey.replaceAll('"', '\\"')}"\n`, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  console.log(`Saved credentials to ${file}`);
  process.exit(0);
}
if (action === 'health' || action === 'models') {
  const provider = args[0];
  const { dir, data } = manifestFor(provider);
  const env = { ...process.env, ...readEnv(provider) };
  run('node', ['src/cli.mjs', action], dir, env);
}
if (action === 'list') {
  if (!fs.existsSync(configDir)) process.exit(0);
  for (const file of fs.readdirSync(configDir).filter((name) => name.endsWith('.env'))) console.log(`${file.slice(0, -4)} (configured)`);
  process.exit(0);
}
if (action === 'remove') {
  const provider = args[0];
  const file = configPath(provider);
  if (fs.existsSync(file)) fs.rmSync(file);
  console.log(`Removed local credentials for ${provider}. The adapter package remains installed.`);
  process.exit(0);
}
usage(); process.exit(2);
