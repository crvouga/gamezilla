import { describe, expect, test } from 'bun:test';

import {
  parseSignInPending,
  SIGN_IN_RETURN_FALLBACK_HREF,
  sanitizeSignInReturnHref,
  signInReturnHrefFromPending,
} from './sign-in-pending';

describe('parseSignInPending', () => {
  test('parses legacy bare ISO', () => {
    const pending = parseSignInPending(new Date().toISOString());
    expect(pending).not.toBeNull();
    expect(pending?.returnHref).toBeUndefined();
  });

  test('ignores legacy multi-account fields', () => {
    const pending = parseSignInPending(
      JSON.stringify({
        startedAt: new Date().toISOString(),
        intent: 'addAccount',
        baselineSessionIds: ['sess_a', 'sess_b'],
      })
    );
    expect(pending).not.toBeNull();
    expect(pending?.returnHref).toBeUndefined();
  });

  test('parses returnHref', () => {
    const pending = parseSignInPending(
      JSON.stringify({
        startedAt: new Date().toISOString(),
        returnHref: '/ui/Divider',
      })
    );
    expect(pending?.returnHref).toBe('/ui/Divider');
  });

  test('drops unsafe returnHref on parse', () => {
    const pending = parseSignInPending(
      JSON.stringify({
        startedAt: new Date().toISOString(),
        returnHref: 'https://evil.example/',
      })
    );
    expect(pending?.returnHref).toBeUndefined();
  });

  test('rejects stale markers', () => {
    const stale = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    expect(parseSignInPending(stale)).toBeNull();
  });
});

describe('sanitizeSignInReturnHref', () => {
  test('keeps relative app paths', () => {
    expect(sanitizeSignInReturnHref('/more/account')).toBe('/more/account');
    expect(sanitizeSignInReturnHref('/ui/Box?x=1')).toBe('/ui/Box?x=1');
  });

  test('rejects callback and absolute urls', () => {
    expect(sanitizeSignInReturnHref('/sso-callback')).toBeUndefined();
    expect(sanitizeSignInReturnHref('/sso-callback?n=1')).toBeUndefined();
    expect(sanitizeSignInReturnHref('https://evil.example/x')).toBeUndefined();
    expect(sanitizeSignInReturnHref('//evil.example/x')).toBeUndefined();
  });
});

describe('signInReturnHrefFromPending', () => {
  test('falls back when missing', () => {
    expect(signInReturnHrefFromPending(null)).toBe(
      SIGN_IN_RETURN_FALLBACK_HREF
    );
    expect(
      signInReturnHrefFromPending({
        startedAt: new Date(),
      })
    ).toBe(SIGN_IN_RETURN_FALLBACK_HREF);
  });

  test('uses stored returnHref', () => {
    expect(
      signInReturnHrefFromPending({
        startedAt: new Date(),
        returnHref: '/profile',
      })
    ).toBe('/profile');
  });
});
