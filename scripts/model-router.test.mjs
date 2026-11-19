import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { requestRouterRole } from './router-role.mjs';

let instance = 0;
async function harness(t, initialRole) {
  const keys = ['PI_ROUTER_ROLE', 'PI_ROUTER_PROVIDER', 'PI_ROUTER_MODEL', 'PI_ROUTER_TRACE', 'PI_ROUTER_COMPLEXITY', 'PI_MODEL_CAPABILITIES_FILE'];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  if (initialRole !== undefined) process.env.PI_ROUTER_ROLE = initialRole;
  t.after(() => {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });
  const module = await import(`../extensions/model-router.ts?test=${instance++}`);
  const commands = new Map();
  const bus = new EventEmitter();
  const events = { emit: (name, data) => bus.emit(name, data), on: (name, handler) => { bus.on(name, handler); return () => bus.off(name, handler); } };
  let virtual;
  module.default({
    events,
    registerCommand: (name, command) => commands.set(name, command),
    registerVirtualModel: model => { virtual = model; },
  });
  const general = { provider: 'test', id: 'general', api: 'openai-responses', reasoning: false, input: ['text'], contextWindow: 200_000 };
  const reasoning = { provider: 'test', id: 'reasoning', api: 'openai-responses', reasoning: true, input: ['text'], contextWindow: 100_000 };
  const notifications = [];
  let branch = [];
  const ctx = {
    model: { provider: 'router', id: 'auto' },
    modelRegistry: { getAvailable: () => [general, reasoning] },
    sessionManager: { getBranch: () => branch },
    ui: { notify: (text, level) => notifications.push({ text, level }) },
  };
  return {
    ...module, commands, notifications, ctx, general, reasoning, events,
    setBranch: entries => { branch = entries; },
    route: (extra = {}) => virtual.route({ reason: 'user', messages: [], thinkingLevel: 'medium', ...extra }, ctx),
    status: async () => {
      await commands.get('router-status').handler('', ctx);
      return notifications.at(-1);
    },
  };
}

test('environment initializes role; command changes both selection and status', async t => {
  const h = await harness(t, 'think');
  assert.equal(h.getRouterRole(), 'think');
  assert.equal((await h.route()).model.id, 'reasoning');
  await h.commands.get('router-role').handler(' developer ', h.ctx);
  assert.equal(process.env.PI_ROUTER_ROLE, 'think', 'session override must not rewrite environment');
  assert.equal(h.getRouterRole(), 'developer');
  assert.equal((await h.route()).model.id, 'general');
  assert.match((await h.status()).text, /Role: developer; base requirements:.*"reasoning":false/);
});

test('local role setter changes use the same effective profile', async t => {
  const h = await harness(t, 'developer');
  h.setRouterRole('think');
  assert.equal((await h.route()).model.id, 'reasoning');
  assert.match((await h.status()).text, /Role: think;/);
});

test('event-bus requests update the registered router and require acknowledgement', async t => {
  const h = await harness(t, 'think');
  assert.equal(requestRouterRole({ events: h.events }, 'developer'), 'developer');
  assert.equal(h.getRouterRole(), 'developer');
  assert.equal((await h.route()).model.id, 'general');
  assert.match((await h.status()).text, /Role: developer;/);
  assert.throws(() => requestRouterRole({ events: h.events }, 'missing'), /Unknown router role/);
  assert.equal(h.getRouterRole(), 'developer');
  assert.throws(() => requestRouterRole({ events: { emit() {} } }, 'developer'), /unavailable or role update unconfirmed/);
});

test('unset environment defaults and invalid commands preserve current role', async t => {
  const h = await harness(t);
  assert.equal(h.getRouterRole(), 'default');
  for (const role of ['missing', 'constructor', '__proto__']) {
    await h.commands.get('router-role').handler(role, h.ctx);
    assert.equal(h.notifications.at(-1).level, 'error');
    assert.throws(() => h.setRouterRole(role), /Unknown router role/);
    assert.equal(h.getRouterRole(), 'default');
  }
});

test('invalid environment role fails explicitly and can be corrected', async t => {
  const h = await harness(t, 'missing');
  await assert.rejects(h.route(), /Unknown router role: missing/);
  assert.equal((await h.status()).level, 'error');
  h.setRouterRole('think');
  assert.equal((await h.route()).model.id, 'reasoning');
});

test('status separates virtual selection from branch-local physical response evidence', async t => {
  const h = await harness(t, 'think');
  assert.match((await h.status()).text, /unknown \(no physical response metadata on this branch\)/);
  h.setBranch([
    { type: 'message', message: { role: 'assistant', provider: 'test', model: 'old' } },
    { type: 'message', message: { role: 'assistant', provider: 'test', model: 'reasoning' } },
    { type: 'message', message: { role: 'user', content: 'next' } },
  ]);
  const { text } = await h.status();
  assert.match(text, /Selected model: router\/auto; routing: active/);
  assert.match(text, /Last physical response model: test\/reasoning/);
  assert.match(text, /not tool permissions or advisor isolation/);
  h.setBranch([]);
  assert.match((await h.status()).text, /unknown \(no physical response metadata/);
  h.setBranch([{ type: 'message', message: { role: 'assistant', provider: 'router', model: 'auto', stopReason: 'error' } }]);
  assert.match((await h.status()).text, /Last physical response model: unknown/);
});

test('direct physical selection is reported as routing inactive', async t => {
  const h = await harness(t, 'think');
  h.ctx.model = h.general;
  assert.match((await h.status()).text, /Selected model: test\/general; routing: inactive/);
});

test('role change takes effect on next user request, retaining continuation stickiness', async t => {
  const h = await harness(t, 'developer');
  h.setRouterRole('think');
  const continuation = await h.route({ reason: 'continuation', previous: { model: h.general } });
  assert.equal(continuation.model.id, 'general');
  assert.equal((await h.route()).model.id, 'reasoning');
});

test('native SDK tool protocols are eligible while unknown protocols and context sizes fail closed', async t => {
  const h = await harness(t, 'think');
  for (const api of ['openai-completions', 'mistral-conversations', 'openai-responses', 'azure-openai-responses', 'openai-codex-responses', 'anthropic-messages', 'bedrock-converse-stream', 'google-generative-ai', 'google-vertex', 'pi-messages']) {
    h.ctx.modelRegistry.getAvailable = () => [{ ...h.reasoning, api }];
    assert.equal((await h.route()).model.api, api);
  }
  h.ctx.modelRegistry.getAvailable = () => [{ ...h.reasoning, api: 'unknown-protocol' }];
  await assert.rejects(h.route(), /No accessible model/);
  for (const contextWindow of [undefined, 0, NaN, 99_999]) {
    h.ctx.modelRegistry.getAvailable = () => [{ ...h.reasoning, contextWindow }];
    await assert.rejects(h.route(), /No accessible model/);
  }
});

test('retry fallback excludes the full failed chain, exhausts explicitly, and resets for a new user request', async t => {
  const h = await harness(t, 'think');
  const candidates = [300_000, 200_000, 100_000].map((contextWindow, i) => ({ ...h.reasoning, id: `candidate-${i}`, contextWindow }));
  h.ctx.modelRegistry.getAvailable = () => candidates;
  const first = await h.route();
  assert.equal(first.model.id, 'candidate-0');
  const second = await h.route({ reason: 'retry', state: first.state, failed: { model: first.model } });
  assert.equal(second.model.id, 'candidate-1');
  const third = await h.route({ reason: 'retry', state: second.state, failed: { model: second.model } });
  assert.equal(third.model.id, 'candidate-2', 'Retry must not cycle back to an already failed model');
  await assert.rejects(h.route({ reason: 'retry', state: third.state, failed: { model: third.model } }), /No accessible model/);
  assert.equal((await h.route({ reason: 'user', state: third.state })).model.id, 'candidate-0');
  const continued = await h.route({ reason: 'continuation', state: third.state, previous: { model: third.model } });
  assert.equal(continued.model.id, 'candidate-2');
  assert.deepEqual(continued.state.failedModels, [], 'A successful continuation starts no failure quarantine');
});

test('a routing-error retry cannot resurrect a quarantined previous successful model', async t => {
  const h = await harness(t, 'think');
  h.ctx.modelRegistry.getAvailable = () => [h.reasoning];
  await assert.rejects(h.route({ reason: 'retry', state: { provider: 'test', id: 'reasoning', failedModels: ['test/reasoning'] }, previous: { model: h.reasoning } }), /No accessible model/);
});

test('provider-only overrides can fall back, while pinned failed models fail explicitly', async t => {
  const h = await harness(t, 'think');
  const other = { ...h.reasoning, id: 'backup' };
  h.ctx.modelRegistry.getAvailable = () => [h.reasoning, other];
  process.env.PI_ROUTER_PROVIDER = 'test';
  const first = await h.route();
  assert.equal((await h.route({ reason: 'retry', state: first.state, failed: { model: first.model } })).model.id, 'backup');
  process.env.PI_ROUTER_MODEL = 'reasoning';
  await assert.rejects(h.route({ reason: 'retry', failed: { model: h.reasoning } }), /Requested router override is unavailable/);
});

test('complexity and declared work capability select a suitable stage model', async t => {
  const h = await harness(t, 'developer');
  const coding = { ...h.reasoning, id: 'coding-expert', workbenchRouting: { capabilities: ['coding'], tier: 'expert' } };
  h.ctx.modelRegistry.getAvailable = () => [h.general, coding];
  const request = { reason: 'user', messages: [], thinkingLevel: 'low' };
  requestRouterRole({ events: h.events }, 'developer', 'complex');
  const result = await h.route(request);
  assert.equal(result.model.id, 'coding-expert');
  assert.equal(result.thinkingLevel, 'high');
  assert.equal(result.state.complexity, 'complex');
});

test('capability stage allowlists restrict candidates and fallback', async t => {
  const h = await harness(t, 'developer');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pi-model-policy-')), 'policy.json');
  t.after(() => fs.rmSync(path.dirname(file), { recursive: true, force: true }));
  fs.writeFileSync(file, JSON.stringify({ version: 1, defaults: { allowUnlistedModels: false }, models: {
    'test/general': { enabled: true, capabilities: ['coding'], tier: 'standard' },
    'test/reasoning': { enabled: true, capabilities: ['planning'], tier: 'expert' },
  }, stages: { coding: ['test/general'] } }));
  process.env.PI_MODEL_CAPABILITIES_FILE = file;
  assert.equal((await h.route()).model.id, 'general');
  h.ctx.modelRegistry.getAvailable = () => [h.reasoning];
  await assert.rejects(h.route(), /No accessible model/);
});

test('explicit model override still respects role requirements', async t => {
  const h = await harness(t, 'think');
  process.env.PI_ROUTER_MODEL = 'general';
  await assert.rejects(h.route(), /Requested router override is unavailable/);
  h.setRouterRole('developer');
  assert.equal((await h.route()).model.id, 'general');
});
