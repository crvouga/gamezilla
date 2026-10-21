import { describe, expect, test } from 'bun:test';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { InMemoryTtsProvider } from '@pkgs/tts-root-server-ts/in-memory-tts-provider';
import {
  synthesizeWithCache,
  ttsObjectKey,
} from '@pkgs/tts-root-server-ts/tts-synthesize';
import type { TtsProvider } from '@pkgs/tts-root-shared-ts/tts-provider';
import { TtsProviderError } from '@pkgs/tts-root-shared-ts/tts-provider';
import { Voices } from '@pkgs/tts-root-shared-ts/tts-voice';

const SAMPLE_INPUT = {
  text: 'Hello world',
  voice: Voices.David,
  format: 'mp3' as const,
};

describe('synthesizeWithCache', () => {
  test('cache miss: calls provider once, writes to store, returns cached=false', async () => {
    const provider = new InMemoryTtsProvider();
    const store = new ObjectStoreImplInMemory();

    const result = await synthesizeWithCache(
      { provider, objectStore: store },
      SAMPLE_INPUT
    );

    expect(result.cached).toBe(false);
    expect(result.contentType).toBe('audio/mpeg');
    expect(result.hash).toMatch(/^[0-9a-f]{32}$/);
    expect(result.key).toBe(
      ttsObjectKey(provider.id, result.hash, SAMPLE_INPUT.format)
    );
    expect(provider.callCount).toBe(1);
    expect(await store.head(result.key)).toBe(true);
  });

  test('cache hit: skips provider, returns cached=true', async () => {
    const provider = new InMemoryTtsProvider();
    const store = new ObjectStoreImplInMemory();

    const first = await synthesizeWithCache(
      { provider, objectStore: store },
      SAMPLE_INPUT
    );
    expect(first.cached).toBe(false);
    expect(provider.callCount).toBe(1);

    const second = await synthesizeWithCache(
      { provider, objectStore: store },
      SAMPLE_INPUT
    );
    expect(second.cached).toBe(true);
    expect(second.hash).toBe(first.hash);
    expect(second.key).toBe(first.key);
    expect(provider.callCount).toBe(1);
  });

  test('different text → different cache key, both miss', async () => {
    const provider = new InMemoryTtsProvider();
    const store = new ObjectStoreImplInMemory();

    const a = await synthesizeWithCache(
      { provider, objectStore: store },
      { ...SAMPLE_INPUT, text: 'A' }
    );
    const b = await synthesizeWithCache(
      { provider, objectStore: store },
      { ...SAMPLE_INPUT, text: 'B' }
    );
    expect(a.hash).not.toBe(b.hash);
    expect(a.cached).toBe(false);
    expect(b.cached).toBe(false);
    expect(provider.callCount).toBe(2);
  });

  test('different providers do not collide on the same hash', async () => {
    const providerA = new InMemoryTtsProvider({ id: 'A' });
    const providerB = new InMemoryTtsProvider({ id: 'B' });
    const store = new ObjectStoreImplInMemory();

    const a = await synthesizeWithCache(
      { provider: providerA, objectStore: store },
      SAMPLE_INPUT
    );
    const b = await synthesizeWithCache(
      { provider: providerB, objectStore: store },
      SAMPLE_INPUT
    );
    expect(a.key).not.toBe(b.key);
    expect(a.cached).toBe(false);
    expect(b.cached).toBe(false);
  });

  test('provider failure surfaces and nothing is written to the store', async () => {
    const failing: TtsProvider = {
      id: 'fail',
      synthesize: () =>
        Promise.reject(new TtsProviderError('upstream down', 'fail', 503)),
    };
    const store = new ObjectStoreImplInMemory();
    let caught: unknown = null;
    try {
      await synthesizeWithCache(
        { provider: failing, objectStore: store },
        SAMPLE_INPUT
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(TtsProviderError);
    const key = ttsObjectKey(failing.id, '', SAMPLE_INPUT.format);
    expect(await store.head(key)).toBe(false);
  });

  test('wav format produces an audio/wav cached entry', async () => {
    const provider = new InMemoryTtsProvider();
    const store = new ObjectStoreImplInMemory();
    const wavInput = { ...SAMPLE_INPUT, format: 'wav' as const };
    const result = await synthesizeWithCache(
      { provider, objectStore: store },
      wavInput
    );
    expect(result.contentType).toBe('audio/wav');
    expect(result.key.endsWith('.wav')).toBe(true);
    const stored = await store.get(result.key);
    expect(stored).not.toBeNull();
    if (stored !== null) {
      expect(stored.contentType).toBe('audio/wav');
    }
  });
});
