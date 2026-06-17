import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

import type {
  TtsSynthesizeRequest,
  TtsSynthesizeResponse,
} from '../shared/tts-types';
import { Voices } from '../shared/tts-voice';
import { TtsClient } from './tts-client';
import { TtsClientError } from './tts-client-error';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function audioResponse(bytes: Uint8Array): Response {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return new Response(ab, {
    status: 200,
    headers: { 'Content-Type': 'audio/mpeg' },
  });
}

const SAMPLE_RESPONSE: TtsSynthesizeResponse = {
  url: '/tts/audio/abc.mp3',
  hash: 'abc',
  contentType: 'audio/mpeg',
  cached: false,
};

const SAMPLE_REQUEST = {
  text: 'hi',
  voice: Voices.David,
  format: 'mp3' as const,
};

const SAMPLE_AUDIO = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 0x01, 0x02, 0x03]);

let store: ObjectStoreImplInMemory;
beforeEach(() => {
  store = new ObjectStoreImplInMemory();
});

function makeClient(
  fetchMock: ReturnType<typeof mock>,
  apiUrl = 'http://127.0.0.1:8788'
): TtsClient {
  return new TtsClient({
    apiUrl,
    objectStore: store,
    fetch: fetchMock as unknown as typeof fetch,
  });
}

// Builds a fetch mock that handles two URL patterns:
//  - POST <any>/tts/synthesize  → JSON `synthResponse`
//  - GET  <any-other-url>       → mp3 bytes
// Tracks call count so tests can assert "no extra fetch on cache hit".
function fetchMockSynthThenAudio(
  synthResponse: TtsSynthesizeResponse,
  audioBytes = SAMPLE_AUDIO
) {
  return mock(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input);
    if (url.endsWith('/api/tts/synthesize') && init?.method === 'POST') {
      return jsonResponse(synthResponse);
    }
    return audioResponse(audioBytes);
  });
}

describe('TtsClient.synthesize', () => {
  test('absolutizes a root-relative URL against apiUrl on first miss', async () => {
    const fetchMock = fetchMockSynthThenAudio(SAMPLE_RESPONSE);
    const client = makeClient(fetchMock);
    const result = await client.synthesize(SAMPLE_REQUEST);
    // After a cache-miss the response url points at a `blob:` URL on Bun
    // (in-memory store materialises one). `absolutize` is still exercised
    // via the intermediate audio download.
    expect(fetchMock.mock.calls.length).toBe(2);
    const audioCall = fetchMock.mock.calls[1] as unknown as [string];
    expect(audioCall[0]).toBe('http://127.0.0.1:8788/api/tts/audio/abc.mp3');
    expect(result.cached).toBe(false);
    expect(typeof result.url).toBe('string');
    expect(result.url.length).toBeGreaterThan(0);
  });

  test('strips trailing slashes from apiUrl', async () => {
    const fetchMock = fetchMockSynthThenAudio(SAMPLE_RESPONSE);
    const client = makeClient(fetchMock, 'https://api.example.com///');
    await client.synthesize(SAMPLE_REQUEST);
    const audioCall = fetchMock.mock.calls[1] as unknown as [string];
    expect(audioCall[0]).toBe('https://api.example.com/api/tts/audio/abc.mp3');
  });

  test('passes absolute URLs through unchanged', async () => {
    const fetchMock = fetchMockSynthThenAudio({
      ...SAMPLE_RESPONSE,
      url: 'https://cdn.example/abc.mp3',
    });
    const client = makeClient(fetchMock);
    await client.synthesize(SAMPLE_REQUEST);
    const audioCall = fetchMock.mock.calls[1] as unknown as [string];
    expect(audioCall[0]).toBe('https://cdn.example/abc.mp3');
  });

  test('non-2xx synth POST → TtsClientError with status', async () => {
    const fetchMock = mock(async () => new Response('boom', { status: 502 }));
    const client = makeClient(fetchMock);
    let caught: unknown = null;
    try {
      await client.synthesize(SAMPLE_REQUEST);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(TtsClientError);
    if (caught instanceof TtsClientError) {
      expect(caught.status).toBe(502);
    }
  });

  test('serialises text, voice, and format to the request body', async () => {
    const fetchMock = fetchMockSynthThenAudio(SAMPLE_RESPONSE);
    const client = makeClient(fetchMock);
    await client.synthesize(SAMPLE_REQUEST);
    const synthCall = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(
      synthCall[1].body as string
    ) as TtsSynthesizeRequest;
    expect(body.text).toBe('hi');
    expect(body.format).toBe('mp3');
    expect(body.voice).toEqual(Voices.David);
  });

  test('cache hit: second call to synthesize does not re-fetch', async () => {
    const fetchMock = fetchMockSynthThenAudio(SAMPLE_RESPONSE);
    const client = makeClient(fetchMock);

    const first = await client.synthesize(SAMPLE_REQUEST);
    expect(first.cached).toBe(false);
    expect(fetchMock.mock.calls.length).toBe(2);

    const second = await client.synthesize(SAMPLE_REQUEST);
    expect(second.cached).toBe(true);
    // No additional fetches on hit.
    expect(fetchMock.mock.calls.length).toBe(2);
    // The cached response carries the locally-derived SHA-256 cache key
    // (32 hex chars) — independent of whatever `hash` the server returned
    // on the original miss.
    expect(second.hash).toMatch(/^[0-9a-f]{32}$/);
    expect(typeof second.url).toBe('string');
    expect(second.url.length).toBeGreaterThan(0);
  });

  test('different text → different cache key → re-fetches', async () => {
    const fetchMock = fetchMockSynthThenAudio(SAMPLE_RESPONSE);
    const client = makeClient(fetchMock);

    await client.synthesize(SAMPLE_REQUEST);
    await client.synthesize({
      ...SAMPLE_REQUEST,
      text: 'completely different',
    });
    // 2 calls per miss × 2 misses = 4
    expect(fetchMock.mock.calls.length).toBe(4);
  });

  test('different voice → different cache key → re-fetches', async () => {
    const fetchMock = fetchMockSynthThenAudio(SAMPLE_RESPONSE);
    const client = makeClient(fetchMock);

    await client.synthesize(SAMPLE_REQUEST);
    await client.synthesize({ ...SAMPLE_REQUEST, voice: Voices.Sam });
    expect(fetchMock.mock.calls.length).toBe(4);
  });
});
