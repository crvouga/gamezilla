import { describe, expect, it } from 'bun:test';
import { mergePlain } from './merge-plain';

describe('mergePlain', () => {
  it('returns empty object with no args', () => {
    expect(mergePlain()).toEqual({});
  });

  it('returns shallow copy of one object', () => {
    const a = { x: 1, y: 2 };
    const m = mergePlain(a);
    expect(m).toEqual(a);
    expect(m).not.toBe(a);
  });

  it('later parts overwrite earlier keys', () => {
    expect(
      mergePlain({ a: 1, b: 2 }, { b: 3 }, { c: 4 })
    ).toEqual({ a: 1, b: 3, c: 4 });
  });
});
