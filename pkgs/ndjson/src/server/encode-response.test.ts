import { describe, expect, test } from 'bun:test';
import { NdjsonStreamDecoder } from '../shared/decode';
import type { NdjsonErrorFrame, NdjsonFrame } from '../shared/frames';
import { encodeNdjsonReadableStream } from './encode-response';

async function* iterable<T>(
  frames: NdjsonFrame<T>[]
): AsyncIterable<NdjsonFrame<T>> {
  for (const f of frames) yield f;
}

async function* throwingIterable<T>(
  before: NdjsonFrame<T>[],
  error: Error
): AsyncIterable<NdjsonFrame<T>> {
  for (const f of before) yield f;
  throw error;
}

async function drain(
  stream: ReadableStream<Uint8Array>
): Promise<NdjsonFrame[]> {
  const decoder = new NdjsonStreamDecoder();
  const out: NdjsonFrame[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    const frames = decoder.push(value ?? new Uint8Array(0), done === true);
    out.push(...frames);
    if (done) break;
  }
  return out;
}

describe('encodeNdjsonReadableStream', () => {
  test('round-trips a happy stream through bytes and back', async () => {
    const stream = encodeNdjsonReadableStream(
      iterable<string>([
        { frame: 'result', index: 0, result: 'a' },
        { frame: 'result', index: 1, result: 'b' },
        { frame: 'end' },
      ])
    );
    const frames = await drain(stream);
    expect(frames).toHaveLength(3);
    expect(frames[2]).toEqual({ frame: 'end' });
  });

  test('emits a default tail error + end frame when the iterable throws', async () => {
    const stream = encodeNdjsonReadableStream(
      throwingIterable<string>(
        [{ frame: 'result', index: 0, result: 'a' }],
        new Error('hook bug')
      )
    );
    const frames = await drain(stream);
    expect(frames).toHaveLength(3);
    const tail = frames[1] as NdjsonErrorFrame;
    expect(tail.frame).toBe('error');
    expect(tail.index).toBe(-1);
    expect(tail.status).toBe(500);
    expect(tail.message).toBe('hook bug');
    expect(frames[2]).toEqual({ frame: 'end' });
  });

  test('honors mapTailError for domain-specific tail mapping', async () => {
    const stream = encodeNdjsonReadableStream(
      throwingIterable<string>([], new Error('crashed')),
      {
        mapTailError: (error) => ({
          frame: 'error',
          index: -1,
          status: 500,
          message: error instanceof Error ? error.message : String(error),
          kind: 'assertCrash',
          context: { surface: 'tail' },
        }),
      }
    );
    const frames = await drain(stream);
    const tail = frames[0] as NdjsonErrorFrame;
    expect(tail.kind).toBe('assertCrash');
    expect(tail.context).toEqual({ surface: 'tail' });
  });
});
