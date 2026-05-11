import { describe, expect, test } from 'bun:test';
import { ttsCacheKey, type TtsCacheKeyInput } from './tts-cache-key';

const baseInput: TtsCacheKeyInput = {
  providerId: 'elevenlabs',
  model: 'eleven_turbo_v2_5',
  voiceId: 'rachel',
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
      model: 'm',
      voiceId: 'v',
      text: 't',
      format: 'mp3',
    });
    const b = await ttsCacheKey({
      format: 'mp3',
      text: 't',
      voiceId: 'v',
      model: 'm',
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

  test('different voiceId → different key', async () => {
    const a = await ttsCacheKey(baseInput);
    const b = await ttsCacheKey({ ...baseInput, voiceId: 'adam' });
    expect(a).not.toBe(b);
  });

  test('different model → different key', async () => {
    const a = await ttsCacheKey(baseInput);
    const b = await ttsCacheKey({
      ...baseInput,
      model: 'eleven_multilingual_v2',
    });
    expect(a).not.toBe(b);
  });

  test('different format → different key', async () => {
    const a = await ttsCacheKey(baseInput);
    const b = await ttsCacheKey({ ...baseInput, format: 'wav' });
    expect(a).not.toBe(b);
  });
});
