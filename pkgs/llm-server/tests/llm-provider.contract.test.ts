import { describe, expect, test } from 'bun:test';
import { InMemoryLlmProvider } from '@pkgs/llm-server/in-memory-llm-provider';
import type { LlmProvider } from '@pkgs/llm-shared/llm-provider';

function runLlmContract(factory: () => LlmProvider): void {
  test('structured returns json', async () => {
    const llm = factory();
    const result = await llm.structured({
      model: 'test',
      provider: 'openai',
      schemaVersion: '1',
      schema: {},
      input: { q: 'hi' },
    });
    expect(result.json).toBeDefined();
  });
}

describe('LlmProvider contract — in-memory', () => {
  runLlmContract(() => new InMemoryLlmProvider());
});
