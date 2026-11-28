import fs from 'node:fs';
import { createAssistantMessageEventStream } from '@earendil-works/pi-ai';

export default function (pi) {
  pi.registerProvider('think-fixture', {
    name: 'Think tools fixture', api: 'openai-responses', baseUrl: 'http://unused.invalid', apiKey: 'fixture-only',
    models: [{ id: 'reasoning', name: 'reasoning', reasoning: true, input: ['text'], contextWindow: 100000, maxTokens: 8192, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }],
    streamSimple(model, context) {
      const system = context.systemPrompt ?? context.messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
      const advisor = system.includes('You are the Think advisor, a tool-less reasoning reviewer.');
      if (advisor) {
        const nonSystem = context.messages.filter(m => m.role !== 'system');
        const userText = typeof nonSystem[0]?.content === 'string' ? nonSystem[0].content : nonSystem[0]?.content?.map(b => b.text).join('');
        if (context.tools?.length || nonSystem.length !== 1 || userText !== 'SELF_CONTAINED_BRIEF' || context.messages.some(m => m.role === 'system' && m.toolsAdded?.length)) throw new Error('Advisor boundary violated');
        fs.appendFileSync(process.env.PI_THINK_FIXTURE_LOG, 'advisor:brief-only;tools=0\n');
      }
      const results = context.messages.filter(m => m.role === 'toolResult');
      const steps = [
        ['router_set_role', { role: 'think', complexity: 'moderate' }],
        ['router_status', {}],
        ['think_advisor', { brief: 'SELF_CONTAINED_BRIEF' }],
        ['router_status', {}],
      ];
      let call = advisor ? null : steps[results.length];
      if (advisor && process.env.PI_THINK_FIXTURE_SCENARIO === 'tool-call') call = ['write', { path: process.env.PI_THINK_FIXTURE_MARKER, content: 'must not be written' }];
      const text = advisor ? 'ADVISOR_ANALYSIS_OK' : 'COORDINATOR_FINISHED';
      const stream = createAssistantMessageEventStream();
      queueMicrotask(() => {
        const message = { role: 'assistant', api: model.api, provider: model.provider, model: model.id, timestamp: Date.now(), usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, stopReason: call ? 'toolUse' : 'stop', content: [] };
        stream.push({ type: 'start', partial: message });
        if (call) {
          const toolCall = { type: 'toolCall', id: `fixture-${advisor ? 'advisor' : results.length}`, name: call[0], arguments: call[1] };
          message.content.push(toolCall);
          stream.push({ type: 'toolcall_start', contentIndex: 0, partial: message });
          stream.push({ type: 'toolcall_delta', contentIndex: 0, delta: JSON.stringify(call[1]), partial: message });
          stream.push({ type: 'toolcall_end', contentIndex: 0, toolCall, partial: message });
        } else {
          message.content.push({ type: 'text', text });
          stream.push({ type: 'text_start', contentIndex: 0, partial: message });
          stream.push({ type: 'text_delta', contentIndex: 0, delta: text, partial: message });
          stream.push({ type: 'text_end', contentIndex: 0, content: text, partial: message });
        }
        stream.push({ type: 'done', reason: message.stopReason, message });
      });
      return stream;
    },
  });
}
