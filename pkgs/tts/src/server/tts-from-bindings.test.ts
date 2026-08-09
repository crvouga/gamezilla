import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { ObjectStorePrefix } from '@pkgs/object-store/prefixes';
import type { SecretStore } from '@pkgs/secret-store';
import { wrapSecret } from '@pkgs/secret-store/wrap-secret';
import type { TtsSynthesizeResponse } from '../shared/tts-types';
import { Voices } from '../shared/tts-voice';
import { createTtsAppFromBindings, TtsSecretName } from './tts-from-bindings';
import { ttsObjectKey } from './tts-synthesize';

const SAMPLE_MP3 = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 0x01, 0x02, 0x03]);

function makeSecretStore(
  apiKey: string | null = 'test-eleven-key'
): SecretStore {
  return {
    getRequired: async (name) => {
      if (name === TtsSecretName.elevenLabsApiKey && apiKey !== null) {
        return wrapSecret(name, apiKey);
      }
      throw new Error(`unexpected secret: ${name}`);
    },
    getOptional: async (name) => {
      if (name === TtsSecretName.elevenLabsApiKey && apiKey !== null) {
        return wrapSecret(name, apiKey);
      }
      return null;
    },
    getRequiredMany: async () => ({}),
    getOptionalMany: async (names) =>
      Object.fromEntries(names.map((name) => [name, null])),
    setSecret: async () => undefined,
  };
}

describe('createTtsAppFromBindings', () => {
  let rootStore: ObjectStoreImplInMemory;
  let fetchMock: ReturnType<typeof mock>;

  beforeEach(() => {
    rootStore = new ObjectStoreImplInMemory();
    fetchMock = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('api.elevenlabs.io/v1/text-to-speech/')) {
        const ab = new ArrayBuffer(SAMPLE_MP3.byteLength);
        new Uint8Array(ab).set(SAMPLE_MP3);
        return new Response(ab, {
          status: 200,
          headers: { 'Content-Type': 'audio/mpeg' },
        });
      }
      return new Response('not found', { status: 404 });
    });
    const g = globalThis as Record<string, unknown>;
    g['fetch'] = fetchMock;
  });

  test('stores audio under the tts-audio/ prefix in the root object store', async () => {
    const { app, configured } = await createTtsAppFromBindings({
      secretStore: makeSecretStore(),
      objectStore: rootStore,
      requireAuth: () => Promise.resolve(undefined),
      fetch: fetchMock as (
        input: RequestInfo | URL,
        init?: RequestInit
      ) => Promise<Response>,
    });
    expect(configured).toBe(true);

    const res = await app.fetch(
      new Request('https://example.test/tts/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Hello',
          voice: Voices.David,
          format: 'mp3',
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as TtsSynthesizeResponse;
    expect(body.cached).toBe(false);

    const domainKey = ttsObjectKey('elevenlabs', body.hash, 'mp3');
    expect(domainKey.startsWith(ObjectStorePrefix.ttsAudio)).toBe(false);

    const physicalKey = `${ObjectStorePrefix.ttsAudio}${domainKey}`;
    expect(await rootStore.head(physicalKey)).toBe(true);
    expect(await rootStore.head(domainKey)).toBe(false);
  });

  test('returns 503 when ElevenLabs key is missing', async () => {
    const { app, configured } = await createTtsAppFromBindings({
      secretStore: makeSecretStore(null),
      objectStore: rootStore,
      requireAuth: () => Promise.resolve(undefined),
      fetch: fetchMock as (
        input: RequestInfo | URL,
        init?: RequestInit
      ) => Promise<Response>,
    });
    expect(configured).toBe(false);

    const res = await app.fetch(
      new Request('https://example.test/tts/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Hello',
          voice: Voices.David,
          format: 'mp3',
        }),
      })
    );
    expect(res.status).toBe(503);
  });
});
