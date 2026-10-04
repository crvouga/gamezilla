import type { NdjsonEndFrame, NdjsonErrorFrame, NdjsonFrame, NdjsonResultFrame } from '@pkgs/ndjson-shared/frames';
import { arbJsonObject, arbJsonValue } from '@pkgs/property-shared/json';
import fc from 'fast-check';

/** Indices in [-1, maxIndex]: -1 and maxIndex sit just outside a 0..maxIndex-1 batch. */
const arbIndex = (maxIndex: number): fc.Arbitrary<number> =>
  fc.integer({ min: -1, max: maxIndex });

export const arbNdjsonResultFrame = (
  maxIndex = 64
): fc.Arbitrary<NdjsonResultFrame> =>
  fc.record({
    frame: fc.constant('result' as const),
    index: arbIndex(maxIndex),
    result: arbJsonValue(2),
  });

export const arbNdjsonErrorFrame = (
  maxIndex = 64
): fc.Arbitrary<NdjsonErrorFrame> =>
  fc.record(
    {
      frame: fc.constant('error' as const),
      index: arbIndex(maxIndex),
      status: fc.integer({ min: 400, max: 599 }),
      message: fc.string({ unit: 'binary', maxLength: 40 }),
      kind: fc.stringMatching(/^[a-z]{1,8}$/),
      context: arbJsonObject(1) as fc.Arbitrary<Record<string, unknown>>,
    },
    { requiredKeys: ['frame', 'index', 'status', 'message'] }
  );

export const arbNdjsonEndFrame = (): fc.Arbitrary<NdjsonEndFrame> =>
  fc.constant({ frame: 'end' as const });

export const arbNdjsonFrame = (maxIndex = 64): fc.Arbitrary<NdjsonFrame> =>
  fc.oneof(
    arbNdjsonResultFrame(maxIndex),
    arbNdjsonErrorFrame(maxIndex),
    arbNdjsonEndFrame()
  );

/** Cut `bytes` at the given offsets (mod length) into consecutive chunks. */
export function splitBytes(bytes: Uint8Array, cuts: number[]): Uint8Array[] {
  const points = [
    0,
    ...cuts.map((c) => c % (bytes.byteLength + 1)).sort((a, b) => a - b),
    bytes.byteLength,
  ];
  const chunks: Uint8Array[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const start = points[i - 1] as number;
    const end = points[i] as number;
    if (end > start) chunks.push(bytes.subarray(start, end));
  }
  return chunks;
}

/** A byte stream that emits `chunks` in order, then closes. */
export function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}
