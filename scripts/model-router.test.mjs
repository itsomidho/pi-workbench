import assert from 'node:assert/strict';
import test from 'node:test';

let instance = 0;
async function harness(t, initialRole) {
  const keys = ['PI_ROUTER_ROLE', 'PI_ROUTER_PROVIDER', 'PI_ROUTER_MODEL', 'PI_ROUTER_TRACE'];
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
  let virtual;
  module.default({
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
    ...module, commands, notifications, ctx, general, reasoning,
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

test('programmatic role changes use the same effective profile', async t => {
  const h = await harness(t, 'developer');
  h.setRouterRole('think');
  assert.equal((await h.route()).model.id, 'reasoning');
  assert.match((await h.status()).text, /Role: think;/);
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

test('explicit model override still respects role requirements', async t => {
  const h = await harness(t, 'think');
  process.env.PI_ROUTER_MODEL = 'general';
  await assert.rejects(h.route(), /Requested router override is unavailable/);
  h.setRouterRole('developer');
  assert.equal((await h.route()).model.id, 'general');
});
