import { beforeEach, describe, expect, test } from 'bun:test';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import type { TtsSynthesizeResponse } from '../shared/tts-types';
import { Voices } from '../shared/tts-voice';
import { InMemoryTtsProvider } from './adapters/in-memory-tts-provider';
import { TtsProviderError, type TtsProvider } from './ports/tts-provider';
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

const VALID_BODY = {
  text: 'Hi',
  voice: Voices.David,
  format: 'mp3' as const,
};

const noopRequireAuth = (): Promise<undefined> => Promise.resolve(undefined);

describe('createTtsApp', () => {
  let provider: InMemoryTtsProvider;
  let store: ObjectStoreImplInMemory;
  let app: ReturnType<typeof createTtsApp>;

  beforeEach(() => {
    provider = new InMemoryTtsProvider();
    store = new ObjectStoreImplInMemory();
    app = createTtsApp({
      provider,
      objectStore: store,
      requireAuth: noopRequireAuth,
    });
  });

  test('POST /tts/synthesize: normalizes typographic punctuation before provider call', async () => {
    const res = await app.fetch(
      jsonRequest('/tts/synthesize', {
        ...VALID_BODY,
        text: 'Checkmate is in the air — can you find it?',
      })
    );
    expect(res.status).toBe(200);
    expect(provider.lastInput?.text).toBe(
      'Checkmate is in the air, can you find it?'
    );
  });

  test('POST /tts/synthesize: happy path returns url, hash, cached=false', async () => {
    const res = await app.fetch(jsonRequest('/tts/synthesize', VALID_BODY));
    expect(res.status).toBe(200);
    const body = (await res.json()) as TtsSynthesizeResponse;
    expect(body.cached).toBe(false);
    expect(body.contentType).toBe('audio/mpeg');
    expect(body.hash).toMatch(/^[0-9a-f]{32}$/);
    expect(body.url).toBe(`/tts/audio/${body.hash}.mp3`);
    expect(provider.callCount).toBe(1);
  });

  test('POST /tts/synthesize: second call hits the cache', async () => {
    const first = await app.fetch(jsonRequest('/tts/synthesize', VALID_BODY));
    const firstBody = (await first.json()) as TtsSynthesizeResponse;
    expect(firstBody.cached).toBe(false);

    const second = await app.fetch(jsonRequest('/tts/synthesize', VALID_BODY));
    const secondBody = (await second.json()) as TtsSynthesizeResponse;
    expect(secondBody.cached).toBe(true);
    expect(secondBody.hash).toBe(firstBody.hash);
    expect(provider.callCount).toBe(1);
  });

  test('POST /tts/synthesize: rejects empty text with 400', async () => {
    const res = await app.fetch(
      jsonRequest('/tts/synthesize', { ...VALID_BODY, text: '   ' })
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
      jsonRequest('/tts/synthesize', { ...VALID_BODY, format: 'flac' })
    );
    expect(res.status).toBe(400);
  });

  test('POST /tts/synthesize: rejects missing format with 400', async () => {
    const res = await app.fetch(
      jsonRequest('/tts/synthesize', {
        text: VALID_BODY.text,
        voice: VALID_BODY.voice,
      })
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('format');
  });

  test('POST /tts/synthesize: rejects missing voice with 400', async () => {
    const res = await app.fetch(
      jsonRequest('/tts/synthesize', {
        text: VALID_BODY.text,
        format: VALID_BODY.format,
      })
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('voice');
  });

  test('POST /tts/synthesize: rejects voice with bad provider with 400', async () => {
    const res = await app.fetch(
      jsonRequest('/tts/synthesize', {
        ...VALID_BODY,
        voice: { ...Voices.David, provider: 'openai' },
      })
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('voice.provider');
  });

  test('POST /tts/synthesize: rejects voice missing voiceId with 400', async () => {
    const { voiceId: _omit, ...partial } = Voices.David;
    void _omit;
    const res = await app.fetch(
      jsonRequest('/tts/synthesize', {
        ...VALID_BODY,
        voice: partial,
      })
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('voice.voiceId');
  });

  test('POST /tts/synthesize: maps provider failure to 502', async () => {
    const failing: TtsProvider = {
      id: 'fail',
      synthesize: () =>
        Promise.reject(new TtsProviderError('upstream down', 'fail', 503)),
    };
    const failingApp = createTtsApp({
      provider: failing,
      objectStore: store,
      requireAuth: noopRequireAuth,
    });
    const res = await failingApp.fetch(
      jsonRequest('/tts/synthesize', VALID_BODY)
    );
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string; providerId: string };
    expect(body.providerId).toBe('fail');
    expect(body.error).toContain('upstream down');
  });

  test('GET /tts/audio/:hash streams stored bytes', async () => {
    const synth = await app.fetch(
      jsonRequest('/tts/synthesize', { ...VALID_BODY, format: 'wav' })
    );
    const synthBody = (await synth.json()) as TtsSynthesizeResponse;

    const audio = await app.fetch(
      getRequest(`/tts/audio/${synthBody.hash}.wav`)
    );
    expect(audio.status).toBe(200);
    expect(audio.headers.get('Content-Type')).toBe('audio/wav');
    expect(audio.headers.get('Cache-Control')).toContain('immutable');
    // COEP=`require-corp` clients (expo-sqlite web) can't load this cross-origin
    // without a CORP header; regression-guard it.
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
      jsonRequest('/tts/synthesize', VALID_BODY)
    );
    expect(unauthed.status).toBe(500);
    expect(calls).toBe(1);

    const authedReq = new Request('https://example.test/tts/synthesize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer x',
      },
      body: JSON.stringify(VALID_BODY),
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
