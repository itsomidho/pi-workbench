import { createAssistantMessageEventStream, ToolCallArgumentsStream } from '@earendil-works/pi-ai';

function response(model, message, text, toolCall) {
  const stream = createAssistantMessageEventStream();
  const output = { role: 'assistant', content: [], api: model.api, provider: model.provider, model: model.id, usage: { input: 3, output: 2, cacheRead: 0, cacheWrite: 0, totalTokens: 5, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, stopReason: 'pending', timestamp: Date.now() };
  queueMicrotask(() => {
    stream.push({ type: 'start', partial: output });
    if (toolCall) {
      const tool = { type: 'toolCall', id: `mock-${Date.now()}`, name: 'workflow_handoff', arguments: {} };
      output.content.push(tool);
      const args = JSON.stringify(toolCall);
      const argumentStream = new ToolCallArgumentsStream();
      stream.push({ type: 'toolcall_start', contentIndex: 0, partial: output });
      tool.arguments = argumentStream.append(args);
      stream.push({ type: 'toolcall_delta', contentIndex: 0, delta: args, partial: output });
      Object.assign(tool, argumentStream.finish());
      stream.push({ type: 'toolcall_end', contentIndex: 0, toolCall: tool, partial: output });
      output.stopReason = 'toolUse';
      stream.push({ type: 'done', reason: 'toolUse', message: output });
    } else {
      output.content.push({ type: 'text', text });
      output.stopReason = 'stop';
      stream.push({ type: 'text_start', contentIndex: 0, partial: output });
      stream.push({ type: 'text_delta', contentIndex: 0, delta: text, partial: output });
      stream.push({ type: 'text_end', contentIndex: 0, content: text, partial: output });
      stream.push({ type: 'done', reason: 'stop', message: output });
    }
  });
  return stream;
}

export default function (pi) {
  pi.registerProvider('mock-local', {
    name: 'Mock Local', api: 'mock-local-api', baseUrl: 'http://mock.local', apiKey: 'test-key',
    models: [{ id: 'mock-model', name: 'Mock Model', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 8192, maxTokens: 1024 }],
    streamSimple(model, context) {
      const text = context.messages.map(message => typeof message.content === 'string' ? message.content : JSON.stringify(message.content)).join('\n');
      const expected = [...text.matchAll(/\b(02-implement|03-review|04-fix|05-qa|06-test|07-audit|08-finish)\.json/g)].at(-1);
      if (!text.includes('Task directory:')) return response(model, context, 'mock response');
      if (context.messages.at(-1)?.role === 'toolResult') return response(model, context, 'mock stage complete');
      const stageName = expected?.[1] ?? '02-implement';
      return response(model, context, 'handoff', { stage: stageName, summary: `Mock completed ${expected[1]}`, changedFiles: [], findings: [], commandsRun: [`mock-${stageName}`], knownRisks: [], nextChecks: [], evidence: [{ description: 'mock provider evidence' }] });
    },
  });
}
