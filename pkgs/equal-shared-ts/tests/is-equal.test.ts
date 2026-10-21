import { describe, expect, test } from 'bun:test';
import { isEqual } from '@pkgs/equal-shared-ts/is-equal';

describe('isEqual', () => {
  describe('primitives', () => {
    test('Object.is semantics for number', () => {
      expect(isEqual(NaN, NaN)).toBe(true);
      expect(isEqual(0, -0)).toBe(false);
    });

    test('bigint', () => {
      expect(isEqual(1n, 1n)).toBe(true);
      expect(isEqual(1n, 2n)).toBe(false);
    });

    test('symbol', () => {
      const s = Symbol('x');
      expect(isEqual(s, s)).toBe(true);
      expect(isEqual(Symbol('x'), Symbol('x'))).toBe(false);
    });
  });

  describe('null and undefined', () => {
    test('self-equality', () => {
      expect(isEqual(null, null)).toBe(true);
      expect(isEqual(undefined, undefined)).toBe(true);
    });

    test('null vs undefined', () => {
      expect(isEqual(null, undefined)).toBe(false);
    });

    test('mixed with objects', () => {
      expect(isEqual(null, {})).toBe(false);
      expect(isEqual(undefined, {})).toBe(false);
    });
  });

  describe('arrays', () => {
    test('sparse length still matches explicit undefined elements', () => {
      const sparse: unknown[] = [];
      sparse[1] = 1;
      // Both have length 2; index 0 reads as undefined in both cases.
      expect(isEqual(sparse, [undefined, 1])).toBe(true);
    });

    test('sparse shorter than dense', () => {
      const sparse: unknown[] = [];
      sparse[2] = 1;
      expect(isEqual(sparse, [undefined, undefined, 1])).toBe(true);
      expect(isEqual(sparse, [1])).toBe(false);
    });
  });

  describe('plain objects', () => {
    test('missing key vs undefined value', () => {
      expect(isEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    });

    test('null prototype object', () => {
      const a = Object.create(null);
      a.k = 1;
      const b = Object.create(null);
      b.k = 1;
      expect(isEqual(a, b)).toBe(true);
    });

    test('object vs array', () => {
      expect(isEqual({ 0: 1, length: 1 } as Record<string, unknown>, [1])).toBe(
        false
      );
    });
  });

  describe('Date', () => {
    test('same instant', () => {
      const d = new Date('2020-01-01T00:00:00.000Z');
      expect(isEqual(d, new Date(d.getTime()))).toBe(true);
    });

    test('different instants', () => {
      expect(isEqual(new Date('2020-01-01'), new Date('2021-01-01'))).toBe(
        false
      );
    });

    test('Date vs object', () => {
      expect(isEqual(new Date(0), { getTime: () => 0 })).toBe(false);
    });
  });

  describe('RegExp', () => {
    test('same pattern and flags', () => {
      expect(isEqual(/a/g, /a/g)).toBe(true);
    });

    test('different source or flags', () => {
      expect(isEqual(/a/, /b/)).toBe(false);
      expect(isEqual(/a/, /a/g)).toBe(false);
    });
  });

  describe('Map', () => {
    test('different size', () => {
      expect(isEqual(new Map([['a', 1]]), new Map())).toBe(false);
    });

    test('nested values', () => {
      expect(
        isEqual(new Map([['k', { a: 1 }]]), new Map([['k', { a: 1 }]]))
      ).toBe(true);
    });
  });

  describe('Set', () => {
    test('different size', () => {
      expect(isEqual(new Set([1]), new Set([1, 2]))).toBe(false);
    });

    test('object elements', () => {
      const o = { x: 1 };
      expect(isEqual(new Set([o]), new Set([{ x: 1 }]))).toBe(true);
    });
  });

  describe('circular references', () => {
    test('self-referential objects match', () => {
      type Node = { self?: Node };
      const a: Node = {};
      a.self = a;
      const b: Node = {};
      b.self = b;
      expect(isEqual(a, b)).toBe(true);
    });

    test('mutual recursion (isomorphic key names)', () => {
      const a: { ref?: unknown } = {};
      const b = { ref: a };
      a.ref = b;
      const c: { ref?: unknown } = {};
      const d = { ref: c };
      c.ref = d;
      expect(isEqual(a, c)).toBe(true);
    });
  });

  describe('non-plain objects', () => {
    test('Error instances are not deeply compared as plain objects', () => {
      expect(isEqual(new Error('x'), new Error('x'))).toBe(false);
    });

    test('boxed Number', () => {
      expect(isEqual(Object(1), 1)).toBe(false);
    });
  });
});
