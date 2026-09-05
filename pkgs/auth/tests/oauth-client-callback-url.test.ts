import { describe, expect, test } from 'bun:test';
import {
  AUTH_NATIVE_SSO_CALLBACK_URL,
  oauthClientCallbackUrl,
} from '@pkgs/auth/shared';

describe('oauthClientCallbackUrl', () => {
  test('https origin becomes same-origin /sso-callback', () => {
    expect(oauthClientCallbackUrl('https://www.gamezilla.app')).toBe(
      'https://www.gamezilla.app/sso-callback'
    );
  });

  test('http localhost origin becomes same-origin /sso-callback', () => {
    expect(oauthClientCallbackUrl('http://localhost:8081')).toBe(
      'http://localhost:8081/sso-callback'
    );
  });

  test('strips trailing slash on origin', () => {
    expect(oauthClientCallbackUrl('https://www.gamezilla.app/')).toBe(
      'https://www.gamezilla.app/sso-callback'
    );
  });

  test('undefined falls back to native scheme', () => {
    expect(oauthClientCallbackUrl(undefined)).toBe(
      AUTH_NATIVE_SSO_CALLBACK_URL
    );
  });

  test('empty and non-http origins fall back to native scheme', () => {
    expect(oauthClientCallbackUrl('')).toBe(AUTH_NATIVE_SSO_CALLBACK_URL);
    expect(oauthClientCallbackUrl('   ')).toBe(AUTH_NATIVE_SSO_CALLBACK_URL);
    expect(oauthClientCallbackUrl('gamezilla://')).toBe(
      AUTH_NATIVE_SSO_CALLBACK_URL
    );
  });
});
