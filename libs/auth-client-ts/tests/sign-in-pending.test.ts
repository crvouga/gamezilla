import { describe, expect, test } from 'bun:test';
import {
  parseSignInPending,
  SIGN_IN_RETURN_FALLBACK_HREF,
  sanitizeSignInReturnHref,
  signInReturnHrefFromPending,
} from '@libs/auth-shared-ts/sign-in-pending-parse';
import { createHarnessAdapters } from '@pkgs/uuid-shared-ts/harness-adapters';

const adapters = createHarnessAdapters({ seed: 1 });

function isoNow(): string {
  return new Date(adapters.clock.now()).toISOString();
}

describe('parseSignInPending', () => {
  test('parses legacy bare ISO', () => {
    const pending = parseSignInPending(isoNow(), adapters.clock.now);
    expect(pending).not.toBeNull();
    expect(pending?.returnHref).toBeUndefined();
  });

  test('ignores legacy multi-account fields', () => {
    const pending = parseSignInPending(
      JSON.stringify({
        startedAt: isoNow(),
        intent: 'addAccount',
        baselineSessionIds: ['sess_a', 'sess_b'],
      }),
      adapters.clock.now
    );
    expect(pending).not.toBeNull();
    expect(pending?.returnHref).toBeUndefined();
  });

  test('parses returnHref', () => {
    const pending = parseSignInPending(
      JSON.stringify({
        startedAt: isoNow(),
        returnHref: '/more/theme',
      }),
      adapters.clock.now
    );
    expect(pending?.returnHref).toBe('/more/theme');
  });

  test('drops unsafe returnHref on parse', () => {
    const pending = parseSignInPending(
      JSON.stringify({
        startedAt: isoNow(),
        returnHref: 'https://evil.example/',
      }),
      adapters.clock.now
    );
    expect(pending?.returnHref).toBeUndefined();
  });

  test('rejects stale markers', () => {
    const stale = new Date(adapters.clock.now() - 31 * 60 * 1000).toISOString();
    expect(parseSignInPending(stale, adapters.clock.now)).toBeNull();
  });
});

describe('sanitizeSignInReturnHref', () => {
  test('keeps relative app paths', () => {
    expect(sanitizeSignInReturnHref('/more/account')).toBe('/more/account');
    expect(sanitizeSignInReturnHref('/more/theme?x=1')).toBe('/more/theme?x=1');
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
        startedAt: new Date(adapters.clock.now()),
      })
    ).toBe(SIGN_IN_RETURN_FALLBACK_HREF);
  });

  test('uses stored returnHref', () => {
    expect(
      signInReturnHrefFromPending({
        startedAt: new Date(adapters.clock.now()),
        returnHref: '/profile',
      })
    ).toBe('/profile');
  });
});
