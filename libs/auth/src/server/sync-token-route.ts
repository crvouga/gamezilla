import { ANON_ID_HEADER } from '@libs/auth/server/session-middleware';
import { UnauthorizedError } from '@libs/auth/server/unauthorized-error';
import { appAuth } from '@libs/auth/shared/auth-context';
import { assert } from '@pkgs/assert';
import type { SecretStore } from '@pkgs/secret-store';
import { Hono } from 'hono';
import { SignJWT, importPKCS8 } from 'jose';

import type { AuthContext } from './types';
import type { ApiHonoEnv } from './api-hono-env';

export type SyncTokenRouteDeps = {
  readonly secretStore: SecretStore;
  readonly jwtPrivateKeySecret: string;
  readonly jwtKeyId: string;
  readonly powersyncAudienceSecret?: string | undefined;
};

const TOKEN_TTL_SECONDS = 300;
const JWT_ALG = 'RS256';

async function readPrivateKeyPem(
  secretStore: SecretStore,
  secretName: string
): Promise<string> {
  const raw = (await secretStore.getRequired(secretName)).readSecretValue();
  assert.nonEmptyString(raw, `${secretName} must be a non-empty PEM string`);
  return raw.trim();
}

async function readOptionalAudience(
  secretStore: SecretStore,
  secretName: string | undefined
): Promise<string | undefined> {
  if (secretName === undefined) return undefined;
  const raw = (await secretStore.getOptional(secretName))?.readSecretValue();
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function mintPowerSyncJwt(args: {
  readonly privateKeyPem: string;
  readonly keyId: string;
  readonly subject: string;
  readonly deviceId: string;
  readonly audience?: string | undefined;
}): Promise<string> {
  const key = await importPKCS8(args.privateKeyPem, JWT_ALG);
  const builder = new SignJWT({ device_id: args.deviceId })
    .setProtectedHeader({ alg: JWT_ALG, kid: args.keyId })
    .setSubject(args.subject)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`);
  if (args.audience !== undefined) {
    builder.setAudience(args.audience);
  }
  return builder.sign(key);
}

/**
 * Mints a short-lived PowerSync JWT for the current session.
 * Requires `x-anon-id`; uses account id when signed in, else device id.
 */
export function createSyncTokenRoute(deps: SyncTokenRouteDeps) {
  const {
    secretStore,
    jwtPrivateKeySecret,
    jwtKeyId,
    powersyncAudienceSecret,
  } = deps;

  return new Hono<ApiHonoEnv<AuthContext>>().post('/sync/token', async (c) => {
    const sqlClient = c.get('sqlClient');
    const sessionAuth = c.get('sessionAuth');
    const deviceHeader = c.req.header(ANON_ID_HEADER)?.trim() ?? '';
    // #region agent log
    const debugAuthHeader = c.req.header('Authorization') ?? '';
    const debugLog = async (
      message: string,
      data: Record<string, unknown>
    ): Promise<void> => {
      await fetch(
        'http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Debug-Session-Id': '11af44',
          },
          body: JSON.stringify({
            sessionId: '11af44',
            hypothesisId: 'F,G,H',
            location: 'sync-token-route.ts:/sync/token',
            message,
            data,
            timestamp: Date.now(),
          }),
        }
      ).catch(() => {});
    };
    // #endregion
    if (deviceHeader.length === 0) {
      // #region agent log
      await debugLog('401: missing x-anon-id', {
        hasBearer: debugAuthHeader.startsWith('Bearer '),
        bearerLen: debugAuthHeader.length,
      });
      // #endregion
      throw new UnauthorizedError('Missing x-anon-id for sync token');
    }

    const ctx = await sessionAuth.resolveAuthContext(sqlClient, c.req.raw);
    const auth = appAuth(ctx);
    if (auth === null || auth.deviceId !== deviceHeader) {
      // #region agent log
      await debugLog('401: invalid session for sync token', {
        hasBearer: debugAuthHeader.startsWith('Bearer '),
        bearerLen: debugAuthHeader.length,
        authNull: auth === null,
        authDeviceId: auth?.deviceId ?? null,
        authAccountId: auth?.accountId ?? null,
        deviceHeader,
      });
      // #endregion
      throw new UnauthorizedError('Invalid session for sync token');
    }
    // #region agent log
    await debugLog('token minted OK', {
      subject: auth.accountId ?? auth.deviceId,
      deviceHeader,
    });
    // #endregion

    const subject = auth.accountId ?? auth.deviceId;
    const [privateKeyPem, audience] = await Promise.all([
      readPrivateKeyPem(secretStore, jwtPrivateKeySecret),
      readOptionalAudience(secretStore, powersyncAudienceSecret),
    ]);
    const token = await mintPowerSyncJwt({
      privateKeyPem,
      keyId: jwtKeyId,
      subject,
      deviceId: auth.deviceId,
      audience,
    });
    const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
    return c.json({ token, expiresAt, subject }, 200);
  });
}
