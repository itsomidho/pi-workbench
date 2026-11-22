import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

for (const protocol of [undefined, 'openai-completions', 'anthropic-messages', 'invalid']) {
  test(`adapter create protocol: ${protocol ?? 'default'}`, t => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'adapter-protocol-'));
    t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
    const destination = path.join(temp, 'pi-example');
    const args = ['scripts/adapter.mjs', 'create', 'example', destination];
    if (protocol) args.push('--protocol', protocol);
    const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', env: { ...process.env, PI_PROVIDERS_DIR: path.join(temp, 'providers') } });
    if (protocol === 'invalid') {
      assert.notEqual(result.status, 0);
      assert.equal(fs.existsSync(destination), false);
      return;
    }
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(fs.readFileSync(path.join(destination, 'manifest.json'), 'utf8'));
    assert.equal(manifest.protocol, protocol ?? 'openai-responses');
    const extension = fs.readFileSync(path.join(destination, 'extensions/provider.ts'), 'utf8');
    assert.match(extension, /api: manifest\.protocol/);
    assert.equal(extension.includes('__NAME__'), false);
  });
}

const root = path.resolve(new URL('..', import.meta.url).pathname);
test('adapter generator exists and does not bundle a named provider', () => {
  assert.ok(fs.existsSync(path.join(root, 'scripts/create-adapter.mjs')));
  assert.ok(fs.existsSync(path.join(root, 'adapters/adapter-template/manifest.json')));
  assert.equal(fs.existsSync(path.join(root, 'adapters/example-provider')), false);
});
