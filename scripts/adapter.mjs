#!/usr/bin/env node
import { workbenchPaths } from "./workbench-paths.mjs";
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { Writable } from 'node:stream';
import { spawnSync } from 'node:child_process';

const [action, ...args] = process.argv.slice(2);
const configDir = workbenchPaths().providers;
const adaptersDir = process.env.PI_ADAPTERS_DIR || path.join(os.homedir(), '.pi-adapters');
fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });

function usage() {
  console.log(`Usage:
  piw adapter create <name> [destination] [--protocol <api>]
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
  for (const line of fs.readFileSync(file, 'utf8').replaceAll('\\n', '\n').split(/\r?\n/)) {
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
  const mask = hidden && Boolean(process.stdin.isTTY);
  const output = mask
    ? Object.assign(new Writable({ write(_chunk, _encoding, callback) { callback(); } }), { isTTY: true, columns: process.stdout.columns || 80 })
    : process.stdout;
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stdin, output, terminal: Boolean(process.stdin.isTTY) });
    let settled = false;
    const restore = () => { if (process.stdin.isRaw) process.stdin.setRawMode(false); };
    const cancel = () => {
      if (settled) return;
      settled = true;
      restore();
      rl.close();
      process.stdout.write('\n');
      const error = new Error('Configuration cancelled.');
      error.code = 'ERR_CONFIG_CANCELLED';
      reject(error);
    };
    process.stdout.write(question);
    rl.once('line', (answer) => {
      if (settled) return;
      settled = true;
      restore();
      rl.close();
      if (mask) process.stdout.write('\n');
      resolve(answer.trim());
    });
    rl.on('SIGINT', cancel);
    process.once('SIGINT', cancel);
  });
}

if (!action || action === 'help') { usage(); process.exit(0); }
if (action === 'create') {
  const name = args[0];
  if (!name) fail('usage: piw adapter create <name> [destination]');
  const createArgs = args.slice(1);
  const flag = createArgs.indexOf('--protocol');
  const protocolArgs = flag < 0 ? [] : createArgs.splice(flag, 2);
  if (createArgs.length > 1 || createArgs.some(value => value.startsWith('--'))) fail('invalid create arguments');
  const destination = createArgs[0] || path.join(adaptersDir, `pi-${name}`);
  if (fs.existsSync(destination)) {
    console.error(`Adapter already exists: ${destination}`);
    console.error(`Use: piw adapter check "${destination}"`);
    process.exit(2);
  }
  run(process.execPath, [path.join(path.dirname(new URL(import.meta.url).pathname), 'create-adapter.mjs'), name, destination, ...protocolArgs], process.cwd());
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
  exec('npm', ['install', '-g', '--force', path.join(os.tmpdir(), tarball)], dir);
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
  let baseUrl;
  let apiKey;
  let caCert = '';
  try {
    baseUrl = await ask(`${data.baseUrlEnv} (base URL): `);
    apiKey = await ask(`${data.apiKeyEnv} (hidden): `, true);
    if (data.caCertEnv) caCert = await ask(`${data.caCertEnv} (optional CA path): `);
  } catch (error) {
    if (error.code === 'ERR_CONFIG_CANCELLED') {
      console.error(error.message);
      process.exit(130);
    }
    throw error;
  }
  if (!baseUrl || !apiKey) fail('base URL and API key are required');
  if (caCert && !fs.existsSync(caCert.replace(/^~(?=\/)/, os.homedir()))) fail(`CA certificate not found: ${caCert}`);
  const file = configPath(data.id);
  const lines = [
    `${data.baseUrlEnv}="${baseUrl.replaceAll('"', '\\"')}"`,
    `${data.apiKeyEnv}="${apiKey.replaceAll('"', '\\"')}"`,
  ];
  if (caCert) lines.push(`${data.caCertEnv}="${caCert.replaceAll('"', '\\"')}"`);
  fs.writeFileSync(file, `${lines.join('\n')}\n`, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  console.log(`Saved credentials to ${file}`);
  process.exit(0);
}
if (action === 'health' || action === 'models') {
  const provider = args[0];
  const { dir, data } = manifestFor(provider);
  const env = { ...process.env, ...readEnv(provider) };
  if (data.caCertEnv && env[data.caCertEnv]) env.NODE_EXTRA_CA_CERTS = env[data.caCertEnv].replace(/^~(?=\/)/, os.homedir());
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
