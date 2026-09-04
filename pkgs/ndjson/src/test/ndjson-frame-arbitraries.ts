import { arbJsonValue } from '@pkgs/dst/fast-check';
import fc from 'fast-check';

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
