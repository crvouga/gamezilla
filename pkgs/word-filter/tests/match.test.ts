import { describe, expect, test } from 'bun:test';

import { containsBlockedTerm, normalizeForMatch } from '@pkgs/word-filter';

describe('normalizeForMatch', () => {
  test('folds case, leetspeak, separators and repeated letters', () => {
    expect(normalizeForMatch('F.U_C-k')).toBe('fuck');
    expect(normalizeForMatch('fuuuck')).toBe('fuck');
    expect(normalizeForMatch('5h1t')).toBe('shit');
    expect(normalizeForMatch('@$$')).toBe('ass');
  });
});

describe('containsBlockedTerm', () => {
  test('refuses plain and disguised slurs', () => {
    expect(containsBlockedTerm('fuck')).toBe(true);
    expect(containsBlockedTerm('FuCk3r')).toBe(true);
    expect(containsBlockedTerm('n1gga')).toBe(true);
    expect(containsBlockedTerm('f u c k')).toBe(true);
  });

  test('accepts ordinary usernames', () => {
    expect(containsBlockedTerm('BraveTiger482')).toBe(false);
    expect(containsBlockedTerm('alice')).toBe(false);
    expect(containsBlockedTerm('')).toBe(false);
  });
});
