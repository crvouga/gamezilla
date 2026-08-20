import { describe, expect, test } from 'bun:test';

import { createSimIds } from './seeded-create-id';

describe('createSimIds', () => {
  test('same seed yields the same id and random stream', () => {
    const a = createSimIds(7);
    const b = createSimIds(7);
    expect(a.createId()).toBe(b.createId());
    expect(a.random()).toBe(b.random());
    expect(a.seed).toBe(b.seed);
    expect(a.rng.fork('simulation').random()).toBe(
      b.rng.fork('simulation').random()
    );
  });

  test('random and createId use independent forks of the root seed', () => {
    const ids = createSimIds(7);
    const id = ids.createId();
    const r = ids.random();
    const again = createSimIds(7);
    expect(again.random()).toBe(r);
    expect(again.createId()).toBe(id);
  });
});
