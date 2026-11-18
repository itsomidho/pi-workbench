import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { discoverDomains } from './domains.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);

test('real Pi parses and advertises every bundled domain guide and development skill', async t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-domain-resources-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  fs.mkdirSync(path.join(home, '.agents/skills/legacy-think'), { recursive: true });
  fs.writeFileSync(path.join(home, '.agents/skills/legacy-think/SKILL.md'), '---\nname: think\ndescription: Old shared Think skill\n---\nOld instructions.\n');
  fs.mkdirSync(path.join(home, 'agent'), { recursive: true });
  fs.writeFileSync(path.join(home, 'agent/settings.json'), JSON.stringify({ packages: [root], skills: ['!skills/**'] }));
  const child = spawn('pi', ['--mode', 'rpc', '-ne', '-e', './extensions/domain-discovery.ts', '-e', './scripts/mock-pi-extension.mjs', '--provider', 'mock-local', '--model', 'mock-model', '--no-session'], {
    cwd: root, env: { ...process.env, HOME: home, PI_CODING_AGENT_DIR: path.join(home, 'agent'), PI_CONFIG_DIR: root, PI_OFFLINE: '1' }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  t.after(() => { if (child.exitCode === null) child.kill('SIGKILL'); });
  let buffer = '', stderr = '', response;
  child.stderr.on('data', data => { stderr += data; });
  child.stdout.on('data', data => {
    buffer += data;
    let end;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
      let value;
      try { value = JSON.parse(line); } catch { continue; }
      if (value.type === 'response' && value.command === 'get_commands') { response = value; child.stdin.end(); }
    }
  });
  const timer = setTimeout(() => child.kill('SIGKILL'), 15000);
  t.after(() => clearTimeout(timer));
  const closed = new Promise((resolve, reject) => { child.once('close', resolve); child.once('error', reject); });
  child.stdin.write(JSON.stringify({ id: 'domains', type: 'get_commands' }) + '\n');
  await closed;
  assert.ok(response?.success, stderr || 'Pi did not return a successful command list');
  const names = response.data.commands.map(command => command.name);
  const think = response.data.commands.find(command => command.name === 'skill:think');
  assert.ok(think, 'Workbench Think should remain available');
  assert.ok(!JSON.stringify(think).includes('Old shared Think'), 'Shared Think must not shadow the Workbench skill');
  for (const { id: domain } of discoverDomains(root).domains) {
    assert.ok(names.includes(`skill:${domain}-guide`), `${domain} guide missing; check YAML frontmatter`);
    assert.ok(names.includes(`skill:${domain}-development`), `${domain} development missing`);
  }
});
