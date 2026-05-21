import type { TtsAudioFormat } from '../../shared/tts-types';
import type { Voice } from '../../shared/tts-voice';

/**
 * Resolved synthesize input. Every field is required at the routes layer
 * before reaching a provider — there are no server-side defaults to fall
 * back to. Adapters may further narrow `voice` via an
 * `assert(input.voice.provider === '<own provider>')` check (e.g. the
 * ElevenLabs adapter rejects voices from other providers rather than
 * silently coercing).
 */
export interface TtsSynthesizeInput {
  readonly text: string;
  readonly voice: Voice;
  readonly format: TtsAudioFormat;
}

export interface TtsSynthesizeOutput {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

/**
 * Pluggable text-to-speech backend. The only abstraction owned by this package;
 * storage is consumed via {@link @gamezilla/object-store/interface ObjectStore}.
 *
 * `id` participates in the cache key so swapping providers (e.g. elevenlabs
 * → openai) cannot serve stale audio synthesised by the previous provider for
 * the same text/voice/format triple.
 */
export interface TtsProvider {
  readonly id: string;
  synthesize(input: TtsSynthesizeInput): Promise<TtsSynthesizeOutput>;
}

/**
 * Thrown by adapters when the upstream service rejects the request. Routes map
 * this to a `502` so callers can distinguish "we couldn't talk to the provider"
 * from a generic 5xx.
 */
export class TtsProviderError extends Error {
  readonly __ttsProviderError = true as const;

  constructor(
    message: string,
    readonly providerId: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'TtsProviderError';
  }
}

export function isTtsProviderError(value: unknown): value is TtsProviderError {
  return (
    value !== null && typeof value === 'object' && '__ttsProviderError' in value
  );
}
