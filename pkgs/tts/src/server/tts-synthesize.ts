import type { ObjectStore } from '@pkgs/object-store/interface';
import { ttsCacheKey } from '../shared/tts-cache-key';
import { ttsContentTypeFor, type TtsAudioFormat } from '../shared/tts-types';
import type { TtsProvider, TtsSynthesizeInput } from './ports/tts-provider';

/**
 * Object key under which an audio blob is cached in the {@link ObjectStore}.
 * Namespacing by provider id keeps multiple providers' caches from colliding
 * on the same hash. The feature prefix (`tts-audio/`) is applied via
 * {@link ObjectStore.withPrefix} at the API binding layer.
 */
export function ttsObjectKey(
  providerId: string,
  hash: string,
  format: TtsAudioFormat
): string {
  return `${providerId}/${hash}.${format}`;
}

export type TtsSynthesizeResult = {
  /** Cache hash (also the URL path segment served by the routes layer). */
  readonly hash: string;
  /** Underlying object key in the {@link ObjectStore}. */
  readonly key: string;
  readonly contentType: string;
  readonly cached: boolean;
};

export type SynthesizeWithCacheDeps = {
  readonly provider: TtsProvider;
  readonly objectStore: ObjectStore;
};

/**
 * Cache-then-generate orchestration. Pure function over the {@link TtsProvider}
 * port and the {@link ObjectStore} interface — never imports a concrete
 * adapter, so the same code runs against B2 in production and an in-memory
 * store in tests.
 *
 * Algorithm:
 *   1. Compute the cache key from the resolved input.
 *   2. `head` the object store. Hit → return `cached: true`, no provider call.
 *   3. Miss → call the provider, `put` the bytes, return `cached: false`.
 *
 * Concurrent calls for the same key MAY both miss and both call the provider;
 * both `put` calls are idempotent so the final state is consistent. We do not
 * coalesce in-flight requests here because Workers isolates are short-lived
 * and per-request — coalescing would only help inside one isolate's burst.
 */
export async function synthesizeWithCache(
  deps: SynthesizeWithCacheDeps,
  input: TtsSynthesizeInput
): Promise<TtsSynthesizeResult> {
  const hash = await ttsCacheKey({
    providerId: deps.provider.id,
    voice: input.voice,
    text: input.text,
    format: input.format,
  });
  const key = ttsObjectKey(deps.provider.id, hash, input.format);

  if (await deps.objectStore.head(key)) {
    return {
      hash,
      key,
      contentType: ttsContentTypeFor(input.format),
      cached: true,
    };
  }

  const out = await deps.provider.synthesize(input);
  await deps.objectStore.put(key, out.bytes, out.contentType);
  return {
    hash,
    key,
    contentType: out.contentType,
    cached: false,
  };
}
