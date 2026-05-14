import type { Kv } from '@gamezilla/lib/kv/interface';

import { llmCacheKeyFromRequest } from './llm-cache-key';
import {
  parseLlmStructuredCacheValue,
  serializeLlmStructuredCacheValue,
} from './llm-cache-value';
import { llmKvKey } from './llm-kv-key';
import type { LlmProvider } from './llm-provider';
import type { LlmStructuredRequest, LlmStructuredResult } from './llm-types';

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
      return parseLlmStructuredCacheValue(cached);
    }
    const out = await this.delegate.structured(input);
    await this.kv.put(key, serializeLlmStructuredCacheValue(out));
    return out;
  }
}
