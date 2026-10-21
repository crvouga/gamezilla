import type { Voice } from './tts-voice';

/**
 * Audio container the TTS pipeline emits and the client expects.
 * `mp3` is the universal default; `wav` is for callers that need lossless
 * (preview tools, integration tests). `format` is required at every layer —
 * the routes / client / hook all crash when it's missing.
 */
export const TTS_AUDIO_FORMATS = ['mp3', 'wav'] as const;
export type TtsAudioFormat = (typeof TTS_AUDIO_FORMATS)[number];

/**
 * Canonical synthesize request. Every field is required at every layer:
 * the `useTts.play` hook, the `TtsClient` HTTP wrapper, and the
 * `POST /tts/synthesize` route all reject the call when `text`, `voice`, or
 * `format` is missing. There are no server-side defaults to fall back to.
 */
export type TtsSynthesizeRequest = {
  readonly text: string;
  readonly voice: Voice;
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
