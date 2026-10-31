import { describe, expect, test } from 'bun:test';
import { pkceS256Challenge } from '@pkgs/auth-inhouse-shared-ts/pkce';
import { hashAuthSecret } from '@pkgs/auth-inhouse-shared-ts/token-hash';
import {
  buildAuthTrustedOrigins,
  isTrustedCallbackUrl,
} from '@pkgs/auth-inhouse-shared-ts/trusted-origins';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

describe('auth shared PBT', () => {
  test('token hash is deterministic and secret-sensitive', async () => {
    await assertProperty(
      'hashAuthSecret',
      fc.property(
        fc.string({ minLength: 8, maxLength: 64 }),
        fc.string({ minLength: 1, maxLength: 64 }),
        fc.string({ minLength: 8, maxLength: 64 }),
        (secret, token, otherSecret) => {
          expect(hashAuthSecret(secret, token)).toBe(
            hashAuthSecret(secret, token)
          );
          if (secret !== otherSecret) {
            expect(hashAuthSecret(secret, token)).not.toBe(
              hashAuthSecret(otherSecret, token)
            );
          }
        }
      )
    );
  });

  test('pkce S256 is deterministic', async () => {
    await assertProperty(
      'pkceS256Challenge',
      fc.property(fc.string({ minLength: 1, maxLength: 128 }), (verifier) => {
        const a = pkceS256Challenge(verifier);
        const b = pkceS256Challenge(verifier);
        expect(a).toBe(b);
        expect(a.length).toBeGreaterThan(10);
        expect(a.includes('+')).toBe(false);
        expect(a.includes('/')).toBe(false);
      })
    );
  });

  test('trusted callback URLs', () => {
    const trusted = buildAuthTrustedOrigins({
      apiBaseURL: 'https://api.example.com',
      clientWebOrigins: ['https://app.example.com'],
      clientSchemes: ['myapp'],
    });
    expect(
      isTrustedCallbackUrl('https://app.example.com/sso-callback', trusted)
    ).toBe(true);
    expect(isTrustedCallbackUrl('myapp://sso-callback', trusted)).toBe(true);
    expect(isTrustedCallbackUrl('otherapp://sso-callback', trusted)).toBe(
      false
    );
    expect(
      isTrustedCallbackUrl('https://evil.example/sso-callback', trusted)
    ).toBe(false);
  });
});
