import fs from 'node:fs';

const packageFile = new URL('../package.json', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
const [arg, ...extra] = process.argv.slice(2);
const version = arg === '--check' ? manifest.version : arg?.replace(/^v/, '');
if (extra.length || !/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error('Usage: npm run release:prepare -- vMAJOR.MINOR.PATCH');
  process.exit(2);
}
const tag = `v${version}`;
const targets = [
  ['install.sh', /^version=v\d+\.\d+\.\d+$/m, `version=${tag}`],
  ...['README.md', 'docs/installation.md'].map(file => [file,
    /(?<=raw\.githubusercontent\.com\/itsomidho\/pi-workbench\/)v\d+\.\d+\.\d+(?=\/install\.sh)/,
    tag,
  ]),
];
const updates = targets.map(([file, pattern, replacement]) => {
  const url = new URL(`../${file}`, import.meta.url);
  const original = fs.readFileSync(url, 'utf8');
  if (!pattern.test(original)) throw new Error(`Missing release version marker in ${file}`);
  return { file, url, original, updated: original.replace(pattern, replacement) };
});
if (arg === '--check') {
  const stale = updates.filter(({ original, updated }) => original !== updated);
  if (stale.length) throw new Error(`Expected ${tag} in ${stale.map(({ file }) => file).join(', ')}`);
  console.log(`Installer and documentation match ${tag}.`);
} else {
  manifest.version = version;
  fs.writeFileSync(packageFile, `${JSON.stringify(manifest, null, 2)}\n`);
  for (const { url, updated } of updates) fs.writeFileSync(url, updated);
  console.log(`Prepared ${tag}. Review the diff before committing and tagging.`);
}
