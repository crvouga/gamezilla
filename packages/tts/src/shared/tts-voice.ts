/**
 * Discriminated `Voice` config every TTS call site MUST pass when calling
 * `play` / synthesize — there is no server-side default voice id.
 *
 * **App default:** import {@link DEFAULT_TTS_VOICE} (used by `useSpeak` when
 * `voice` is omitted). Change that one export to switch the default coach
 * voice app-wide.
 *
 * Each variant pairs a stable display `name` with a `provider` discriminant
 * and the provider-native ids (`voiceId`, `model`). Renaming a `name`
 * invalidates the existing R2 audio cache because `name` participates in
 * the cache key (see `tts-cache-key.ts`) — a renamed entry is, by design,
 * a different voice.
 *
 * Adding a new provider: add entries with a new `provider` literal,
 * then add an adapter that asserts `input.voice.provider === '<literal>'`
 * (mirrors `ElevenLabsTtsProvider.synthesize`). Cache namespacing is
 * already handled by `TtsProvider.id`.
 */

const ELEVEN_LABS_MODEL = 'eleven_turbo_v2_5' as const;
const ELEVEN_LABS_PROVIDER = 'eleven-labs' as const;

function elevenLabsVoice<const N extends string, const V extends string>(
  name: N,
  voiceId: V
) {
  return {
    name,
    provider: ELEVEN_LABS_PROVIDER,
    voiceId,
    model: ELEVEN_LABS_MODEL,
  } as const;
}

/**
 * All built-in ElevenLabs voices. Keys are stable identifiers; `name` is the
 * human label (and cache key component).
 */
export const Voices = {
  David: elevenLabsVoice('David', 'Zv7P8CISODgj9wDHyyI9'),
  Sam: elevenLabsVoice('Sam', '7WggD3IoWTIPT19PNyrW'),
  Olivia: elevenLabsVoice('Olivia', '1SM7GgM6IMuvQlz2BwM3'),
  Rachel: elevenLabsVoice('Rachel', '21m00Tcm4TlvDq8ikWAM'),
  JayWayne: elevenLabsVoice('Jay Wayne', '8Ln42OXYupYsag45MAUy'),
  LeoV2: elevenLabsVoice('Leo V2', 'bbGtsRRKUfYO634UxSjz'),
  Mark: elevenLabsVoice('Mark', '1SM7GgM6IMuvQlz2BwM3'),
} as const;

export type Voice = (typeof Voices)[keyof typeof Voices];

/** @deprecated Use {@link Voice}; kept for server bundle re-exports. */
export type ElevenLabsVoice = Voice;

export type VoiceProvider = Voice['provider'];
export type VoiceName = Voice['name'];

/**
 * Default `voice` when hooks or UI omit it. **Single knob** to change the
 * app-wide TTS default (e.g. coach / `useSpeak`).
 */
export const DEFAULT_TTS_VOICE: Voice = Voices.Mark;

export const VOICE_PROVIDERS = ['eleven-labs'] as const satisfies readonly [
  VoiceProvider,
  ...VoiceProvider[],
];

export const VOICE_NAMES: readonly VoiceName[] = Object.values(Voices).map(
  (v): VoiceName => v.name
);

export const VOICES: readonly Voice[] = Object.values(Voices);

/**
 * Maps the {@link Voice} discriminant to the server-side `TtsProvider.id`
 * (the namespace under which audio is cached). The two strings are
 * intentionally different — `'eleven-labs'` (hyphenated) is the public-facing
 * Voice tag, `'elevenlabs'` (no hyphen) is the internal R2 cache namespace
 * — so this mapping is the single source of truth for the client cache key
 * to match the server cache key.
 */
export function ttsProviderIdForVoice(voice: Voice): string {
  if (voice.provider === 'eleven-labs') return 'elevenlabs';
  const exhaustive: never = voice.provider;
  throw new Error(`unknown voice provider: ${exhaustive as string}`);
}
