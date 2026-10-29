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
});
