import type { Kv } from '@pkgs/kv/interface';
import { assert } from '@pkgs/assert';
import { createAttrNamespace } from '@pkgs/attribute';

import { llmCacheKeyFromRequest } from './llm-cache-key';
import { llmKvKey } from './llm-kv-key';
import type { LlmProvider } from './llm-provider';
import type { LlmStructuredRequest, LlmStructuredResult } from './llm-types';

const Cache = createAttrNamespace('llm', 'cache');

function parseJsonObject(v: unknown): Record<string, unknown> {
  assert.ok(
    v !== null && typeof v === 'object' && !Array.isArray(v),
    'llm cache: json must be a plain object',
    { v }
  );
  return v as Record<string, unknown>;
}

const LlmCacheAttr = {
  json: Cache.json('json', parseJsonObject),
} as const;

/**
 * Decorates an {@link LlmProvider} with {@link Kv} read-through caching.
 * Same composition on server (OpenAI) and client (HTTP).
 */
export class LlmProviderWithKvCache implements LlmProvider {
  constructor(
    private readonly delegate: LlmProvider,
    private readonly kv: Kv
  ) {}

  get id(): string {
    return this.delegate.id;
  }

  async structured(input: LlmStructuredRequest): Promise<LlmStructuredResult> {
    const hash = await llmCacheKeyFromRequest(this.delegate.id, input);
    const key = llmKvKey(this.delegate.id, hash);
    const cached = await this.kv.get(key);
    if (cached !== null) {
      return { json: LlmCacheAttr.json.from(cached) };
    }
    const out = await this.delegate.structured(input);
    await this.kv.put(key, LlmCacheAttr.json(out.json));
    return out;
  }
}
