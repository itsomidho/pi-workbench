#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const name = process.argv[2];
if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error('Usage: node scripts/create-adapter.mjs <name>');
  console.error('The name must be lowercase kebab-case, e.g. example-provider.');
  process.exit(2);
}
const root = path.resolve(process.argv[3] ?? `./pi-${name}`);
if (fs.existsSync(root)) throw new Error(`Destination already exists: ${root}`);
const template = path.resolve(new URL('../adapters/adapter-template/', import.meta.url).pathname);
const envPrefix = `${name.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_`;
function copy(source, destination) {
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true });
    for (const entry of fs.readdirSync(source)) copy(path.join(source, entry), path.join(destination, entry));
    return;
  }
  let content = fs.readFileSync(source, 'utf8');
  content = content.replaceAll('__NAME__', name).replaceAll('__DISPLAY_NAME__', name).replaceAll('__ENV_PREFIX__', `${envPrefix}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content, { mode: source.endsWith('.mjs') ? 0o755 : 0o644 });
}
copy(template, root);
console.log(`Created independent adapter project: ${root}`);
