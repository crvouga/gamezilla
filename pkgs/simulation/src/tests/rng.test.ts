import { describe, expect, test } from 'bun:test';

import { createSeededRng } from '../rng';

describe('createSeededRng', () => {
  test('same seed yields the same stream', () => {
    const a = createSeededRng(7);
    const b = createSeededRng(7);
    expect([a.random(), a.random(), a.int(100)]).toEqual([
      b.random(),
      b.random(),
      b.int(100),
    ]);
  });

  test('fork is stable for a label', () => {
    const root = createSeededRng(99);
    const f1 = root.fork('alice');
    const f2 = createSeededRng(99).fork('alice');
    expect(f1.random()).toBe(f2.random());
  });
});
