import { describe, expect, test } from 'bun:test';
import {
  buildAuthTrustedOrigins,
  isTrustedCallbackUrl,
} from '@pkgs/auth-inhouse-shared-ts/trusted-origins';

describe('localhost OAuth callback origins', () => {
  test('allows a dynamically assigned stack web origin', () => {
    const trusted = buildAuthTrustedOrigins({
      apiBaseURL: 'http://127.0.0.1:50956',
      clientWebOrigins: ['http://127.0.0.1:50981'],
      clientSchemes: [],
    });

    expect(
      isTrustedCallbackUrl('http://127.0.0.1:50981/sso-callback', trusted)
    ).toBe(true);
  });

  // regression: localhost-oauth-callback-loopback-name — the stack planned
  // its web origin as `http://127.0.0.1:5400`, the browser showed it as
  // `http://localhost:5400`, and Continue with Google answered
  // `invalid_callback_url`.
  test('trusts a local web origin under every loopback name, on its own port only', () => {
    const trusted = buildAuthTrustedOrigins({
      apiBaseURL: 'http://127.0.0.1:39619',
      clientWebOrigins: ['http://127.0.0.1:5400'],
      clientSchemes: [],
    });
    for (const host of ['localhost', '127.0.0.1', '[::1]'])
      expect(
        isTrustedCallbackUrl(`http://${host}:5400/sso-callback`, trusted)
      ).toBe(true);
    expect(
      isTrustedCallbackUrl('http://localhost:5401/sso-callback', trusted)
    ).toBe(false);
    expect(
      isTrustedCallbackUrl('http://localhost.evil.test:5400/x', trusted)
    ).toBe(false);
  });

  test('a deployed web origin is trusted as itself alone', () => {
    const trusted = buildAuthTrustedOrigins({
      apiBaseURL: 'https://api-dev.example.test',
      clientWebOrigins: ['https://www-dev.example.test'],
      clientSchemes: [],
    });
    expect(trusted.filter((origin) => origin.includes('example.test'))).toEqual(
      ['https://api-dev.example.test', 'https://www-dev.example.test']
    );
    expect(
      isTrustedCallbackUrl('https://localhost/sso-callback', trusted)
    ).toBe(false);
  });
});
