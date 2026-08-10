import { describe, expect, mock, test } from 'bun:test';
import { type Voice, Voices } from '../../shared/tts-voice';
import { TtsProviderError } from '../ports/tts-provider';
import { ElevenLabsTtsProvider } from './elevenlabs-tts-provider';

function okResponse(bytes: Uint8Array, contentType = 'audio/mpeg'): Response {
  return new Response(new Blob([bytes as BlobPart]), {
    status: 200,
    headers: { 'Content-Type': contentType },
  });
}

const unusedFetch = async () => new Response();

describe('ElevenLabsTtsProvider', () => {
  test('rejects empty apiKey', () => {
    expect(
      () => new ElevenLabsTtsProvider({ apiKey: '   ', fetch: unusedFetch })
    ).toThrow('apiKey must be non-empty');
  });

  test('exposes provider id', () => {
    const provider = new ElevenLabsTtsProvider({
      apiKey: 'k',
      fetch: unusedFetch,
    });
    expect(provider.id).toBe('elevenlabs');
  });

  test('synthesize sends correct URL, headers, and body', async () => {
    const fetchMock = mock(async () => okResponse(new Uint8Array([1, 2, 3])));
    const provider = new ElevenLabsTtsProvider({
      apiKey: 'sk-test',
      fetch: fetchMock,
    });
    const result = await provider.synthesize({
      text: 'Hello',
      voice: Voices.Rachel,
      format: 'mp3',
    });

    expect(result.contentType).toBe('audio/mpeg');
    expect(Array.from(result.bytes)).toEqual([1, 2, 3]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call0 = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const urlArg = call0[0];
    const initArg = call0[1];
    expect(urlArg).toContain(`/v1/text-to-speech/${Voices.Rachel.voiceId}`);
    expect(urlArg).toContain('output_format=mp3_44100_128');
    const headers = initArg.headers as Record<string, string>;
    expect(headers['xi-api-key']).toBe('sk-test');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Accept']).toBe('audio/mpeg');
    expect(initArg.method).toBe('POST');
    expect(JSON.parse(initArg.body as string)).toEqual({
      text: 'Hello',
      model_id: Voices.Rachel.model,
    });
  });

  test('synthesize uses pcm output format and audio/wav content-type for wav', async () => {
    const fetchMock = mock(async () =>
      okResponse(new Uint8Array([0]), 'audio/wav')
    );
    const provider = new ElevenLabsTtsProvider({
      apiKey: 'sk-test',
      fetch: fetchMock,
    });
    const result = await provider.synthesize({
      text: 'Hi',
      voice: Voices.David,
      format: 'wav',
    });
    expect(result.contentType).toBe('audio/wav');
    const wavCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(wavCall[0]).toContain('output_format=pcm_44100');
    const headers = wavCall[1].headers as Record<string, string>;
    expect(headers['Accept']).toBe('audio/wav');
  });

  test('synthesize url-encodes the voiceId', async () => {
    const fetchMock = mock(async () => okResponse(new Uint8Array([0])));
    const provider = new ElevenLabsTtsProvider({
      apiKey: 'sk',
      fetch: fetchMock,
    });
    /**
     * Construct an in-test voice that bypasses the discriminated union to
     * exercise URL encoding for unusual ids — production callers always use
     * the `Voices.*` constants whose ids are already URL-safe.
     */
    const spacedVoice = {
      ...Voices.David,
      voiceId: 'spaced voice/id',
    } as unknown as Voice;
    await provider.synthesize({
      text: 't',
      voice: spacedVoice,
      format: 'mp3',
    });
    const encCall = fetchMock.mock.calls[0] as unknown as [string];
    expect(encCall[0]).toContain('/text-to-speech/spaced%20voice%2Fid');
  });

  test('synthesize throws TtsProviderError on non-2xx', async () => {
    const fetchMock = mock(
      async () => new Response('quota_exceeded', { status: 429 })
    );
    const provider = new ElevenLabsTtsProvider({
      apiKey: 'sk',
      fetch: fetchMock,
    });
    let caught: unknown = null;
    try {
      await provider.synthesize({
        text: 't',
        voice: Voices.David,
        format: 'mp3',
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(TtsProviderError);
    if (caught instanceof TtsProviderError) {
      expect(caught.providerId).toBe('elevenlabs');
      expect(caught.status).toBe(429);
      expect(caught.message).toContain('429');
      expect(caught.message).toContain('quota_exceeded');
    }
  });

  test('synthesize crashes on a non-eleven-labs voice', async () => {
    const fetchMock = mock(async () => okResponse(new Uint8Array([0])));
    const provider = new ElevenLabsTtsProvider({
      apiKey: 'sk',
      fetch: fetchMock,
    });
    /**
     * Forge a `Voice` with a different `provider` discriminant. The
     * adapter must reject it instead of forwarding to ElevenLabs with the
     * wrong ids/model — this is the safety net that catches a future
     * second-provider wiring bug.
     */
    const wrongProviderVoice = {
      ...Voices.David,
      provider: 'openai',
    } as unknown as Voice;
    expect(() =>
      provider.synthesize({
        text: 't',
        voice: wrongProviderVoice,
        format: 'mp3',
      })
    ).toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});
