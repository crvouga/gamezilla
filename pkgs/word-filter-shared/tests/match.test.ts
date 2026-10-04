import { describe, expect, test } from 'bun:test';

import {
  containsBlockedTerm,
  normalizeForMatch,
} from '@pkgs/word-filter-shared/match';

describe('normalizeForMatch', () => {
  test('folds case, leetspeak, accents and separators', () => {
    expect(normalizeForMatch('F.U_C-k')).toBe('fuck');
    expect(normalizeForMatch('5h1t')).toBe('shit');
    expect(normalizeForMatch('@$$')).toBe('ass');
    expect(normalizeForMatch('Fück')).toBe('fuck');
  });
});

describe('containsBlockedTerm', () => {
  // regression: word-filter-repeat-bypass — runs of 3+ collapsed to ONE
  // letter, so a doubled letter in the term (`gg`, `ss`) repeated past two
  // never matched, and a run of exactly two was never collapsed.
  test('refuses a term whose letters are repeated any number of times', () => {
    expect(containsBlockedTerm('faggggot')).toBe(true);
    expect(containsBlockedTerm('pusssy')).toBe(true);
    expect(containsBlockedTerm('fuuck')).toBe(true);
  });

  // regression: word-filter-accent-bypass — NFKC kept `ü` composed and then
  // dropped it as a separator, so `fück` read as `fck`.
  test('refuses a term disguised with accents', () => {
    expect(containsBlockedTerm('fück')).toBe(true);
  });

  test('a shorter letter run than the term stays clean', () => {
    expect(containsBlockedTerm('Nigeria')).toBe(false);
    expect(containsBlockedTerm('fagot')).toBe(false);
  });

  test('accepts ordinary usernames', () => {
    expect(containsBlockedTerm('BraveTiger482')).toBe(false);
    expect(containsBlockedTerm('alice')).toBe(false);
    expect(containsBlockedTerm('')).toBe(false);
  });
});
