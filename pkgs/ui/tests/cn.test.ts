import { cn, cnStyle } from '@pkgs/ui';
import { describe, expect, test } from 'vitest';

describe('cn', () => {
  test('merges strings and sx objects, dedupes', () => {
    expect(cn('box', 'box', { p: 4 })).toBe('box p-4');
  });
  test('later sx entries win', () => {
    expect(cn({ p: 4 }, { p: 2 })).toBe('p-2');
  });
  test('falsy and nested arrays flatten', () => {
    expect(cn('a', false, null, undefined, ['b', [{ p: 1 }]])).toBe('a b p-1');
  });
  test('token colors map to utilities', () => {
    expect(cn({ background: 'surface' })).toBe('bg-surface');
  });
  test('underscore values skip classes, land in style', () => {
    expect(cn({ width: 'a_b' })).toBe('');
    expect(cnStyle({ width: 'a_b' })).toEqual({ width: 'a_b' });
  });
  test('transform compiles to class', () => {
    expect(cn({ transform: [{ translateX: 4 }] })).toBe(
      '[transform:translateX(4px)]'
    );
  });
});

describe('cnStyle', () => {
  test('returns undefined when everything maps', () => {
    expect(cnStyle({ p: 4 })).toBe(undefined);
  });
  test('returns undefined for empty', () => {
    expect(cnStyle(undefined)).toBe(undefined);
  });
});
