import {
  type TtsProvider,
  type TtsSynthesizeInput,
  type TtsSynthesizeOutput,
} from '../ports/tts-provider';

/**
 * Test-only {@link TtsProvider}. Returns a deterministic, tiny audio blob whose
 * byte content depends on the input — different `text` produces different
 * bytes, so caching tests can assert "cached → identical bytes" without
 * mocking the entire wire format.
 *
 * Output for `format: 'wav'` is a valid 8-bit PCM mono RIFF WAVE container
 * with `text.length` samples of silence. For `format: 'mp3'` we emit a
 * deterministic byte sequence with a fake MP3 header — enough for tests to
 * assert content-type + body round-trip; do NOT pipe this into a real decoder.
 */
const SILENT_PCM_SAMPLE = 0x80;

function buildSilentWav(sampleCount: number): Uint8Array {
  const dataLen = Math.max(1, sampleCount);
  const totalLen = 44 + dataLen;
  const buf = new Uint8Array(totalLen);
  const dv = new DataView(buf.buffer);

  buf.set([0x52, 0x49, 0x46, 0x46], 0);
  dv.setUint32(4, totalLen - 8, true);
  buf.set([0x57, 0x41, 0x56, 0x45], 8);

  buf.set([0x66, 0x6d, 0x74, 0x20], 12);
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, 8000, true);
  dv.setUint32(28, 8000, true);
  dv.setUint16(32, 1, true);
  dv.setUint16(34, 8, true);

  buf.set([0x64, 0x61, 0x74, 0x61], 36);
  dv.setUint32(40, dataLen, true);

  for (let i = 0; i < dataLen; i++) {
    buf[44 + i] = SILENT_PCM_SAMPLE;
  }
  return buf;
}

function buildFakeMp3(text: string): Uint8Array {
  const bytes = new TextEncoder().encode(`__fake_mp3__:${text}`);
  const out = new Uint8Array(bytes.byteLength + 4);
  out.set([0xff, 0xfb, 0x90, 0x00], 0);
  out.set(bytes, 4);
  return out;
}

export type InMemoryTtsProviderOptions = {
  readonly id?: string;
  readonly defaultVoiceId?: string;
  readonly defaultModel?: string;
};

export class InMemoryTtsProvider implements TtsProvider {
  readonly id: string;
  readonly defaultVoiceId: string;
  readonly defaultModel: string;
  /** Number of times {@link synthesize} has been called — handy for cache tests. */
  callCount = 0;

  constructor(options: InMemoryTtsProviderOptions = {}) {
    this.id = options.id ?? 'in-memory';
    this.defaultVoiceId = options.defaultVoiceId ?? 'test-voice';
    this.defaultModel = options.defaultModel ?? 'test-model';
  }

  synthesize(input: TtsSynthesizeInput): Promise<TtsSynthesizeOutput> {
    this.callCount += 1;
    if (input.format === 'wav') {
      return Promise.resolve({
        bytes: buildSilentWav(input.text.length || 1),
        contentType: 'audio/wav',
      });
    }
    return Promise.resolve({
      bytes: buildFakeMp3(input.text),
      contentType: 'audio/mpeg',
    });
  }
}
