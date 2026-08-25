import fc from 'fast-check';

import { arbJsonValue } from './json-value';

export type NdjsonResultLike = {
  readonly frame: 'result';
  readonly index: number;
  readonly result: unknown;
};

export type NdjsonErrorLike = {
  readonly frame: 'error';
  readonly index: number;
  readonly status: number;
  readonly message: string;
};

export type NdjsonEndLike = { readonly frame: 'end' };

export type NdjsonFrameLike =
  | NdjsonResultLike
  | NdjsonErrorLike
  | NdjsonEndLike;

export const arbNdjsonResultFrame = (): fc.Arbitrary<NdjsonResultLike> =>
  fc.record({
    frame: fc.constant('result' as const),
    index: fc.nat({ max: 64 }),
    result: arbJsonValue(2),
  });

export const arbNdjsonErrorFrame = (): fc.Arbitrary<NdjsonErrorLike> =>
  fc.record({
    frame: fc.constant('error' as const),
    index: fc.nat({ max: 64 }),
    status: fc.integer({ min: 400, max: 599 }),
    message: fc.string({ maxLength: 40 }),
  });

export const arbNdjsonEndFrame = (): fc.Arbitrary<NdjsonEndLike> =>
  fc.constant({ frame: 'end' as const });

export const arbNdjsonFrame = (): fc.Arbitrary<NdjsonFrameLike> =>
  fc.oneof(arbNdjsonResultFrame(), arbNdjsonErrorFrame(), arbNdjsonEndFrame());

/** Split `bytes` into 1..n contiguous chunks (covers partial SSE lines). */
export const arbChunkSplits = (byteLength: number): fc.Arbitrary<number[]> => {
  if (byteLength <= 0) return fc.constant([0]);
  return fc
    .array(fc.integer({ min: 1, max: Math.max(1, byteLength) }), {
      minLength: 0,
      maxLength: 8,
    })
    .map((cuts) => {
      const points = [
        0,
        ...cuts.map((c) => Math.min(byteLength, c)).sort((a, b) => a - b),
        byteLength,
      ];
      const sizes: number[] = [];
      for (let i = 1; i < points.length; i += 1) {
        const d = points[i]! - points[i - 1]!;
        if (d > 0) sizes.push(d);
      }
      return sizes.length > 0 ? sizes : [byteLength];
    });
};
