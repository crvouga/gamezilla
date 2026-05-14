/**
 * Discriminated `Voice` config every TTS call site MUST pass. There is no
 * server-side default voice — the synthesize route, the React `useTts.play`
 * hook, and the underlying `TtsProvider` all crash if a voice is missing.
 *
 * Each variant pairs a stable display `name` with a `provider` discriminant
 * and the provider-native ids (`voiceId`, `model`). Renaming a `name`
 * invalidates the existing R2 audio cache because `name` participates in
 * the cache key (see `tts-cache-key.ts`) — a renamed entry is, by design,
 * a different voice.
 *
 * Adding a new provider: append a variant with a new `provider` literal,
 * then add an adapter that asserts `input.voice.provider === '<literal>'`
 * (mirrors `ElevenLabsTtsProvider.synthesize`). Cache namespacing is
 * already handled by `TtsProvider.id`.
 */

export type ElevenLabsVoice =
  | {
      readonly name: 'David';
      readonly provider: 'eleven-labs';
      readonly voiceId: 'Zv7P8CISODgj9wDHyyI9';
      readonly model: 'eleven_turbo_v2_5';
    }
  | {
      readonly name: 'Sam';
      readonly provider: 'eleven-labs';
      readonly voiceId: '7WggD3IoWTIPT19PNyrW';
      readonly model: 'eleven_turbo_v2_5';
    }
  | {
      readonly name: 'Olivia';
      readonly provider: 'eleven-labs';
      readonly voiceId: '1SM7GgM6IMuvQlz2BwM3';
      readonly model: 'eleven_turbo_v2_5';
    }
  | {
      readonly name: 'Rachel';
      readonly provider: 'eleven-labs';
      readonly voiceId: '21m00Tcm4TlvDq8ikWAM';
      readonly model: 'eleven_turbo_v2_5';
    }
  | {
      readonly name: 'Jay Wayne';
      readonly provider: 'eleven-labs';
      readonly voiceId: '8Ln42OXYupYsag45MAUy';
      readonly model: 'eleven_turbo_v2_5';
    };

export type Voice = ElevenLabsVoice;

export type VoiceProvider = Voice['provider'];
export type VoiceName = Voice['name'];

export const Voices = {
  David: {
    name: 'David',
    provider: 'eleven-labs',
    voiceId: 'Zv7P8CISODgj9wDHyyI9',
    model: 'eleven_turbo_v2_5',
  },
  Sam: {
    name: 'Sam',
    provider: 'eleven-labs',
    voiceId: '7WggD3IoWTIPT19PNyrW',
    model: 'eleven_turbo_v2_5',
  },
  Olivia: {
    name: 'Olivia',
    provider: 'eleven-labs',
    voiceId: '1SM7GgM6IMuvQlz2BwM3',
    model: 'eleven_turbo_v2_5',
  },
  Rachel: {
    name: 'Rachel',
    provider: 'eleven-labs',
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    model: 'eleven_turbo_v2_5',
  },
  JayWayne: {
    name: 'Jay Wayne',
    provider: 'eleven-labs',
    voiceId: '8Ln42OXYupYsag45MAUy',
    model: 'eleven_turbo_v2_5',
  },
} as const satisfies Record<string, Voice>;

export const VOICE_PROVIDERS = ['eleven-labs'] as const satisfies readonly [
  VoiceProvider,
  ...VoiceProvider[],
];

export const VOICE_NAMES = [
  'David',
  'Sam',
  'Olivia',
  'Rachel',
  'Jay Wayne',
] as const;

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
