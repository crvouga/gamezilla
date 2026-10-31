import { describe, expect, test } from 'bun:test';
import { formatCompactNumber } from '@pkgs/ui-root-client-ts/compact-number';

describe('formatCompactNumber', () => {
  test('below 1,000 a count is the plain number', () => {
    expect(formatCompactNumber(0, 'en')).toBe('0');
    expect(formatCompactNumber(7, 'en')).toBe('7');
    expect(formatCompactNumber(999, 'en')).toBe('999');
  });

  test('from 1,000 a count is compact with at most one decimal', () => {
    expect(formatCompactNumber(1000, 'en')).toBe('1K');
    expect(formatCompactNumber(1250, 'en')).toBe('1.3K');
    expect(formatCompactNumber(12_400, 'en')).toBe('12.4K');
    expect(formatCompactNumber(124_000, 'en')).toBe('124K');
    expect(formatCompactNumber(1_250_000, 'en')).toBe('1.3M');
    expect(formatCompactNumber(-12_400, 'en')).toBe('-12.4K');
  });

  test('rounding up to the next unit moves to that unit', () => {
    expect(formatCompactNumber(999_999, 'en')).toBe('1M');
  });

  test('each locale writes its own short form', () => {
    expect(formatCompactNumber(12_400, 'ja')).toBe('1.2万');
    expect(formatCompactNumber(1_250_000, 'es')).toBe('1,3 M');
  });

  test('an invalid locale tag falls back to English instead of throwing', () => {
    expect(formatCompactNumber(12_400, 'not a locale!')).toBe('12.4K');
  });
});
