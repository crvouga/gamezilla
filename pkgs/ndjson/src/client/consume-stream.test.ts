import { describe, expect, test } from 'bun:test';
import { encodeNdjsonFrame } from '../shared/encode';
import type { NdjsonFrame } from '../shared/frames';
import { collectIndexedNdjsonStream, IndexedNdjsonStreamError } from './index';

function streamFrames<T>(frames: NdjsonFrame<T>[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const f of frames) {
        controller.enqueue(enc.encode(encodeNdjsonFrame(f)));
      }
      controller.close();
    },
  });
}

describe('collectIndexedNdjsonStream', () => {
  test('returns ordered results for a happy-path stream', async () => {
    const body = streamFrames<string>([
      { frame: 'result', index: 1, result: 'b' },
      { frame: 'result', index: 0, result: 'a' },
      { frame: 'end' },
    ]);
    const out = await collectIndexedNdjsonStream<string>(body, 2);
    expect(out).toEqual(['a', 'b']);
  });

  test('throws IndexedNdjsonStreamError on per-item failure', async () => {
    const body = streamFrames<string>([
      { frame: 'result', index: 0, result: 'ok' },
      {
        frame: 'error',
        index: 1,
        status: 403,
        message: 'forbidden',
        kind: 'forbidden',
      },
      { frame: 'end' },
    ]);
    await expect(collectIndexedNdjsonStream<string>(body, 2)).rejects.toThrow(
      IndexedNdjsonStreamError
    );
  });

  test('rejects when the producer truncates without an end frame', async () => {
    const body = streamFrames<string>([
      { frame: 'result', index: 0, result: 'a' },
    ]);
    await expect(collectIndexedNdjsonStream<string>(body, 1)).rejects.toThrow(
      /truncated transport/
    );
  });
});
