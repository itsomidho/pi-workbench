import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function expandHome(value, home) {
  return value === '~' ? home : value.startsWith('~/') ? path.join(home, value.slice(2)) : value;
}
export function localStandardsRoot(home = process.env.HOME ?? os.homedir()) {
  return path.resolve(expandHome(process.env.PI_STANDARDS_DIR ?? path.join(home, '.pi/standards'), home));
}

// Only explicit identity fields count. Mentions in prose, old paths in comments,
// framework names, URLs and project filenames are not repository identity.
function declaredPaths(text) {
  const values = [];
  for (const line of text.split(/\r?\n/)) {
    const table = line.match(/^\|\s*(?:Local path|Repository(?:\/component)?(?: absolute)? path)\s*\|\s*(.*?)\s*\|/i);
    const field = line.match(/^\s*(?:[-*]\s+)?(?:Local path|Repository(?:\/component)?(?: absolute)? path|Repository)\s*:\s*(.+)$/i);
    const value = (table?.[1] ?? field?.[1])?.trim();
    if (!value) continue;
    const quoted = value.match(/^(?:`([^`]+)`|"([^"]+)"|'([^']+)')/);
    const candidate = quoted ? quoted[1] ?? quoted[2] ?? quoted[3] : value.split(/\s+\(/, 1)[0].trim();
    if (candidate.startsWith('~/') || path.isAbsolute(candidate)) values.push(candidate);
  }
  return values;
}

export function findProjectStandards(repository, domain, options = {}) {
  const home = options.home ?? process.env.HOME ?? os.homedir();
  const root = path.resolve(expandHome(options.standardsRoot ?? localStandardsRoot(home), home));
  if (!/^[a-z][a-z0-9-]*$/.test(domain)) throw new Error('Invalid standards domain');
  const directory = path.join(root, domain, 'projects');
  const matches = [], errors = [];
  const result = () => ({
    directory,
    status: matches.length > 1 ? 'ambiguous' : errors.length ? 'unconfirmed' : matches.length === 1 ? 'matched' : 'missing',
    selected: matches.length === 1 && !errors.length ? matches[0].file : null,
    matches, errors,
  });
  try { fs.lstatSync(directory); }
  catch (error) {
    if (error.code !== 'ENOENT') errors.push('Project standards directory is unavailable; confirm the project explicitly.');
    return result();
  }
  try {
    const realRoot = fs.realpathSync(root), realDir = fs.realpathSync(directory), repo = fs.realpathSync(repository);
    if (!realDir.startsWith(realRoot + path.sep) || !fs.statSync(realDir).isDirectory()) throw new Error('Standards directory escapes the configured root or is not a directory');
    const files = fs.readdirSync(realDir).filter(name => name.endsWith('.md') && name !== 'PROJECT.template.md').sort();
    if (files.length > 250) errors.push('Project standards scan exceeded 250 files; confirm the project explicitly.');
    for (const name of files.slice(0, 250)) {
      const file = path.join(realDir, name);
      try {
        const realFile = fs.realpathSync(file), stat = fs.statSync(realFile);
        if (!realFile.startsWith(realDir + path.sep) || !stat.isFile() || stat.size > 1024 * 1024) throw new Error('Unsafe, non-file or oversized project standard');
        for (const declared of declaredPaths(fs.readFileSync(realFile, 'utf8'))) {
          const expanded = expandHome(declared, home);
          // Stale declarations are not evidence and must never launch anything.
          if (!fs.existsSync(expanded) || !fs.statSync(expanded).isDirectory()) continue;
          const identity = fs.realpathSync(expanded);
          if (repo !== identity && !repo.startsWith(identity + path.sep)) continue;
          matches.push({ file: realFile, project: path.basename(name, '.md'), repository: identity, relationship: repo === identity ? 'exact' : 'component' });
          break;
        }
      } catch { errors.push(`${name}: unavailable, unsafe, or oversized project standard.`); }
    }
  } catch { errors.push('Project standards could not be inspected safely; confirm the project explicitly.'); }
  return result();
}
