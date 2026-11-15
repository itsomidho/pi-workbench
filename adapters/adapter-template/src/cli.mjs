import { getManifest, resolveConfig, authHeaders } from './index.mjs';
const command = process.argv[2] ?? 'info';
const manifest = getManifest();
if (command === 'info') {
  console.log(JSON.stringify(manifest, null, 2));
} else if (command === 'models' || command === 'health') {
  const { baseUrl, apiKey } = resolveConfig();
  const response = await fetch(`${baseUrl}${manifest.catalog.path}`, {
    headers: authHeaders(apiKey), redirect: 'error', signal: AbortSignal.timeout(8000)
  });
  const payload = await response.json().catch(() => null);
  if (command === 'models') console.log(JSON.stringify(payload, null, 2));
  else console.log(JSON.stringify({ ok: response.ok, status: response.status, provider: manifest.id, models: Array.isArray(payload?.data) ? payload.data.length : 0 }, null, 2));
  process.exitCode = response.ok ? 0 : 1;
} else {
  console.error('Usage: pi-__NAME__ [info|health|models]');
  process.exitCode = 2;
}
