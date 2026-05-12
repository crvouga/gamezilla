import { describe, expect, mock, test } from 'bun:test';
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

describe('TtsClient.synthesize', () => {
  test('absolutizes a root-relative URL against apiUrl', async () => {
    const fetchMock = mock(async () => jsonResponse(SAMPLE_RESPONSE));
    const client = new TtsClient({
      apiUrl: 'http://127.0.0.1:8788',
      fetch: fetchMock,
    });
    const result = await client.synthesize(SAMPLE_REQUEST);
    expect(result.url).toBe('http://127.0.0.1:8788/tts/audio/abc.mp3');
  });

  test('strips trailing slashes from apiUrl', async () => {
    const fetchMock = mock(async () => jsonResponse(SAMPLE_RESPONSE));
    const client = new TtsClient({
      apiUrl: 'https://api.gamezilla.app///',
      fetch: fetchMock,
    });
    const result = await client.synthesize(SAMPLE_REQUEST);
    expect(result.url).toBe('https://api.gamezilla.app/tts/audio/abc.mp3');
  });

  test('passes absolute URLs through unchanged', async () => {
    const fetchMock = mock(async () =>
      jsonResponse({ ...SAMPLE_RESPONSE, url: 'https://cdn.example/abc.mp3' })
    );
    const client = new TtsClient({
      apiUrl: 'http://127.0.0.1:8788',
      fetch: fetchMock,
    });
    const result = await client.synthesize(SAMPLE_REQUEST);
    expect(result.url).toBe('https://cdn.example/abc.mp3');
  });

  test('non-2xx → TtsClientError with status', async () => {
    const fetchMock = mock(async () => new Response('boom', { status: 502 }));
    const client = new TtsClient({
      apiUrl: 'http://127.0.0.1:8788',
      fetch: fetchMock,
    });
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
    const fetchMock = mock(async () => jsonResponse(SAMPLE_RESPONSE));
    const client = new TtsClient({
      apiUrl: 'http://127.0.0.1:8788',
      fetch: fetchMock,
    });
    await client.synthesize(SAMPLE_REQUEST);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call0 = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(call0[1].body as string) as TtsSynthesizeRequest;
    expect(body.text).toBe('hi');
    expect(body.format).toBe('mp3');
    expect(body.voice).toEqual(Voices.David);
  });
});
