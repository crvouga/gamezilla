import { describe, expect, test } from 'bun:test';

import { llmCacheKeyFromRequest } from '@pkgs/llm-root-shared/llm-cache-key';
import { LLM_PROVIDER_OPENAI } from '@pkgs/llm-root-shared/llm-types';

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

  test('different temperature changes cache key', async () => {
    const base = {
      input: { a: 1 },
      schema: { type: 'object' },
      model: 'gpt-4o-mini',
      provider: LLM_PROVIDER_OPENAI,
      schemaVersion: 'v1',
    } as const;
    const cold = await llmCacheKeyFromRequest('openai', base);
    const hot = await llmCacheKeyFromRequest('openai', {
      ...base,
      temperature: 2,
    });
    expect(cold).not.toBe(hot);
  });
});
