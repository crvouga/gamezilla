import { beforeEach, describe, expect, test } from 'bun:test';
import { ObjectStoreImplInMemory } from '@gamezilla/lib/object-store/impl-in-memory';
import type { TtsSynthesizeResponse } from '../shared/tts-types';
import { InMemoryTtsProvider } from './adapters/in-memory-tts-provider';
import { TtsProviderError } from './ports/tts-provider';
import { createTtsApp } from './tts-routes';

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`https://example.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function getRequest(path: string): Request {
  return new Request(`https://example.test${path}`, { method: 'GET' });
}

describe('createTtsApp', () => {
  let provider: InMemoryTtsProvider;
  let store: ObjectStoreImplInMemory;
  let app: ReturnType<typeof createTtsApp>;

  beforeEach(() => {
    provider = new InMemoryTtsProvider();
    store = new ObjectStoreImplInMemory();
    app = createTtsApp({ provider, objectStore: store });
  });

  test('POST /tts/synthesize: happy path returns url, hash, cached=false', async () => {
    const res = await app.fetch(jsonRequest('/tts/synthesize', { text: 'Hi' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as TtsSynthesizeResponse;
    expect(body.cached).toBe(false);
    expect(body.contentType).toBe('audio/mpeg');
    expect(body.hash).toMatch(/^[0-9a-f]{32}$/);
    expect(body.url).toBe(`/tts/audio/${body.hash}.mp3`);
    expect(provider.callCount).toBe(1);
  });

  test('POST /tts/synthesize: second call hits the cache', async () => {
    const first = await app.fetch(
      jsonRequest('/tts/synthesize', { text: 'Hi' })
    );
    const firstBody = (await first.json()) as TtsSynthesizeResponse;
    expect(firstBody.cached).toBe(false);

    const second = await app.fetch(
      jsonRequest('/tts/synthesize', { text: 'Hi' })
    );
    const secondBody = (await second.json()) as TtsSynthesizeResponse;
    expect(secondBody.cached).toBe(true);
    expect(secondBody.hash).toBe(firstBody.hash);
    expect(provider.callCount).toBe(1);
  });

  test('POST /tts/synthesize: rejects empty text with 400', async () => {
    const res = await app.fetch(
      jsonRequest('/tts/synthesize', { text: '   ' })
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('non-empty');
  });

  test('POST /tts/synthesize: rejects malformed body with 400', async () => {
    const res = await app.fetch(jsonRequest('/tts/synthesize', null));
    expect(res.status).toBe(400);
  });

  test('POST /tts/synthesize: rejects bad format with 400', async () => {
    const res = await app.fetch(
      jsonRequest('/tts/synthesize', { text: 'Hi', format: 'flac' })
    );
    expect(res.status).toBe(400);
  });

  test('POST /tts/synthesize: maps provider failure to 502', async () => {
    const failing = {
      id: 'fail',
      defaultVoiceId: 'v',
      defaultModel: 'm',
      synthesize: () =>
        Promise.reject(new TtsProviderError('upstream down', 'fail', 503)),
    };
    const failingApp = createTtsApp({ provider: failing, objectStore: store });
    const res = await failingApp.fetch(
      jsonRequest('/tts/synthesize', { text: 'Hi' })
    );
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string; providerId: string };
    expect(body.providerId).toBe('fail');
    expect(body.error).toContain('upstream down');
  });

  test('GET /tts/audio/:hash streams stored bytes', async () => {
    const synth = await app.fetch(
      jsonRequest('/tts/synthesize', { text: 'Hi', format: 'wav' })
    );
    const synthBody = (await synth.json()) as TtsSynthesizeResponse;

    const audio = await app.fetch(
      getRequest(`/tts/audio/${synthBody.hash}.wav`)
    );
    expect(audio.status).toBe(200);
    expect(audio.headers.get('Content-Type')).toBe('audio/wav');
    expect(audio.headers.get('Cache-Control')).toContain('immutable');
    // COEP=`require-corp` clients (e.g. our Expo dev server) can't load this
    // cross-origin without a CORP header; regression-guard it.
    expect(audio.headers.get('Cross-Origin-Resource-Policy')).toBe(
      'cross-origin'
    );
    const bytes = new Uint8Array(await audio.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(0);
    expect(bytes.subarray(0, 4)).toEqual(
      new Uint8Array([0x52, 0x49, 0x46, 0x46])
    );
  });

  test('GET /tts/audio/:hash 404s on unknown hash', async () => {
    const fakeHash = 'a'.repeat(32);
    const res = await app.fetch(getRequest(`/tts/audio/${fakeHash}.mp3`));
    expect(res.status).toBe(404);
  });

  test('GET /tts/audio/:hash 400s on invalid hash format', async () => {
    const res = await app.fetch(getRequest('/tts/audio/not-a-hash.mp3'));
    expect(res.status).toBe(400);
  });

  test('GET /tts/audio/:hash 400s on invalid extension', async () => {
    const fakeHash = 'a'.repeat(32);
    const res = await app.fetch(getRequest(`/tts/audio/${fakeHash}.flac`));
    expect(res.status).toBe(400);
  });

  test('requireAuth is enforced on synthesize', async () => {
    let calls = 0;
    const guarded = createTtsApp({
      provider,
      objectStore: store,
      requireAuth: (req) => {
        calls += 1;
        if (req.headers.get('Authorization') === null) {
          throw new Error('missing auth');
        }
        return Promise.resolve(null);
      },
    });

    const unauthed = await guarded.fetch(
      jsonRequest('/tts/synthesize', { text: 'Hi' })
    );
    expect(unauthed.status).toBe(500);
    expect(calls).toBe(1);

    const authedReq = new Request('https://example.test/tts/synthesize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer x',
      },
      body: JSON.stringify({ text: 'Hi' }),
    });
    const authed = await guarded.fetch(authedReq);
    expect(authed.status).toBe(200);
    expect(calls).toBe(2);
  });

  test('requireAuth does NOT gate audio GET (audio URLs are content-addressed)', async () => {
    const guarded = createTtsApp({
      provider,
      objectStore: store,
      requireAuth: () => Promise.reject(new Error('blocked')),
    });
    const fakeHash = 'a'.repeat(32);
    const audio = await guarded.fetch(getRequest(`/tts/audio/${fakeHash}.mp3`));
    expect(audio.status).toBe(404);
  });
});
