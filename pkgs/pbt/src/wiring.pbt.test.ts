import { describe, expect, test } from 'bun:test';

import { assertProperty, fc } from './index';

describe('@pkgs/pbt wiring', () => {
  test('addition is associative (smoke)', () => {
    assertProperty(
      'addition is associative',
      fc.property(
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: -1000, max: 1000 }),
        (a, b, c) => a + (b + c) === a + b + c
      )
    );
  });

  test('examples pin runs first', () => {
    const seen: number[] = [];
    assertProperty(
      'examples run first',
      fc.property(fc.nat({ max: 5 }), (n) => {
        seen.push(n);
        return n >= 0;
      }),
      { examples: [[0], [1]], numRuns: 3 }
    );
    expect(seen[0]).toBe(0);
    expect(seen[1]).toBe(1);
  });
});
