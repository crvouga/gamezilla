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
    expect(formatSpaceDisplayTitle('Party', 'alice', mockT)).toBe('Party');
  });

  test('uses host possessive when no custom title', () => {
    expect(formatSpaceDisplayTitle(null, 'alice', mockT)).toBe("alice's space");
  });

  test('never embeds space ids when username is missing', () => {
    expect(formatSpaceDisplayTitle(null, '', mockT)).toBe('Space');
    expect(formatSpaceDisplayTitle(null, null, mockT)).toBe('Space');
  });
});
