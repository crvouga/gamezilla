import { describe, expect, test } from 'bun:test';
import {
  nativeSsoCallbackUrl,
  oauthClientCallbackUrl,
} from '@pkgs/auth-inhouse-shared-ts/oauth-client-callback-url';

const SCHEME = 'myapp';

describe('oauthClientCallbackUrl', () => {
  test('https origin becomes same-origin /sso-callback', () => {
    expect(oauthClientCallbackUrl('https://www.app.example', SCHEME)).toBe(
      'https://www.app.example/sso-callback'
    );
  });

  test('http localhost origin becomes same-origin /sso-callback', () => {
    expect(oauthClientCallbackUrl('http://localhost:8081', SCHEME)).toBe(
      'http://localhost:8081/sso-callback'
    );
  });

  test('strips trailing slash on origin', () => {
    expect(oauthClientCallbackUrl('https://www.app.example/', SCHEME)).toBe(
      'https://www.app.example/sso-callback'
    );
  });

  test('the native callback sits under the deep-link scheme', () => {
    expect(nativeSsoCallbackUrl(SCHEME)).toBe('myapp://sso-callback');
  });

  test('undefined falls back to native scheme', () => {
    expect(oauthClientCallbackUrl(undefined, SCHEME)).toBe(
      nativeSsoCallbackUrl(SCHEME)
    );
  });

  test('empty and non-http origins fall back to native scheme', () => {
    const native = nativeSsoCallbackUrl(SCHEME);
    expect(oauthClientCallbackUrl('', SCHEME)).toBe(native);
    expect(oauthClientCallbackUrl('   ', SCHEME)).toBe(native);
    expect(oauthClientCallbackUrl('myapp://', SCHEME)).toBe(native);
  });
});
