import {
  TtsProviderError,
  type TtsProvider,
  type TtsSynthesizeInput,
  type TtsSynthesizeOutput,
} from '../ports/tts-provider';

/**
 * Default voice + model used when the client doesn't specify one. ElevenLabs's
 * shared "Rachel" voice and the latest low-latency turbo model are both
 * available on the free / starter tiers.
 */
export const ELEVEN_LABS_DEFAULT_VOICE_ID = '7WggD3IoWTIPT19PNyrW';
// '1SM7GgM6IMuvQlz2BwM3';
// '21m00Tcm4TlvDq8ikWAM';
export const ELEVEN_LABS_DEFAULT_MODEL = 'eleven_turbo_v2_5';

const ELEVEN_LABS_BASE_URL = 'https://api.elevenlabs.io/v1';

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type ElevenLabsTtsProviderOptions = {
  readonly apiKey: string;
  readonly defaultVoiceId?: string;
  readonly defaultModel?: string;
  /** Override for tests. Defaults to `globalThis.fetch`. */
  readonly fetch?: FetchFn;
  /** Override the ElevenLabs base URL (for proxies / staging). */
  readonly baseUrl?: string;
};

function outputFormatFor(format: TtsSynthesizeInput['format']): string {
  if (format === 'mp3') return 'mp3_44100_128';
  return 'pcm_44100';
}

function contentTypeFor(format: TtsSynthesizeInput['format']): string {
  if (format === 'mp3') return 'audio/mpeg';
  return 'audio/wav';
}

/**
 * {@link TtsProvider} backed by ElevenLabs's `/text-to-speech/{voice_id}`
 * endpoint. The HTTP body is raw audio (mp3 or pcm) — no JSON wrapper.
 *
 * Errors from the API are surfaced as {@link TtsProviderError} so the routes
 * can map them to a `502` instead of a generic `500`.
 *
 * @see https://elevenlabs.io/docs/api-reference/text-to-speech
 */
export class ElevenLabsTtsProvider implements TtsProvider {
  readonly id = 'elevenlabs';
  readonly defaultVoiceId: string;
  readonly defaultModel: string;
  private readonly apiKey: string;
  private readonly fetchFn: FetchFn;
  private readonly baseUrl: string;

  constructor(options: ElevenLabsTtsProviderOptions) {
    if (options.apiKey.trim().length === 0) {
      throw new Error('ElevenLabsTtsProvider: apiKey must be non-empty');
    }
    this.apiKey = options.apiKey;
    this.defaultVoiceId =
      options.defaultVoiceId ?? ELEVEN_LABS_DEFAULT_VOICE_ID;
    this.defaultModel = options.defaultModel ?? ELEVEN_LABS_DEFAULT_MODEL;
    this.fetchFn =
      options.fetch ?? ((input, init) => globalThis.fetch(input, init));
    this.baseUrl = options.baseUrl ?? ELEVEN_LABS_BASE_URL;
  }

  async synthesize(input: TtsSynthesizeInput): Promise<TtsSynthesizeOutput> {
    const url = new URL(
      `${this.baseUrl}/text-to-speech/${encodeURIComponent(input.voiceId)}`
    );
    url.searchParams.set('output_format', outputFormatFor(input.format));

    const response = await this.fetchFn(url.toString(), {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
        Accept: contentTypeFor(input.format),
      },
      body: JSON.stringify({
        text: input.text,
        model_id: input.model,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new TtsProviderError(
        `ElevenLabs returned ${response.status}: ${detail.slice(0, 256)}`,
        this.id,
        response.status
      );
    }

    const buffer = await response.arrayBuffer();
    return {
      bytes: new Uint8Array(buffer),
      contentType: contentTypeFor(input.format),
    };
  }
}
