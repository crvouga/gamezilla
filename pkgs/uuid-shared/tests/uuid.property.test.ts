import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import { assertUuid, isUuid } from '@pkgs/uuid-shared/uuid';
import { createHarnessIds, createSeededCreateId } from '@pkgs/uuid-shared/seeded-create-id';
import { createUuidV7 } from '@pkgs/uuid-shared/uuid-v7';
import fc from 'fast-check';

const HEX = [...'0123456789abcdef'];
const hexOf = (length: number): fc.Arbitrary<string> =>
  fc
    .array(fc.constantFrom(...HEX), { minLength: length, maxLength: length })
    .map((chars) => chars.join(''));

/** RFC 9562 shape: version nibble 1–8, variant nibble 8–b. */
const arbUuid = fc
  .tuple(
    hexOf(8),
    hexOf(4),
    fc.constantFrom(...'12345678'),
    hexOf(3),
    fc.constantFrom(...'89ab'),
    hexOf(3),
    hexOf(12),
    fc.boolean()
  )
  .map(([a, b, version, c, variant, d, e, upper]) => {
    const id = `${a}-${b}-${version}${c}-${variant}${d}-${e}`;
    return upper ? id.toUpperCase() : id;
  });

/** Positions of the version and variant nibbles in the 36-char form. */
const VERSION_AT = 14;
const VARIANT_AT = 19;

const arbUnit = fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true });

/** A 48-bit epoch-millisecond timestamp. */
const arbMs = fc.integer({ min: 0, max: 2 ** 48 - 1 });

function throws(run: () => unknown): boolean {
  try {
    run();
    return false;
  } catch {
    return true;
  }
}

describe('isUuid / assertUuid', () => {
  test('accepts every RFC 9562-shaped id, either case', () => {
    assertProperty(
      'accepts every RFC 9562-shaped id, either case',
      fc.property(arbUuid, (id) => {
        expect(isUuid(id)).toBe(true);
        expect(throws(() => assertUuid(id, 'uuid'))).toBe(false);
      })
    );
  });

  test('one bad character anywhere is refused', () => {
    assertProperty(
      'one bad character anywhere is refused',
      fc.property(
        arbUuid,
        fc.nat({ max: 35 }),
        fc.constantFrom('g', 'z', '-', ' ', '_'),
        (id, at, bad) => {
          const mutated = `${id.slice(0, at)}${bad}${id.slice(at + 1)}`;
          expect(isUuid(mutated)).toBe(false);
          expect(throws(() => assertUuid(mutated, 'uuid'))).toBe(true);
        }
      )
    );
  });

  test('a version outside 1–8 or a variant outside 8–b is refused', () => {
    assertProperty(
      'a version outside 1–8 or a variant outside 8–b is refused',
      fc.property(
        arbUuid,
        fc.constantFrom(...'09abcdef'),
        fc.constantFrom(...'01234567cdef'),
        (id, version, variant) => {
          const at = (i: number, c: string, s: string): string =>
            `${s.slice(0, i)}${c}${s.slice(i + 1)}`;
          expect(isUuid(at(VERSION_AT, version, id))).toBe(false);
          expect(isUuid(at(VARIANT_AT, variant, id))).toBe(false);
        }
      )
    );
  });

  test('non-strings are refused', () => {
    assertProperty(
      'non-strings are refused',
      fc.property(
        fc.anything().filter((v) => typeof v !== 'string'),
        (value) => {
          expect(isUuid(value)).toBe(false);
          expect(throws(() => assertUuid(value, 'uuid'))).toBe(true);
        }
      )
    );
  });
});

describe('createSeededCreateId', () => {
  test('any [0, 1) stream mints a v4, RFC-variant, lower-case uuid', () => {
    assertProperty(
      'any [0, 1) stream mints a v4, RFC-variant, lower-case uuid',
      fc.property(fc.array(arbUnit, { minLength: 16, maxLength: 16 }), (xs) => {
        let i = 0;
        const id = createSeededCreateId(() => xs[i++ % xs.length] as number)();
        expect(isUuid(id)).toBe(true);
        expect(id).toBe(id.toLowerCase());
        expect(id[VERSION_AT]).toBe('4');
        expect('89ab').toContain(id[VARIANT_AT] as string);
        expect(i).toBe(16);
      })
    );
  });
});

describe('createHarnessIds', () => {
  test('same seed ⇒ same ids and random stream; ids never repeat', () => {
    assertProperty(
      'same seed ⇒ same ids and random stream; ids never repeat',
      fc.property(fc.string({ maxLength: 12 }), (seed) => {
        const a = createHarnessIds(seed);
        const b = createHarnessIds(seed);
        expect(a.seed).toBe(b.seed);
        const ids = Array.from({ length: 20 }, () => a.createId());
        expect(Array.from({ length: 20 }, () => b.createId())).toEqual(ids);
        expect(new Set(ids).size).toBe(ids.length);
        expect(a.random()).toBe(b.random());
      })
    );
  });

  test('createId and random are independent streams', () => {
    assertProperty(
      'createId and random are independent streams',
      fc.property(
        fc.string({ maxLength: 12 }),
        fc.nat({ max: 5 }),
        (seed, n) => {
          const a = createHarnessIds(seed);
          const b = createHarnessIds(seed);
          for (let i = 0; i < n; i += 1) a.random();
          expect(a.createId()).toBe(b.createId());
        }
      )
    );
  });
});

describe('createUuidV7', () => {
  test('mints a v7 uuid embedding the millisecond timestamp', () => {
    assertProperty(
      'mints a v7 uuid embedding the millisecond timestamp',
      fc.property(arbMs, arbUuid, (ms, entropy) => {
        const id = createUuidV7(ms, entropy);
        expect(isUuid(id)).toBe(true);
        expect(id).toBe(id.toLowerCase());
        expect(id[VERSION_AT]).toBe('7');
        const time = id.replaceAll('-', '').slice(0, 12);
        expect(Number.parseInt(time, 16)).toBe(ms);
      })
    );
  });

  test('carries the entropy uuid’s random bits over unchanged', () => {
    assertProperty(
      'carries the entropy uuid’s random bits over unchanged',
      fc.property(arbMs, arbUuid, (ms, entropy) => {
        const out = createUuidV7(ms, entropy).replaceAll('-', '');
        const src = entropy.toLowerCase().replaceAll('-', '');
        expect(out.slice(13, 16)).toBe(src.slice(13, 16));
        expect(out.slice(17)).toBe(src.slice(17));
        const variant = (Number.parseInt(src[16] as string, 16) & 0x3) | 0x8;
        expect(out[16]).toBe(variant.toString(16));
      })
    );
  });

  test('ids sort by timestamp for the same entropy', () => {
    assertProperty(
      'ids sort by timestamp for the same entropy',
      fc.property(arbMs, arbMs, arbUuid, (t1, t2, entropy) => {
        fc.pre(t1 !== t2);
        const [lo, hi] = t1 < t2 ? [t1, t2] : [t2, t1];
        expect(createUuidV7(lo, entropy) < createUuidV7(hi, entropy)).toBe(
          true
        );
      })
    );
  });

  test('fractional and negative times floor and clamp to 0', () => {
    assertProperty(
      'fractional and negative times floor and clamp to 0',
      fc.property(
        fc.double({ min: -1e6, max: 2 ** 47, noNaN: true }),
        arbUuid,
        (ms, entropy) => {
          expect(createUuidV7(ms, entropy)).toBe(
            createUuidV7(Math.max(0, Math.floor(ms)), entropy)
          );
        }
      )
    );
  });

  test('entropy that is not a uuid is refused', () => {
    assertProperty(
      'entropy that is not a uuid is refused',
      fc.property(
        arbMs,
        fc.string({ maxLength: 40 }).filter((s) => !isUuid(s)),
        (ms, entropy) => {
          expect(throws(() => createUuidV7(ms, entropy))).toBe(true);
        }
      )
    );
  });
});
