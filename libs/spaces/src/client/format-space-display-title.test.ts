import { describe, expect, test } from 'bun:test';

import { formatSpaceDisplayTitle } from './format-space-display-title';

function mockT(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.reduce(
    (acc, part, i) => acc + part + (i < values.length ? String(values[i]) : ''),
    ''
  );
}

describe('formatSpaceDisplayTitle', () => {
  test('prefers custom title', () => {
    expect(
      formatSpaceDisplayTitle('Party', 'alice', 'space-abcdefgh', mockT)
    ).toBe('Party');
  });

  test('uses host possessive when no custom title', () => {
    expect(
      formatSpaceDisplayTitle(null, 'alice', 'space-abcdefgh', mockT)
    ).toBe("alice's space");
  });

  test('never renders empty possessive', () => {
    expect(formatSpaceDisplayTitle(null, '', 'space-abcdefgh', mockT)).toBe(
      'Space abcdefgh'
    );
    expect(formatSpaceDisplayTitle(null, null, 'space-abcdefgh', mockT)).toBe(
      'Space abcdefgh'
    );
  });
});
