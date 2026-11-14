import test from 'node:test';
import assert from 'node:assert/strict';
import { getManifest, authHeaders } from '../src/index.mjs';

test('uses the pi-<name> package contract', () => {
  const manifest = getManifest();
  assert.match(manifest.packageName, /^pi-[a-z0-9-]+$/);
  assert.ok(manifest.protocol);
});

test('never logs or changes the API key in auth headers', () => {
  const headers = authHeaders('secret');
  assert.equal(headers.Authorization, 'Bearer secret');
  assert.equal(headers['Content-Type'], 'application/json');
});
