import { describe, expect, test } from 'bun:test';
import { DEFAULT_TTS_VOICE } from '../../shared/tts-voice';
import type { TtsProvider } from '../ports/tts-provider';
import { InMemoryTtsProvider } from './in-memory-tts-provider';

function runTtsContract(factory: () => TtsProvider): void {
  test('synthesize returns bytes and contentType', async () => {
    const tts = factory();
    const out = await tts.synthesize({
      text: 'hello',
      voice: DEFAULT_TTS_VOICE,
      format: 'wav',
    });
    expect(out.bytes.byteLength).toBeGreaterThan(0);
    expect(out.contentType.length).toBeGreaterThan(0);
  });
}

describe('TtsProvider contract — in-memory', () => {
  runTtsContract(() => new InMemoryTtsProvider());
});
