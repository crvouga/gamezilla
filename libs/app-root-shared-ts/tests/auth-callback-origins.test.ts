import { expect, test } from 'bun:test';
import { createAuthProvider } from '@libs/app-root-shared-ts/auth-provider';
import {
  buildAuthTrustedOrigins,
  isTrustedCallbackUrl,
} from '@pkgs/auth-inhouse-shared-ts/trusted-origins';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { RecordSecretStore } from '@pkgs/secret-store-shared-ts/record-secret-store';

// regression: dev-apex-oauth-callback-rejected
test('auth composition trusts both configured web hosts, without trusting other environments', async () => {
  const captured = new Error('provider configuration captured');
  await expect(
    createAuthProvider({
      module: {
        provider: 'configuration-probe',
        create: async (env) => {
          const trusted = buildAuthTrustedOrigins({
            apiBaseURL: env.apiOrigin,
            clientWebOrigins: env.clientOrigins,
          });
          expect(
            isTrustedCallbackUrl(
              'https://dev.gamezilla.app/sso-callback',
              trusted
            )
          ).toBe(true);
          expect(
            isTrustedCallbackUrl(
              'https://www-dev.gamezilla.app/sso-callback',
              trusted
            )
          ).toBe(true);
          expect(
            isTrustedCallbackUrl(
              'https://attacker.gamezilla.app/sso-callback',
              trusted
            )
          ).toBe(false);
          throw captured;
        },
      },
      secretStore: new RecordSecretStore({
        WEB_CLIENT_ORIGIN: 'https://www-dev.gamezilla.app',
        WEB_CLIENT_APEX_ORIGIN: 'https://dev.gamezilla.app',
      }),
      apiUrlOverride: 'https://api-dev.gamezilla.app',
      protection: 'standard',
      clock: createHarnessClock({ startMs: 0 }).clock,
      createId: () => 'unused',
      http: {
        fetch: async () => {
          throw new Error('unexpected HTTP');
        },
      },
      onUserChanged: async () => {},
    })
  ).rejects.toBe(captured);
});
