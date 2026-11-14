import { getManifest, resolveConfig, authHeaders } from './index.mjs';
const command = process.argv[2] ?? 'info';
const manifest = getManifest();
if (command === 'info') {
  console.log(JSON.stringify(manifest, null, 2));
} else if (command === 'health') {
  const { baseUrl, apiKey } = resolveConfig();
  const response = await fetch(`${baseUrl}${manifest.catalog.path}`, {
    headers: authHeaders(apiKey), redirect: 'error', signal: AbortSignal.timeout(8000)
  });
  console.log(JSON.stringify({ ok: response.ok, status: response.status, provider: manifest.id }, null, 2));
  process.exitCode = response.ok ? 0 : 1;
} else {
  console.error('Usage: pi-__NAME__ [info|health]');
  process.exitCode = 2;
}
