/**
 * Deterministic content-addressed cache key for TTS audio.
 *
 * The key is `SHA-256(canonicalJSON(input))`, hex-encoded and truncated to 32
 * chars (~128 bits — collision-resistant well past any plausible cache size).
 * Canonicalisation sorts object keys so callers building the input object in
 * different orders still hash to the same key.
 *
 * `providerId` is part of the input so the same `text` cached under a
 * different provider doesn't collide on the same key. The full `Voice`
 * discriminant (`name`, `provider`, `voiceId`, `model`) is folded in too —
 * renaming a `Voice` entry (or pointing it at a different ElevenLabs id)
 * counts as a different voice and invalidates the existing R2 cache.
 *
 * Uses `crypto.subtle` which is available in every runtime that hosts the
 * server (Workers, Bun, Node 18+, browsers). This module is `shared/` so it
 * also runs in the React-Native client bundle for tests; production clients
 * never call it because the server is the single source of truth for the key.
 */

import type { TtsAudioFormat } from './tts-types';
import type { Voice } from './tts-voice';

export type TtsCacheKeyInput = {
  readonly providerId: string;
  readonly voice: Voice;
  readonly text: string;
  readonly format: TtsAudioFormat;
};

const HASH_HEX_LEN = 32;

function canonicalJson(input: TtsCacheKeyInput): string {
  const ordered = {
    format: input.format,
    providerId: input.providerId,
    text: input.text,
    voiceModel: input.voice.model,
    voiceName: input.voice.name,
    voiceProvider: input.voice.provider,
    voiceVoiceId: input.voice.voiceId,
  };
  return JSON.stringify(ordered);
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

export async function ttsCacheKey(input: TtsCacheKeyInput): Promise<string> {
  const canonical = canonicalJson(input);
  const encoded = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  const hex = bytesToHex(new Uint8Array(digest));
  return hex.slice(0, HASH_HEX_LEN);
}
