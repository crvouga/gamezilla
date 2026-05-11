/**
 * Audio container the TTS pipeline emits and the client expects.
 * Kept tiny on purpose — `mp3` is the universal default; `wav` is for callers
 * that need lossless (preview tools, integration tests).
 */
export const TTS_AUDIO_FORMATS = ['mp3', 'wav'] as const;
export type TtsAudioFormat = (typeof TTS_AUDIO_FORMATS)[number];

/**
 * Canonical synthesize request. Resolved on the server (with provider defaults
 * filled in) before hashing for the cache key. Clients MAY omit `voiceId` /
 * `model` / `format` and let the server defaults apply.
 */
export type TtsSynthesizeRequest = {
  readonly text: string;
  readonly voiceId: string;
  readonly model: string;
  readonly format: TtsAudioFormat;
};

/**
 * Server response from `POST /tts/synthesize`. The `url` is a fully-qualified
 * GET that streams the audio bytes; `hash` and `cached` are diagnostic so the
 * client can show cache-hit ratios in dev tooling.
 */
export type TtsSynthesizeResponse = {
  readonly url: string;
  readonly hash: string;
  readonly contentType: string;
  readonly cached: boolean;
};

/** MIME type for the given {@link TtsAudioFormat}. */
export function ttsContentTypeFor(format: TtsAudioFormat): string {
  if (format === 'mp3') return 'audio/mpeg';
  return 'audio/wav';
}
