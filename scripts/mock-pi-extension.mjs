import { createAssistantMessageEventStream, ToolCallArgumentsStream } from '@earendil-works/pi-ai';

function response(model, message, text, toolCall, toolName = 'workflow_handoff') {
  const stream = createAssistantMessageEventStream();
  const output = { role: 'assistant', content: [], api: model.api, provider: model.provider, model: model.id, usage: { input: 3, output: 2, cacheRead: 0, cacheWrite: 0, totalTokens: 5, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, stopReason: 'pending', timestamp: Date.now() };
  const schedule = ['abort', 'stop-turn'].includes(process.env.PI_MOCK_REPORT_SCENARIO) ? fn => setTimeout(fn, 1000) : queueMicrotask;
  schedule(() => {
    stream.push({ type: 'start', partial: output });
    if (toolCall) {
      const tool = { type: 'toolCall', id: `mock-${Date.now()}`, name: toolName, arguments: {} };
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
      if (process.env.PI_MOCK_TOOLLESS_PROBE) {
        return context.messages.at(-1)?.role === 'toolResult'
          ? response(model, context, 'TOOLLESS_PROBE_FINISHED')
          : response(model, context, 'Probe disabled write', { path: process.env.PI_MOCK_TOOLLESS_PROBE, content: 'This must never be written.' }, 'write');
      }
      if (!text.includes('Task directory:')) return response(model, context, 'mock response');
      if (process.env.PI_MOCK_EXPECT_DOMAIN) {
        const latest = context.messages.filter(message => message.role === 'user').at(-1);
        const prompt = typeof latest?.content === 'string' ? latest.content : JSON.stringify(latest?.content);
        if (!prompt?.includes(`Domain: ${process.env.PI_MOCK_EXPECT_DOMAIN}`) || !prompt.includes('Role instructions (') || (process.env.PI_MOCK_EXPECT_ROLE && !prompt.includes(process.env.PI_MOCK_EXPECT_ROLE))) throw new Error('Selected domain role instructions were not loaded');
      }
      if (process.env.PI_MOCK_REPORT_SCENARIO === 'missing') return response(model, context, 'Deliberately no handoff');
      if (context.messages.at(-1)?.role === 'toolResult') return response(model, context, 'mock stage complete');
      const stageName = expected?.[1] ?? '02-implement';
      const latestUser = context.messages.filter(message => message.role === 'user').at(-1);
      const latestPrompt = typeof latestUser?.content === 'string' ? latestUser.content : (latestUser?.content ?? []).filter(block => block.type === 'text').map(block => block.text).join('\n');
      const loopFinding = process.env.PI_MOCK_FIX_LOOP === '1' && stageName === '03-review' && !latestPrompt.includes('"stage":"04-fix"');
      if (process.env.PI_MOCK_FIX_LOOP === '1' && stageName === '05-qa' && !latestPrompt.includes('Mock completed 03-review')) throw new Error('QA did not receive the final review handoff');
      if (process.env.PI_MOCK_HANDOFF_PAYLOAD) return response(model, context, 'Schema fixture handoff', JSON.parse(process.env.PI_MOCK_HANDOFF_PAYLOAD));
      return response(model, context, 'handoff', { stage: stageName, summary: `Mock completed ${expected[1]}`, changedFiles: [], findings: process.env.PI_MOCK_REPORT_SCENARIO === 'blocked' ? [{ id: 'mock-block', severity: 'high', summary: 'A blocking issue requires a decision.', blocking: true }] : loopFinding ? [{ id: 'mock-fix-loop', severity: 'medium', summary: 'Deterministic review/fix fixture finding.', blocking: true }] : [], commandsRun: [{ command: `mock-${stageName}` }], knownRisks: [], nextChecks: [], evidence: [{ description: 'mock provider evidence' }], reportDetails: stageName === '08-finish' ? { summary: 'Mock finish supplied structured report details.', verification: [{ name: 'Mock structured check', exitCode: 0, result: 'Recorded mock verification fixture.' }], acceptanceCriteria: [{ criterion: 'Mock reporting fixture is propagated', status: 'met', evidence: ['Mock handoff payload reached the report.'] }] } : undefined });
    },
  });
}
