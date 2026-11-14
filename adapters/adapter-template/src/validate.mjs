import { getManifest, resolveConfig } from './index.mjs';
const manifest = getManifest();
if (!manifest.id || !/^[-a-z0-9]+$/.test(manifest.id)) throw new Error('Invalid adapter id');
if (!manifest.packageName.startsWith('pi-')) throw new Error('Package must use the pi-<name> convention');
if (process.argv.includes('--config')) resolveConfig();
console.log(`Adapter ${manifest.packageName} manifest is valid.`);
