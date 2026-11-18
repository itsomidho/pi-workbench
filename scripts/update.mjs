#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const localRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const root = path.resolve(process.env.PI_WORKBENCH_HOME || (fs.existsSync(path.join(os.homedir(), '.pi-workbench', 'package.json')) ? path.join(os.homedir(), '.pi-workbench') : localRoot));
// Protect both a linked command and an explicitly selected source target.
if ([localRoot, root].some(dir => fs.existsSync(path.join(dir, '.git')))) {
  console.error('Source checkout detected. Update with Git, review changes, and rerun validation; piw update is for release installations.');
  process.exit(2);
}
const args = new Set(process.argv.slice(2));
const currentPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (currentPackage.name !== 'pi-workbench' || typeof currentPackage.version !== 'string') throw new Error('Update target is not a valid pi-workbench application.');
const current = currentPackage.version;
const api = 'https://api.github.com/repos/itsomidho/pi-workbench/releases/latest';

function execute(command, commandArgs, capture = false) {
  // Never inherit a cwd that may have been renamed or removed during the swap.
  const result = spawnSync(command, commandArgs, { cwd: os.homedir(), stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.signal ?? 'unknown'}).${capture ? ` ${result.stderr?.trim() ?? ''}` : ''}`);
  return capture ? result.stdout.trim() : '';
}
const run = (command, commandArgs) => execute(command, commandArgs);
const capture = (command, commandArgs) => execute(command, commandArgs, true);
function pack(directory, destination) {
  fs.mkdirSync(destination, { recursive: true });
  run('npm', ['pack', '--ignore-scripts', '--pack-destination', destination, directory]);
  const archives = fs.readdirSync(destination).filter(entry => entry.endsWith('.tgz'));
  if (archives.length !== 1) throw new Error('npm did not create exactly one installable package archive.');
  return path.join(destination, archives[0]);
}

const release = JSON.parse(capture('curl', ['-fsSL', '-H', 'Accept: application/vnd.github+json', api]));
const latest = release.tag_name?.replace(/^v/, '');
if (!latest || !release.tarball_url) throw new Error('Latest release metadata is invalid.');
if (latest === current) { console.log(`Already up to date: ${current}`); process.exit(0); }
console.log(`Installed: ${current}\nLatest:   ${latest}`);
if (args.has('--check')) process.exit(0);
if (!args.has('--yes')) { console.error('Re-run with --yes to install the release.'); process.exit(2); }

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-workbench-update-'));
const unpacked = path.join(temp, 'package');
const agentDir = path.resolve(process.env.PI_CODING_AGENT_DIR || process.env.PI_AGENT_DIR || path.join(os.homedir(), '.pi/agent'));
process.env.PI_CODING_AGENT_DIR = agentDir;
const settingsFile = path.join(agentDir, 'settings.json');
let settingsSnapshot, settingsMode, snapshotTaken = false;
let backup, oldApp, rollbackArchive, swapped = false, globalTouched = false, keepRecovery = false;
try {
  fs.mkdirSync(unpacked);
  const archive = path.join(temp, 'release.tar.gz');
  run('curl', ['-fsSL', release.tarball_url, '-o', archive]);
  run('tar', ['-xzf', archive, '--strip-components=1', '-C', unpacked]);
  const candidate = JSON.parse(fs.readFileSync(path.join(unpacked, 'package.json'), 'utf8'));
  if (candidate.name !== 'pi-workbench' || candidate.version !== latest) throw new Error('Downloaded archive identity/version does not match release metadata.');
  const nextArchive = pack(unpacked, path.join(temp, 'next-package'));
  rollbackArchive = pack(root, path.join(temp, 'previous-package'));
  if (fs.existsSync(settingsFile)) {
    settingsSnapshot = fs.readFileSync(settingsFile);
    settingsMode = fs.statSync(settingsFile).mode & 0o777;
  }
  snapshotTaken = true;
  // Stage on the target filesystem so the application swap cannot fail with EXDEV.
  backup = fs.mkdtempSync(`${root}.update-`);
  oldApp = path.join(backup, 'previous');
  const staged = path.join(backup, 'next');
  fs.cpSync(unpacked, staged, { recursive: true });
  fs.renameSync(root, oldApp);
  swapped = true;
  fs.renameSync(staged, root);
  globalTouched = true; // npm may mutate the prefix before returning an error.
  run('npm', ['install', '-g', '--force', '--ignore-scripts', nextArchive]);
  run('pi', ['install', root]);
  if (capture('piw', ['version']) !== latest) throw new Error('Updated global CLI version does not match the application.');
  const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  const registered = settings.packages?.some(item => {
    const source = typeof item === 'string' ? item : item?.source;
    return typeof source === 'string' && path.resolve(agentDir, source) === root;
  });
  if (!registered) throw new Error('Pi did not register the updated application.');
  console.log(`Updated pi-workbench to ${latest}`);
} catch (error) {
  const failures = [];
  if (swapped) {
    try {
      if (!fs.existsSync(oldApp)) throw new Error('Previous application backup is missing.');
      if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
      fs.renameSync(oldApp, root);
    } catch (restoreError) { failures.push(`application: ${restoreError.message}`); }
  }
  if (globalTouched && rollbackArchive) {
    try { run('npm', ['install', '-g', '--force', '--ignore-scripts', rollbackArchive]); }
    catch (restoreError) { failures.push(`global CLI: ${restoreError.message}`); }
  }
  if (snapshotTaken) {
    try {
      if (settingsSnapshot !== undefined) {
        fs.mkdirSync(agentDir, { recursive: true });
        fs.writeFileSync(settingsFile, settingsSnapshot, { mode: settingsMode });
        fs.chmodSync(settingsFile, settingsMode);
      } else if (fs.existsSync(settingsFile)) fs.rmSync(settingsFile);
    } catch (restoreError) { failures.push(`Pi registration: ${restoreError.message}`); }
  }
  if (failures.length) {
    keepRecovery = true;
    throw new Error(`Update failed: ${error.message}. Rollback incomplete: ${failures.join('; ')}. Recovery files retained at ${temp}${backup ? ` and ${backup}` : ''}.`);
  }
  throw new Error(`Update failed: ${error.message}.${swapped || globalTouched ? ' Previous application, CLI and registration restored.' : ' Installation was not changed.'}`);
} finally {
  if (!keepRecovery) {
    if (backup) fs.rmSync(backup, { recursive: true, force: true });
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
