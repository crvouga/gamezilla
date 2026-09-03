import { describe, expect, test } from 'bun:test';

import { createSeededRng } from '../../sim/rng';

describe('sim kernel', () => {
  test('rng same seed identical stream', () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    const seqA = Array.from({ length: 20 }, () => a.random());
    const seqB = Array.from({ length: 20 }, () => b.random());
    expect(seqA).toEqual(seqB);
  });

  test('rng different seeds diverge', () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);
    expect(a.random()).not.toBe(b.random());
  });

  test('fork is deterministic and independent', () => {
    const root = createSeededRng(99);
    const f1 = root.fork('net');
    const f2 = root.fork('net');
    expect(f1.random()).toBe(f2.random());
    const work = root.fork('work');
    expect(work.random()).not.toBe(f1.random());
  });
});
