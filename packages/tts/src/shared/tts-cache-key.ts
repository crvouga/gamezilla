/**
 * Deterministic content-addressed cache key for TTS audio.
 *
 * The key is `SHA-256(canonicalJSON(input))`, hex-encoded and truncated to 32
 * chars (~128 bits — collision-resistant well past any plausible cache size).
 * Canonicalisation sorts object keys so callers building the input object in
 * different orders still hash to the same key.
 *
 * `providerId` is part of the input so the same `text` / `voiceId` cached under
 * a different provider doesn't collide on the same key.
 *
 * Uses `crypto.subtle` which is available in every runtime that hosts the
 * server (Workers, Bun, Node 18+, browsers). This module is `shared/` so it
 * also runs in the React-Native client bundle for tests; production clients
 * never call it because the server is the single source of truth for the key.
 */

import type { TtsAudioFormat } from './tts-types';

export type TtsCacheKeyInput = {
  readonly providerId: string;
  readonly model: string;
  readonly voiceId: string;
  readonly text: string;
  readonly format: TtsAudioFormat;
};

const HASH_HEX_LEN = 32;

function canonicalJson(input: TtsCacheKeyInput): string {
  const ordered = {
    format: input.format,
    model: input.model,
    providerId: input.providerId,
    text: input.text,
    voiceId: input.voiceId,
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
