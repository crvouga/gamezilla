import { describe, expect, test } from 'bun:test';

import { llmCacheKeyFromRequest } from './llm-cache-key';
import { LLM_PROVIDER_OPENAI } from './llm-types';

describe('llmCacheKeyFromRequest', () => {
  test('same request hashes identically', async () => {
    const req = {
      input: { a: 1 },
      schema: { type: 'object' },
      model: 'gpt-4o-mini',
      provider: LLM_PROVIDER_OPENAI,
      schemaVersion: 'v1',
    } as const;
    const h1 = await llmCacheKeyFromRequest('openai', req);
    const h2 = await llmCacheKeyFromRequest('openai', req);
    expect(h1).toBe(h2);
    expect(h1.length).toBe(32);
  });
});
