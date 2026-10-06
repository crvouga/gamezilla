import { expect, test } from 'bun:test';
import { createHarnessLlm } from '@libs/harness/mockingbird-llm';
import { createHarnessObjectStore } from '@libs/harness/mockingbird-object-store';
import { readObjectBytes } from '@pkgs/object-store-root-shared/helpers';

const clock = { now: () => Date.parse('2024-06-01T00:00:00Z') };

test('the real OpenAI provider consumes a scripted vendor response in process', async () => {
  const { provider } = createHarnessLlm({
    clock,
    scripts: [
      {
        kind: 'chat',
        message: { role: 'assistant', content: '{"answer":42}' },
      },
    ],
  });
  expect(
    await provider.structured({
      provider: 'openai',
      model: 'fixture-chat',
      schemaVersion: 'example',
      schema: {
        type: 'object',
        properties: { answer: { type: 'integer' } },
        required: ['answer'],
      },
      input: { question: 'example' },
    })
  ).toEqual({ json: { answer: 42 } });
});

// regression: aws-sdk-s3-bun-browser-conditions
test('S3 commands preserve exact binary bytes and isolate harnesses', async () => {
  const first = createHarnessObjectStore(clock);
  const other = createHarnessObjectStore(clock);
  const bytes = new Uint8Array([0, 255, 13, 10]);
  await first.put('example.bin', bytes, 'application/octet-stream');
  expect(await readObjectBytes(first, 'example.bin')).toEqual(bytes);
  expect(await readObjectBytes(other, 'example.bin')).toBeNull();
  expect(await first.listKeys('')).toEqual(['example.bin']);
  await first.delete('example.bin');
  expect(await first.get('example.bin')).toBeNull();
});
