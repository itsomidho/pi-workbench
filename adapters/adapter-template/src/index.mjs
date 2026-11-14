import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

export function getManifest() {
  return structuredClone(manifest);
}

export function resolveConfig(env = process.env) {
  const baseUrl = env[manifest.baseUrlEnv];
  const apiKey = env[manifest.apiKeyEnv];
  if (!baseUrl) throw new Error(`${manifest.baseUrlEnv} is not configured`);
  if (!apiKey) throw new Error(`${manifest.apiKeyEnv} is not configured`);
  const url = new URL(baseUrl);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Provider URL must use HTTP(S)');
  return { baseUrl: url.href.replace(/\/$/, ''), apiKey };
}

export function authHeaders(apiKey) {
  return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
}
