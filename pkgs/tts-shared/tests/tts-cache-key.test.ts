import { describe, expect, test } from 'bun:test';
import type { TtsCacheKeyInput } from '@pkgs/tts-shared/tts-cache-key';
import { ttsCacheKey } from '@pkgs/tts-shared/tts-cache-key';
import type { Voice } from '@pkgs/tts-shared/tts-voice';
import { Voices } from '@pkgs/tts-shared/tts-voice';

const baseInput: TtsCacheKeyInput = {
  providerId: 'elevenlabs',
  voice: Voices.Rachel,
  text: 'Hello world',
  format: 'mp3',
};

describe('ttsCacheKey', () => {
  test('produces a 32-char lowercase hex string', async () => {
    const key = await ttsCacheKey(baseInput);
    expect(key).toMatch(/^[0-9a-f]{32}$/);
  });

  test('same input → same key', async () => {
    const a = await ttsCacheKey(baseInput);
    const b = await ttsCacheKey(baseInput);
    expect(a).toBe(b);
  });

  test('field ordering does not matter (canonicalised)', async () => {
    const a = await ttsCacheKey({
      providerId: 'p',
      voice: Voices.David,
      text: 't',
      format: 'mp3',
    });
    const b = await ttsCacheKey({
      format: 'mp3',
      text: 't',
      voice: Voices.David,
      providerId: 'p',
    });
    expect(a).toBe(b);
  });

  test('different text → different key', async () => {
    const a = await ttsCacheKey(baseInput);
    const b = await ttsCacheKey({ ...baseInput, text: 'Goodbye world' });
    expect(a).not.toBe(b);
  });

  test('different providerId → different key (no cross-provider collisions)', async () => {
    const a = await ttsCacheKey(baseInput);
    const b = await ttsCacheKey({ ...baseInput, providerId: 'openai' });
    expect(a).not.toBe(b);
  });

  test('different voice variant → different key', async () => {
    const a = await ttsCacheKey({ ...baseInput, voice: Voices.Rachel });
    const b = await ttsCacheKey({ ...baseInput, voice: Voices.David });
    expect(a).not.toBe(b);
  });

  test('different format → different key', async () => {
    const a = await ttsCacheKey(baseInput);
    const b = await ttsCacheKey({ ...baseInput, format: 'wav' });
    expect(a).not.toBe(b);
  });

  test('renaming a Voice (same voiceId/model, different name) → different key', async () => {
    /**
     * Guarantees that operators relabelling a `Voices.*` constant invalidate
     * the existing object-store cache. Two inputs share `voiceId` + `model` + provider
     * but differ in the human-facing `name` — they MUST hash to different
     * keys so the rename can't serve stale audio.
     */
    const renamedDavid: Voice = {
      ...Voices.David,
      name: 'Sam',
    } as unknown as Voice;
    const a = await ttsCacheKey({ ...baseInput, voice: Voices.David });
    const b = await ttsCacheKey({ ...baseInput, voice: renamedDavid });
    expect(a).not.toBe(b);
  });
});
