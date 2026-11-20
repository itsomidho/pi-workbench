#!/usr/bin/env node
import { workbenchPaths } from "./workbench-paths.mjs";
import { configRoot, loadDomain, packPath } from './domains.mjs';
import fs from 'node:fs';
import path from 'node:path';

const [domain, name, standardsRootArg] = process.argv.slice(2);
const valid = value => /^[a-z][a-z0-9-]*$/.test(value ?? '');
if (!valid(domain) || !valid(name)) {
  console.error('Usage: node scripts/init-project.mjs <domain> <project-name> [standards-root]');
  process.exit(2);
}
const standardsRoot = path.resolve(standardsRootArg ?? workbenchPaths().standards);
const pack = loadDomain(configRoot(), domain);
const template = packPath(pack.dir, `${pack.standards}/projects/PROJECT.template.md`);
if (!fs.existsSync(template)) throw new Error(`No standards template for domain: ${domain}`);
const destination = path.join(standardsRoot, domain, 'projects', `${name}.md`);
if (fs.existsSync(destination)) throw new Error(`Project file already exists: ${destination}`);
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.copyFileSync(template, destination);
fs.writeFileSync(destination, fs.readFileSync(destination, 'utf8').replace('# Project name', `# ${name}`));
console.log(`Created local project standards file: ${destination}`);
