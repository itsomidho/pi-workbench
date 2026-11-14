import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
test('adapter generator exists and does not bundle a named provider', () => {
  assert.ok(fs.existsSync(path.join(root, 'scripts/create-adapter.mjs')));
  assert.ok(fs.existsSync(path.join(root, 'adapters/adapter-template/manifest.json')));
  assert.equal(fs.existsSync(path.join(root, 'adapters/example-provider')), false);
});
