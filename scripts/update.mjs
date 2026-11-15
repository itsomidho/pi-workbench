#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const localRoot = path.resolve(new URL('..', import.meta.url).pathname);
const root = process.env.PI_WORKBENCH_HOME || (fs.existsSync(path.join(os.homedir(), '.pi-workbench', 'package.json')) ? path.join(os.homedir(), '.pi-workbench') : localRoot);
const args = new Set(process.argv.slice(2));
const current = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const api = 'https://api.github.com/repos/itsomidho/pi-workbench/releases/latest';

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
function capture(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `Command failed: ${command}`);
  return result.stdout.trim();
}

const release = JSON.parse(capture('curl', ['-fsSL', '-H', 'Accept: application/vnd.github+json', api]));
const latest = release.tag_name?.replace(/^v/, '');
if (!latest || !release.tarball_url) throw new Error('Latest release metadata is invalid.');
if (latest === current) { console.log(`Already up to date: ${current}`); process.exit(0); }
console.log(`Installed: ${current}\nLatest:   ${latest}`);
if (args.has('--check')) process.exit(0);
if (!args.has('--yes')) { console.error('Re-run with --yes to install the release.'); process.exit(2); }

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-workbench-update-'));
const archive = path.join(temp, 'release.tar.gz');
const unpacked = path.join(temp, 'package');
fs.mkdirSync(unpacked);
try {
  run('curl', ['-fsSL', release.tarball_url, '-o', archive]);
  run('tar', ['-xzf', archive, '--strip-components=1', '-C', unpacked]);
  const installedPackage = JSON.parse(fs.readFileSync(path.join(unpacked, 'package.json'), 'utf8'));
  if (installedPackage.version !== latest) throw new Error('Downloaded archive version does not match release metadata.');
  const backup = `${root}.backup-${current}`;
  fs.renameSync(root, backup);
  try {
    fs.renameSync(unpacked, root);
    run('npm', ['install', '-g', '--force', root]);
    if (process.env.PI_BIN || capture('sh', ['-c', 'command -v pi || true'])) run('pi', ['install', root]);
    fs.rmSync(backup, { recursive: true, force: true });
    console.log(`Updated pi-workbench to ${latest}`);
  } catch (error) {
    if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
    fs.renameSync(backup, root);
    throw error;
  }
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
