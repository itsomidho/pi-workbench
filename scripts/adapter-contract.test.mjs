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
test('configure hides the API key in a terminal session', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'adapter-hidden-'));
  const adapter = path.join(temp, 'adapters', 'pi-example');
  const config = path.join(temp, 'config');
  fs.mkdirSync(adapter, { recursive: true });
  fs.writeFileSync(path.join(adapter, 'manifest.json'), JSON.stringify({
    id: 'example', baseUrlEnv: 'EXAMPLE_BASE_URL', apiKeyEnv: 'EXAMPLE_API_KEY', caCertEnv: 'EXAMPLE_CA_CERT',
  }));
  const secret = 'hidden-secret-value';
  const result = spawnSync('python3', ['-c', String.raw`
import os, pty, select, sys, time
secret = sys.argv[1]
pid, fd = pty.fork()
if pid == 0:
    os.execvpe(sys.argv[2], sys.argv[2:], os.environ)
buf = b''
def pump(timeout):
    global buf
    end = time.time() + timeout
    while time.time() < end:
        ready, _, _ = select.select([fd], [], [], 0.1)
        if not ready:
            if os.waitpid(pid, os.WNOHANG)[0]:
                return
            continue
        try:
            chunk = os.read(fd, 4096)
        except OSError:
            return
        if not chunk:
            return
        buf += chunk
def wait_for(text):
    encoded = text.encode()
    for _ in range(50):
        if encoded in buf:
            return True
        pump(0.1)
    return False
def fail(code):
    sys.stderr.write(buf.decode('utf8', 'replace').replace(secret, '[redacted]'))
    sys.exit(code)
if not wait_for('BASE_URL'):
    fail(2)
enter = bytes([13])
os.write(fd, b'https://api.example.test/v1' + enter)
if not wait_for('API_KEY'):
    fail(3)
os.write(fd, secret.encode() + enter)
if not wait_for('CA_CERT'):
    fail(4)
os.write(fd, enter)
pump(2)
text = buf.decode('utf8', 'replace')
sys.stdout.write('visible\n' if secret in text else 'hidden\n')
`, secret, process.execPath, path.join(root, 'scripts/adapter.mjs'), 'configure', 'example'], {
    encoding: 'utf8',
    timeout: 10000,
    env: { ...process.env, PI_ADAPTERS_DIR: path.join(temp, 'adapters'), PI_WORKBENCH_CONFIG_DIR: config, HOME: temp },
  });
  assert.equal(result.status, 0, result.stderr);
  const saved = fs.readFileSync(path.join(config, 'example.env'), 'utf8');
  fs.rmSync(temp, { recursive: true, force: true });
  assert.equal(result.stdout.trim(), 'hidden');
  assert.match(saved, /EXAMPLE_API_KEY="hidden-secret-value"/);
});

test('configure cancels on Ctrl+C without the unsettled-await warning', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'adapter-cancel-'));
  const adapter = path.join(temp, 'adapters', 'pi-example');
  const config = path.join(temp, 'config');
  fs.mkdirSync(adapter, { recursive: true });
  fs.writeFileSync(path.join(adapter, 'manifest.json'), JSON.stringify({
    id: 'example', baseUrlEnv: 'EXAMPLE_BASE_URL', apiKeyEnv: 'EXAMPLE_API_KEY', caCertEnv: 'EXAMPLE_CA_CERT',
  }));
  const result = spawnSync('python3', ['-c', String.raw`
import os, pty, select, sys, time
pid, fd = pty.fork()
if pid == 0:
    os.execvpe(sys.argv[1], sys.argv[1:], os.environ)
buf = b''
def pump(timeout):
    global buf
    end = time.time() + timeout
    while time.time() < end:
        ready, _, _ = select.select([fd], [], [], 0.1)
        if not ready:
            if os.waitpid(pid, os.WNOHANG)[0]:
                return
            continue
        try:
            chunk = os.read(fd, 4096)
        except OSError:
            return
        if not chunk:
            return
        buf += chunk
def wait_for(text):
    for _ in range(50):
        if text.encode() in buf:
            return True
        pump(0.1)
    return False
enter = bytes([13])
if not wait_for('BASE_URL'):
    sys.exit(2)
os.write(fd, b'https://api.example.test/v1' + enter)
if not wait_for('API_KEY'):
    sys.exit(3)
os.write(fd, b'hidden-secret-value' + enter)
if not wait_for('CA_CERT'):
    sys.exit(4)
os.write(fd, bytes([3]))
for _ in range(40):
    pump(0.1)
    done, status = os.waitpid(pid, os.WNOHANG)
    if done:
        sys.stderr.write(buf.decode('utf8', 'replace'))
        sys.exit(os.waitstatus_to_exitcode(status))
sys.exit(9)
`, process.execPath, path.join(root, 'scripts/adapter.mjs'), 'configure', 'example'], {
    encoding: 'utf8',
    timeout: 10000,
    env: { ...process.env, PI_ADAPTERS_DIR: path.join(temp, 'adapters'), PI_WORKBENCH_CONFIG_DIR: config, HOME: temp },
  });
  const saved = fs.existsSync(path.join(config, 'example.env'));
  fs.rmSync(temp, { recursive: true, force: true });
  assert.equal(result.status, 130, result.stderr);
  assert.equal(result.stderr.includes('unsettled top-level await'), false);
  assert.equal(saved, false);
});

test('adapter generator exists and does not bundle a named provider', () => {
  assert.ok(fs.existsSync(path.join(root, 'scripts/create-adapter.mjs')));
  assert.ok(fs.existsSync(path.join(root, 'adapters/adapter-template/manifest.json')));
  assert.equal(fs.existsSync(path.join(root, 'adapters/example-provider')), false);
});
