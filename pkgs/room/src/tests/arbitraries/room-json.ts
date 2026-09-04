import { arbJsonValue } from '@pkgs/dst/fast-check';
import type { Arbitrary } from 'fast-check';
import fc from 'fast-check';

/** Safe object keys — excludes `__proto__` (not a reliable own property in JS). */
const arbRoomJsonKey = (): fc.Arbitrary<string> =>
  fc.stringMatching(/^[a-z][a-z0-9]{0,6}$/);

export const arbRoomJson = (): Arbitrary<unknown> => arbJsonValue(3);

/** Two objects with identical key/value pairs but opposite insertion order. */
export const arbKeyOrderPair = (): Arbitrary<{
  a: Record<string, unknown>;
  b: Record<string, unknown>;
}> =>
  fc
    .dictionary(arbRoomJsonKey(), arbJsonValue(2), { minKeys: 2, maxKeys: 6 })
    .map((dict) => {
      const entries = Object.entries(dict);
      const a: Record<string, unknown> = {};
      const b: Record<string, unknown> = {};
      for (const [k, v] of entries) a[k] = v;
      for (const [k, v] of [...entries].reverse()) b[k] = v;
      return { a, b };
    });
