import { expect, test } from 'bun:test';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import { ReproducibleError } from '@pkgs/observability-root-shared-ts/reproducible-error';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const diagnostic = (value: unknown) =>
  new ReproducibleError('original failure', {}, { format: 'example.v1', value })
    .diagnostic;

test('a complete bounded batch of normalized controls fits the replay diagnostic', () => {
  const value = {
    inputs: Array.from({ length: 256 }, (_, index) => ({
      playerId: 'first',
      sequence: Number.MAX_SAFE_INTEGER - index,
      tick: Number.MAX_SAFE_INTEGER,
      value: { kind: 'advance', amount: 1 },
    })),
  };
  const encoded = JSON.stringify(value);
  expect(new TextEncoder().encode(encoded).byteLength).toBeGreaterThan(16_384);
  expect(diagnostic(value)[ATTR.APP_ERROR_REPRODUCTION]).toBe(encoded);
});

test('a replay captures values once and retains the original exception cause', () => {
  const cause = new Error('literal cause');
  const value = { seed: 'race', tick: 1, state: { distance: 4 } };
  const error = new ReproducibleError(
    'failed',
    { cause },
    { format: 'example.v1', value }
  );
  value.state.distance = 8;
  expect(error.cause).toBe(cause);
  expect(JSON.parse(error.diagnostic[ATTR.APP_ERROR_REPRODUCTION]!)).toEqual({
    seed: 'race',
    tick: 1,
    state: { distance: 4 },
  });
  expect(Object.isFrozen(error.diagnostic)).toBe(true);
  expect(JSON.stringify(error)).not.toContain('diagnostic');
  const shared = { input: 0 };
  expect(
    diagnostic({ first: shared, second: shared })[
      ATTR.APP_ERROR_REPRODUCTION_STATUS
    ]
  ).toBe('available');
});

test('unsupported values cannot be silently coerced into a different replay', () => {
  const cycle: { next?: unknown } = {};
  cycle.next = cycle;
  let reads = 0;
  const getter = Object.defineProperty({}, 'position', {
    enumerable: true,
    get: () => {
      reads += 1;
      return 4;
    },
  });
  const hole: unknown[] = [];
  hole.length = 1;
  for (const value of [
    undefined,
    Number.NaN,
    Infinity,
    -0,
    1n,
    new Date('2026-01-01'),
    new Map(),
    new Set(),
    cycle,
    getter,
    hole,
    { omitted: undefined },
  ]) {
    const result = diagnostic(value);
    expect(result[ATTR.APP_ERROR_REPRODUCTION_STATUS]).toBe('unsupported');
    expect(result[ATTR.APP_ERROR_REPRODUCTION]).toBeUndefined();
  }
  expect(reads).toBe(0);
});

test('sensitive fields and credential-bearing text omit the whole replay without damaging the exception', () => {
  for (const value of [
    { password: 'secret' },
    { nested: { access_token: 'secret' } },
    { note: 'Bearer literal-token' },
    { note: 'person@example.com' },
  ]) {
    const result = diagnostic(value);
    expect(result).toEqual({
      [ATTR.APP_ERROR_REPRODUCTION_STATUS]: 'redacted',
    });
  }
});

test('UTF8 size limits retain complete JSON or explicitly omit it', () => {
  assertProperty(
    'reproduction UTF8 budget',
    fc.property(fc.integer({ min: 0, max: 20_000 }), (count) => {
      const value = { position: '🦦'.repeat(count) };
      const encoded = JSON.stringify(value);
      const result = diagnostic(value);
      if (new TextEncoder().encode(encoded).byteLength <= 65_536) {
        expect(result[ATTR.APP_ERROR_REPRODUCTION_STATUS]).toBe('available');
        expect(result[ATTR.APP_ERROR_REPRODUCTION]).toBe(encoded);
      } else
        expect(result).toEqual({
          [ATTR.APP_ERROR_REPRODUCTION_STATUS]: 'too_large',
        });
    })
  );
});

test('bounded simulation-shaped values survive byte-for-byte without changing state', () => {
  assertProperty(
    'reproduction value round trip',
    fc.property(
      fc.array(
        fc.record({ x: fc.integer(), y: fc.integer(), held: fc.boolean() }),
        { maxLength: 12 }
      ),
      (positions) => {
        const value = { seed: 'race', tick: 17, positions };
        const result = diagnostic(value);
        expect(result[ATTR.APP_ERROR_REPRODUCTION_STATUS]).toBe('available');
        expect(JSON.parse(result[ATTR.APP_ERROR_REPRODUCTION]!)).toEqual(value);
      }
    )
  );
});
