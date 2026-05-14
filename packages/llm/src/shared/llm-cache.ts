import type { Kv } from '@gamezilla/lib/kv/interface';

import { llmCacheKeyFromRequest } from './llm-cache-key';
import {
  parseLlmStructuredCacheValue,
  serializeLlmStructuredCacheValue,
} from './llm-cache-value';
import { llmKvKey } from './llm-kv-key';
import type { LlmProvider } from './llm-provider';
import type { LlmStructuredRequest } from './llm-types';

/**
 * Decorates an {@link LlmProvider} with {@link Kv} read-through caching.
 * Same composition on server (OpenAI) and client (HTTP).
 */
export function withKvCache(provider: LlmProvider, kv: Kv): LlmProvider {
  return {
    id: provider.id,
    async structured(input: LlmStructuredRequest) {
      const hash = await llmCacheKeyFromRequest(provider.id, input);
      const key = llmKvKey(provider.id, hash);
      const cached = await kv.get(key);
      if (cached !== null) {
        return parseLlmStructuredCacheValue(cached);
      }
      const out = await provider.structured(input);
      await kv.put(key, serializeLlmStructuredCacheValue(out));
      return out;
    },
  };
}
