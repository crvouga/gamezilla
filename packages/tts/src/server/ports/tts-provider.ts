import type { TtsAudioFormat } from '../../shared/tts-types';

/**
 * Resolved synthesize input — every field is required by the time it reaches a
 * provider. The orchestrator fills in defaults from the provider before calling
 * `synthesize`, so adapters never have to worry about "missing voiceId".
 */
export interface TtsSynthesizeInput {
  readonly text: string;
  readonly voiceId: string;
  readonly model: string;
  readonly format: TtsAudioFormat;
}

export interface TtsSynthesizeOutput {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

/**
 * Pluggable text-to-speech backend. The only abstraction owned by this package;
 * storage is consumed via {@link @gamezilla/lib/object-store/interface ObjectStore}.
 *
 * `id` is participated in the cache key so swapping providers (e.g. elevenlabs
 * → openai) cannot serve stale audio synthesised by the previous provider for
 * the same text/voice/model triple.
 *
 * `defaultVoiceId` / `defaultModel` are consulted by the orchestrator when the
 * client request omits the field. Adapters MUST set sensible defaults.
 */
export interface TtsProvider {
  readonly id: string;
  readonly defaultVoiceId: string;
  readonly defaultModel: string;
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
