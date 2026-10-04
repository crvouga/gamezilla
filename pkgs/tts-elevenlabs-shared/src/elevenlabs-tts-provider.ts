import { Assert } from '@pkgs/assert-shared/assert';
import type { TtsProvider, TtsSynthesizeInput, TtsSynthesizeOutput } from '@pkgs/tts-shared/tts-provider';
import { TtsProviderError } from '@pkgs/tts-shared/tts-provider';

const ELEVEN_LABS_BASE_URL = 'https://api.elevenlabs.io/v1';

/**
 * `validation` mode (throws {@link ValidationError}) instead of `crash` mode:
 *
 * - The constructor's `apiKey` check fires at adapter wire-time, before any
 *   request lands. The host (`createTtsAppFromBindings`) already calls
 *   `secretStore.getRequired`, which itself crashes on a missing key — so by
 *   the time we reach the constructor a non-empty string is guaranteed and
 *   this check is a defense-in-depth guard. A thrown `ValidationError`
 *   bubbles up the boot path and surfaces in the api `onError` handler as a
 *   `400`-shaped log entry rather than exiting the Worker isolate.
 * - The `synthesize` voice-provider check is a per-request guard against a
 *   wiring bug (someone passes an `openai` voice into the elevenlabs
 *   adapter). The routes layer's `parseVoice` already rejects unknown
 *   discriminants with a `400`, so this assertion only fires on internal
 *   misuse — `ValidationError` keeps it recoverable and observable instead
 *   of taking the whole isolate down with `process.exit(1)`.
 */
const assert: Assert = Assert.validation();

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type ElevenLabsTtsProviderOptions = {
  readonly apiKey: string;
  /** HTTP transport (inject from Io / HttpClient). */
  readonly fetch: FetchFn;
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
 * The adapter rejects any `Voice` whose `provider` is not `'eleven-labs'` —
 * the discriminated union guarantees ids/models match the upstream API, so a
 * mismatch indicates a wiring bug at the call site.
 *
 * @see https://elevenlabs.io/docs/api-reference/text-to-speech
 */
export class ElevenLabsTtsProvider implements TtsProvider {
  readonly id = 'elevenlabs';
  private readonly apiKey: string;
  private readonly fetchFn: FetchFn;
  private readonly baseUrl: string;

  constructor(options: ElevenLabsTtsProviderOptions) {
    assert.nonEmptyString(
      options.apiKey.trim(),
      'ElevenLabsTtsProvider: apiKey must be non-empty'
    );
    this.apiKey = options.apiKey;
    this.fetchFn = options.fetch;
    this.baseUrl = options.baseUrl ?? ELEVEN_LABS_BASE_URL;
  }

  async synthesize(input: TtsSynthesizeInput): Promise<TtsSynthesizeOutput> {
    assert.equals(
      input.voice.provider,
      'eleven-labs',
      'ElevenLabsTtsProvider only handles eleven-labs voices',
      { received: input.voice.provider, voiceName: input.voice.name }
    );

    const url = new URL(
      `${this.baseUrl}/text-to-speech/${encodeURIComponent(input.voice.voiceId)}`
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
        model_id: input.voice.model,
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
