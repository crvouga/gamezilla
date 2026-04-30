import { describe, expect, it } from 'bun:test';
import { parseWhsecFromLine } from './listen-output-parser';

describe('parseWhsecFromLine', () => {
  it('parses the standard Ready line', () => {
    const line =
      '> Ready! You are using Stripe API Version [2020-08-27]. Your webhook signing secret is whsec_test123 (^C to quit)';
    expect(parseWhsecFromLine(line)).toBe('whsec_test123');
  });

  it('parses through ANSI color codes', () => {
    const line =
      '\u001b[32m>\u001b[0m Ready! Your webhook signing secret is \u001b[1mwhsec_ansi_ok\u001b[0m (^C to quit)';
    expect(parseWhsecFromLine(line)).toBe('whsec_ansi_ok');
  });

  it('returns null when no signing secret phrase', () => {
    expect(parseWhsecFromLine('listening on localhost')).toBeNull();
    expect(parseWhsecFromLine('')).toBeNull();
  });

  it('returns null for bare whsec without the phrase', () => {
    expect(parseWhsecFromLine('whsec_orphan_only')).toBeNull();
  });

  it('is case-insensitive on the phrase', () => {
    expect(
      parseWhsecFromLine('your WEBHOOK signing secret is whsec_mixedCase')
    ).toBe('whsec_mixedCase');
  });
});
