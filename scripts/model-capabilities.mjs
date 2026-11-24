#!/usr/bin/env node
import { workbenchPaths } from "./workbench-paths.mjs";
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const capabilities = ['planning', 'coding', 'debugging', 'review', 'qa', 'testing', 'security'];
const tiers = ['standard', 'strong', 'expert'];
const defaultFile = () => workbenchPaths().modelCapabilities;
// The first slash separates provider from model; model IDs may contain more slashes.
const modelKey = value => /^[a-z][a-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9._:-]*(?:\/[A-Za-z0-9][A-Za-z0-9._:-]*)*$/.test(value);

function emptyStages() {
  return Object.fromEntries(capabilities.map(capability => [capability, []]));
}
function normalize(raw) {
  const models = raw?.models ?? raw;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof models !== 'object' || Array.isArray(models)) throw new Error('Capability policy must be an object with a models object.');
  const normalized = { version: 1, defaults: { allowUnlistedModels: raw.defaults?.allowUnlistedModels === true }, models: {}, stages: emptyStages() };
  for (const [key, value] of Object.entries(models)) {
    if (!modelKey(key) || !value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid model policy: ${key}`);
    const caps = value.capabilities;
    if (!Array.isArray(caps) || !caps.length || caps.some(capability => !capabilities.includes(capability))) throw new Error(`Invalid capabilities for ${key}`);
    if (!tiers.includes(value.tier)) throw new Error(`Invalid tier for ${key}`);
    normalized.models[key] = { enabled: value.enabled !== false, capabilities: [...new Set(caps)], tier: value.tier };
  }
  if (!Object.keys(normalized.models).length) throw new Error('Add at least one approved model.');
  for (const capability of capabilities) {
    const list = raw.stages?.[capability];
    if (list !== undefined) {
      if (!Array.isArray(list) || list.some(model => !modelKey(model) || !normalized.models[model])) throw new Error(`Invalid ${capability} stage allowlist.`);
      normalized.stages[capability] = [...new Set(list)];
    }
  }
  return normalized;
}

function readPolicy(file) {
  return normalize(JSON.parse(fs.readFileSync(file, 'utf8')));
}
function writePolicy(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, contents, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}
function usage() {
  console.log(`Usage:\n  piw model-capabilities init [path]\n  piw model-capabilities list [path]\n  piw model-capabilities validate [path]\n\nThe interactive initializer never contacts providers and never handles credentials.`);
}

const [action, pathArg, ...rest] = process.argv.slice(2);
if (!action || action === 'help' || action === '--help') { usage(); process.exit(0); }
const file = path.resolve(pathArg || defaultFile());
if (action === 'validate') {
  try { const policy = readPolicy(file); console.log(`Valid capability policy: ${file} (${Object.keys(policy.models).length} models)`); }
  catch (error) { console.error(`Invalid capability policy: ${error.message}`); process.exit(2); }
  process.exit(0);
}
if (action === 'list') {
  try {
    const policy = readPolicy(file);
    for (const [model, value] of Object.entries(policy.models)) console.log(`${value.enabled ? 'enabled' : 'disabled'} ${model}: ${value.capabilities.join(', ')} (${value.tier})`);
    for (const [stage, models] of Object.entries(policy.stages)) console.log(`${stage}: ${models.join(', ')}`);
  } catch (error) { console.error(`Cannot read capability policy: ${error.message}`); process.exit(2); }
  process.exit(0);
}
if (action !== 'init') { usage(); process.exit(2); }
if (fs.existsSync(file) && !rest.includes('--force')) {
  console.error(`Capability policy already exists: ${file}\nUse --force to replace it.`);
  process.exit(2);
}
const scriptedInput = input.isTTY ? null : fs.readFileSync(0, 'utf8').split(/\r?\n/);
const rl = input.isTTY ? readline.createInterface({ input, output }) : null;
const ask = async question => {
  if (scriptedInput) { output.write(question); return scriptedInput.shift() ?? ''; }
  return rl.question(question);
};
try {
  console.log(`Creating ${file}`);
  console.log('Enter approved physical models. Use provider/model, for example provider-a/model-id or provider-b/model-id. Leave provider/model blank when finished.');
  const models = {};
  while (true) {
    const key = (await ask('Provider/model: ')).trim();
    if (!key) break;
    if (!modelKey(key)) { console.log('Use the form provider/model.'); continue; }
    const caps = (await ask(`Capabilities (${capabilities.join(', ')}): `)).split(',').map(value => value.trim()).filter(Boolean);
    const tier = (await ask(`Tier (${tiers.join(', ')}) [strong]: `)).trim() || 'strong';
    models[key] = { enabled: true, capabilities: caps, tier };
  }
  const stages = {};
  for (const capability of capabilities) {
    const value = (await ask(`Approved models for ${capability} (comma-separated, blank = all matching models): `)).trim();
    if (value) stages[capability] = value.split(',').map(model => model.trim()).filter(Boolean);
  }
  const policy = normalize({ version: 1, defaults: { allowUnlistedModels: false }, models, stages });
  const contents = `${JSON.stringify(policy, null, 2)}\n`;
  writePolicy(file, contents);
  console.log(`Created ${file}`);
  output.write(`\nSaved policy:\n${contents}`);
} catch (error) {
  console.error(`Could not create capability policy: ${error.message}`);
  process.exitCode = 2;
} finally { rl?.close(); }
