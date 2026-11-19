import fs from 'node:fs';
import { createAssistantMessageEventStream } from '@earendil-works/pi-ai';

// Deterministic provider for real Pi router tests. It never contacts a network.
export default function (pi) {
  pi.registerProvider('router-fixture', {
    name: 'Router test fixture', api: 'openai-responses', baseUrl: 'http://unused.invalid', apiKey: 'fixture-only',
    models: ['primary', 'secondary', 'tertiary'].map((id, i) => ({ id, name: id, reasoning: true, input: ['text'], contextWindow: 300_000 - i * 100_000, maxTokens: 8192, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } })),
    streamSimple(model) {
      if (process.env.PI_MOCK_ROUTER_LOG) fs.appendFileSync(process.env.PI_MOCK_ROUTER_LOG, JSON.stringify({ provider: model.provider, model: model.id }) + '\n');
      const stream = createAssistantMessageEventStream();
      queueMicrotask(() => {
        const failed = process.env.PI_MOCK_ROUTER_SCENARIO === 'exhausted' || model.id !== 'tertiary';
        const message = { role: 'assistant', content: [], api: model.api, provider: model.provider, model: model.id, timestamp: Date.now(), usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, stopReason: failed ? 'error' : 'stop' };
        stream.push({ type: 'start', partial: message });
        if (failed) {
          message.errorMessage = '503 service temporarily overloaded (deterministic fixture)';
          stream.push({ type: 'error', reason: 'error', error: message });
        } else {
          message.content.push({ type: 'text', text: 'ROUTER_FIXTURE_OK' });
          stream.push({ type: 'text_start', contentIndex: 0, partial: message });
          stream.push({ type: 'text_delta', contentIndex: 0, delta: 'ROUTER_FIXTURE_OK', partial: message });
          stream.push({ type: 'text_end', contentIndex: 0, content: 'ROUTER_FIXTURE_OK', partial: message });
          stream.push({ type: 'done', reason: 'stop', message });
        }
      });
      return stream;
    },
  });
}
