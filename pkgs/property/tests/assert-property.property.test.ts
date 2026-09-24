import { describe, expect, test } from 'bun:test';
import { arbJsonValue, assertProperty, fc } from '@pkgs/property';

describe('assertProperty', () => {
  // The contract: pinned unless PBT_RANDOM=1 asks to explore (both are in
  // the turbo `test` env, so the verdict is still a function of the inputs).
  test('the pinned seed makes a run reproducible, PBT_RANDOM does not', () => {
    const seen: number[][] = [[], []];
    for (const run of seen) {
      assertProperty(
        'record',
        fc.property(fc.nat(), (n) => {
          run.push(n);
        })
      );
    }
    const pinned = process.env['PBT_RANDOM'] !== '1';
    expect(Bun.deepEquals(seen[0], seen[1])).toBe(pinned);
  });

  test('a failing property throws with its counterexample', () => {
    expect(() =>
      assertProperty(
        'fails',
        fc.property(fc.nat(), (n) => n < 5)
      )
    ).toThrow(/Counterexample/);
  });

  test('property: JSON arbitraries survive a JSON round-trip', () => {
    assertProperty(
      'json round-trip',
      fc.property(arbJsonValue(), (value) => {
        expect(JSON.parse(JSON.stringify(value))).toEqual(value);
      })
    );
  });
});
