import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const configRoot = () => process.env.PI_CONFIG_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const idPattern = /^[a-z][a-z0-9-]*$/;
export const managedStages = ['plan', 'implement', 'review', 'fix', 'qa', 'test', 'audit', 'finish'];

// Domain packs are trusted application instructions, but their paths must stay in the pack.
export function packPath(root, value) {
  if (typeof value !== 'string' || !value || path.isAbsolute(value)) throw new Error(`Invalid pack path: ${value}`);
  const base = fs.realpathSync(root);
  const target = fs.realpathSync(path.resolve(base, value));
  if (!target.startsWith(base + path.sep)) throw new Error(`Pack path escapes domain: ${value}`);
  return target;
}
function skillFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? skillFiles(file) : entry.isFile() && entry.name === 'SKILL.md' ? [file] : [];
  });
}
export function loadDomain(root, id) {
  if (!idPattern.test(id)) throw new Error(`Invalid domain id: ${id}`);
  const dir = packPath(root, `domains/${id}`);
  const manifest = JSON.parse(fs.readFileSync(packPath(dir, 'domain.json'), 'utf8'));
  if (manifest.schemaVersion !== 1 || manifest.id !== id || typeof manifest.name !== 'string') throw new Error(`Invalid domain manifest: ${id}`);
  const resources = Object.fromEntries(['roles', 'skills', 'standards', 'workflows', 'qualityGates'].map(key => [key, packPath(dir, manifest[key])]));
  for (const key of ['roles', 'skills', 'standards', 'workflows']) if (!fs.statSync(resources[key]).isDirectory()) throw new Error(`Expected directory: ${key}`);
  JSON.parse(fs.readFileSync(resources.qualityGates, 'utf8'));
  packPath(dir, `${manifest.standards}/projects/PROJECT.template.md`);
  const detection = manifest.detection;
  if (!Array.isArray(detection?.any) || !detection.any.length) throw new Error(`Missing detection.any: ${id}`);
  for (const rule of detection.any) {
    if (!Array.isArray(rule.all) || !rule.all.length) throw new Error(`Missing detection rule.all: ${id}`);
    for (const signal of rule.all) {
      if (typeof signal.path !== 'string' || !signal.path || path.isAbsolute(signal.path) || signal.path.split(/[\\/]/).includes('..')) throw new Error(`Invalid detection path: ${id}`);
      if (signal.jsonDependency !== undefined && (typeof signal.jsonDependency !== 'string' || !signal.jsonDependency)) throw new Error(`Invalid jsonDependency: ${id}`);
      if (signal.contains !== undefined && (typeof signal.contains !== 'string' || !signal.contains || signal.contains.length > 4096)) throw new Error(`Invalid contains: ${id}`);
    }
  }
  const routes = manifest.routes;
  if (!routes || !Object.keys(routes).length) throw new Error(`Missing routes: ${id}`);
  const resolvedRoutes = {};
  for (const [name, route] of Object.entries(routes)) {
    if (!idPattern.test(name) || !['main-session', 'managed-development-v1'].includes(route.engine)) throw new Error(`Unsupported route engine: ${id}/${name}`);
    const entry = packPath(dir, route.entry);
    if (!fs.statSync(entry).isFile()) throw new Error(`Missing route entry: ${id}/${name}`);
    const spec = { ...route, entry };
    if (route.engine === 'managed-development-v1') {
      if (name !== 'development') throw new Error(`Managed engine supports only development: ${id}/${name}`);
      const stagesFile = packPath(dir, route.stages);
      const stages = JSON.parse(fs.readFileSync(stagesFile, 'utf8')).stages;
      const statuses = ['awaiting-approval', 'implementing', 'reviewing', 'fixing', 'qa', 'testing', 'auditing', 'finishing'];
      if (!stages || Object.keys(stages).length !== managedStages.length) throw new Error(`Invalid managed stages: ${id}`);
      managedStages.forEach((stage, index) => {
        const s = stages[stage];
        if (!s || typeof s.role !== 'string' || !idPattern.test(s.role) || s.status !== statuses[index] || s.report !== `${String(index + 1).padStart(2, '0')}-${stage}`) throw new Error(`Unsupported managed stage: ${id}/${stage}`);
        packPath(dir, `${manifest.roles}/${s.role}.md`);
      });
      Object.assign(spec, { stagesFile, stages });
    }
    resolvedRoutes[name] = spec;
  }
  return { ...manifest, dir, resources, routes: resolvedRoutes, skillPaths: [...new Set([...skillFiles(resources.skills), ...skillFiles(resources.workflows)])] };
}
export function discoverDomains(root = configRoot()) {
  const domains = [], errors = [], names = new Set(['think', 'think-advisor']);
  const base = path.join(root, 'domains');
  if (!fs.existsSync(base)) return { domains, errors };
  for (const entry of fs.readdirSync(base, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    try {
      const domain = loadDomain(root, entry.name);
      const ownNames = domain.skillPaths.map(file => {
        const frontmatter = fs.readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
        const name = frontmatter?.match(/^name:[ \t]*(['"]?)([a-z0-9-]+)\1[ \t]*\r?$/m)?.[2];
        let description = frontmatter?.match(/^description:[ \t]*(\S[^\r\n]*)/m)?.[1];
        if (/^[>|][-+]?$/.test(description?.trim() ?? '')) {
          description = frontmatter.match(/^description:[^\n]*\n((?:[ \t]+[^\n]*(?:\n|$))+)/m)?.[1]?.split('\n').map(line => line.trim()).join(' ').trim();
        }
        description = description?.trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim();
        if (!name || name.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || !description || description.length > 1024 || names.has(name)) throw new Error(`Invalid frontmatter or duplicate skill name: ${name} (${file})`);
        return name;
      });
      if (new Set(ownNames).size !== ownNames.length) throw new Error(`Duplicate skill names in domain: ${entry.name}`);
      ownNames.forEach(name => names.add(name));
      domains.push(domain);
    } catch (error) { errors.push({ domain: entry.name, error: error.message }); }
  }
  return { domains, errors };
}
function matchesSignal(repo, signal) {
  const file = path.resolve(repo, signal.path);
  if (!fs.existsSync(file)) return false;
  // Never follow a repository symlink outside the inspected component.
  const real = fs.realpathSync(file), base = fs.realpathSync(repo);
  if (!real.startsWith(base + path.sep)) return false;
  if (signal.jsonDependency === undefined && signal.contains === undefined) return true;
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > 1024 * 1024) return false;
  const text = fs.readFileSync(file, 'utf8');
  if (signal.contains !== undefined && !text.includes(signal.contains)) return false;
  if (signal.jsonDependency === undefined) return true;
  const json = JSON.parse(text);
  return ['require', 'require-dev', 'dependencies', 'devDependencies'].some(key => Object.hasOwn(json?.[key] ?? {}, signal.jsonDependency));
}
export function detectDomain(repo, root = configRoot()) {
  repo = path.resolve(repo);
  if (!fs.statSync(repo).isDirectory()) throw new Error(`Not a project directory: ${repo}`);
  const { domains, errors } = discoverDomains(root);
  const matches = domains.flatMap(domain => {
    const evidence = [];
    for (const rule of domain.detection.any) {
      try {
        if (rule.all.every(signal => matchesSignal(repo, signal))) evidence.push(...rule.all.map(signal => signal.jsonDependency ? `${signal.path}: ${signal.jsonDependency}` : signal.contains ? `${signal.path}: contains ${signal.contains}` : signal.path));
      } catch (error) { errors.push({ domain: domain.id, error: `Detection failed: ${error.message}` }); }
    }
    return evidence.length ? [{ id: domain.id, name: domain.name, evidence: [...new Set(evidence)], routes: domain.routes }] : [];
  });
  const status = matches.length > 1 ? 'ambiguous' : matches.length === 1 && !errors.length ? 'matched' : matches.length ? 'unconfirmed' : 'unsupported';
  return { repository: repo, status, selected: status === 'matched' ? matches[0].id : null, matches, installed: domains.map(d => ({ id: d.id, name: d.name, routes: d.routes })), errors };
}
export function domainStageContext(domainId, stage, root = configRoot()) {
  const domain = loadDomain(root, domainId);
  const route = domain.routes.development;
  if (route?.engine !== 'managed-development-v1' || !route.stages?.[stage]) throw new Error(`No supported managed development workflow: ${domainId}`);
  const spec = route.stages[stage];
  const roleFile = packPath(domain.dir, `${domain.roles}/${spec.role}.md`);
  const routerRole = { plan: 'planner', implement: 'developer', review: 'code-reviewer', fix: 'developer', qa: 'qa', test: 'test-writer', audit: 'security-auditor', finish: 'developer' }[stage];
  return { role: spec.role, routerRole, stages: route.stages, text: `Workbench root: ${path.resolve(root)}\nDomain: ${domain.id}\nLocal project facts: ${path.join(process.env.PI_STANDARDS_DIR ?? path.join(process.env.HOME ?? '.', '.pi/standards'), domain.id, 'projects')}\nWorkflow entry: ${route.entry}\nRead that entry for domain-specific rules; the managed engine controls stage progression.\nDomain standards: ${domain.resources.standards}\nDomain skills: ${domain.resources.skills}\nQuality gates: ${domain.resources.qualityGates}\nRole instructions (${roleFile}):\n${fs.readFileSync(roleFile, 'utf8')}\nExecution: current-session stage, not a separate delegated agent. Role instructions do not enforce tool permissions.` };
}
