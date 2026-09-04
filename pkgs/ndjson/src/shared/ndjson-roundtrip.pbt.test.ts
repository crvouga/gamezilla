import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/dst/fast-check';
import fc from 'fast-check';
import { arbNdjsonFrame } from '../test/ndjson-frame-arbitraries';

import { NdjsonStreamDecoder } from './decode';
import { encodeNdjsonFrame } from './encode';
import type { NdjsonFrame } from './frames';

function splitBytes(bytes: Uint8Array, cuts: number[]): Uint8Array[] {
  const points = [
    0,
    ...cuts
      .map((c) => Math.abs(c) % Math.max(1, bytes.byteLength + 1))
      .sort((a, b) => a - b),
    bytes.byteLength,
  ];
  const chunks: Uint8Array[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const start = points[i - 1]!;
    const end = points[i]!;
    if (end > start) chunks.push(bytes.subarray(start, end));
  }
  return chunks.length > 0 ? chunks : [bytes];
}

describe('ndjson encode/decode properties', () => {
  test('encode → chunk splits → decode recovers frames', () => {
    assertProperty(
      'ndjson round-trip under chunk splits',
      fc.property(
        fc.array(arbNdjsonFrame(), { minLength: 0, maxLength: 5 }),
        fc.array(fc.nat({ max: 200 }), { maxLength: 6 }),
        (frames, cuts) => {
          const seq: NdjsonFrame[] = [
            ...(frames as NdjsonFrame[]),
            { frame: 'end' },
          ];
          const bytes = new TextEncoder().encode(
            seq.map((f) => encodeNdjsonFrame(f)).join('')
          );
          const decoder = new NdjsonStreamDecoder();
          const got: NdjsonFrame[] = [];
          const chunks = splitBytes(bytes, cuts);
          for (let i = 0; i < chunks.length; i += 1) {
            got.push(...decoder.push(chunks[i]!, i === chunks.length - 1));
          }
          expect(got).toEqual(seq);
        }
      )
    );
  });
});
