import { describe, expect, test } from 'bun:test';

import { preserveEmptyTextLayout } from './preserve-empty-text-layout';

describe('preserveEmptyTextLayout', () => {
  test('replaces empty string with zero-width space', () => {
    expect(preserveEmptyTextLayout('')).toBe('\u200b');
  });

  test('replaces whitespace-only strings', () => {
    expect(preserveEmptyTextLayout('   ')).toBe('\u200b');
    expect(preserveEmptyTextLayout('\n')).toBe('\u200b');
    expect(preserveEmptyTextLayout(' \t ')).toBe('\u200b');
  });

  test('passes through non-empty strings', () => {
    expect(preserveEmptyTextLayout('hello')).toBe('hello');
    expect(preserveEmptyTextLayout(' a ')).toBe(' a ');
  });

  test('passes through null and undefined', () => {
    expect(preserveEmptyTextLayout(null)).toBe(null);
    expect(preserveEmptyTextLayout(undefined)).toBe(undefined);
  });

  test('passes through non-string ReactNode values', () => {
    expect(preserveEmptyTextLayout(0)).toBe(0);
    expect(preserveEmptyTextLayout(false)).toBe(false);
  });
});
