import { arbJsonValue } from '@pkgs/pbt';
import type { Arbitrary } from 'fast-check';
import fc from 'fast-check';

export const arbRoomJson = (): Arbitrary<unknown> => arbJsonValue(3);

export const arbKeyOrderPair = (): Arbitrary<{
  a: Record<string, unknown>;
  b: Record<string, unknown>;
}> =>
  fc
    .array(
      fc.tuple(fc.stringMatching(/^[a-z][a-z0-9]{0,6}$/), arbJsonValue(2)),
      { minLength: 2, maxLength: 6 }
    )
    .map((entries) => {
      const a: Record<string, unknown> = {};
      const b: Record<string, unknown> = {};
      for (const [k, v] of entries) a[k] = v;
      for (const [k, v] of [...entries].reverse()) b[k] = v;
      return { a, b };
    });
