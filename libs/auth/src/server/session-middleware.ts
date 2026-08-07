import {
  type AppAuthContext,
  type AppClientContext,
  appAuth,
  buildAppAuthContext,
} from '@libs/auth/shared/auth-context';
import { assertDeviceId } from '@libs/auth/shared/device-id';
import { assert } from '@pkgs/assert';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { findUserIdByDeviceId, readUserAnonState } from './anon-user-ensure';
import { buildAppAuthContextFromBearer } from './bearer-resolve';
import type { AuthContext } from './types';
import { UnauthorizedError } from './unauthorized-error';

export type { AuthContext } from './types';

/** Header carrying the install-scoped device id on HTTP / WebSocket requests. */
export const ANON_ID_HEADER = 'x-anon-id';

const UNAUTH_CLIENT_CONTEXT: AppClientContext = {};

export type SessionAuthDeps = {
  readonly authServer: AuthServerPort;
};

async function buildAnonAppAuthContext(
  sql: SqlClient,
  deviceId: string
): Promise<AppAuthContext | null> {
  assertDeviceId(deviceId);
  const userId = await findUserIdByDeviceId(sql, deviceId);
  if (userId === null) return null;
  const state = await readUserAnonState(sql, userId);
  if (!state.exists) return null;
  return buildAppAuthContext({
    deviceId,
    accountId: userId,
    myId: userId,
    isAnon: state.isAnon,
  });
}

export type SessionAuth = {
  resolveAuthContext(
    sql: SqlClient,
    request: Request
  ): Promise<Readonly<Record<string, unknown>>>;
  requireAuthContext(sql: SqlClient, request: Request): Promise<AuthContext>;
};

export function createSessionAuth(deps: SessionAuthDeps): SessionAuth {
  const { authServer } = deps;

  /**
   * Token-only request resolution. Session JWT in `Authorization: Bearer …` plus
   * {@link ANON_ID_HEADER} (install UUID) for `deviceId`; or anonymous
   * {@link AppAuthContext} when only `x-anon-id` is set and the device is bound
   * to a `users` row; or unauthenticated marker when neither applies.
   */
  async function resolveAuthContext(
    sql: SqlClient,
    request: Request
  ): Promise<Readonly<Record<string, unknown>>> {
    const header = request.headers.get('Authorization');
    const anonRaw = request.headers.get(ANON_ID_HEADER)?.trim() ?? '';

    if (header === null || !header.startsWith('Bearer ')) {
      if (anonRaw.length > 0) {
        return (
          (await buildAnonAppAuthContext(sql, anonRaw)) ?? UNAUTH_CLIENT_CONTEXT
        );
      }
      return UNAUTH_CLIENT_CONTEXT;
    }

    const token = header.slice('Bearer '.length).trim();
    assert.ok(token.length > 0, 'Bearer token must be non-empty');

    if (anonRaw.length === 0) {
      return UNAUTH_CLIENT_CONTEXT;
    }

    const ctx = await buildAppAuthContextFromBearer({
      sql,
      authServer,
      bearerToken: token,
      deviceId: anonRaw,
    });
    return ctx ?? UNAUTH_CLIENT_CONTEXT;
  }

  /**
   * Same as {@link resolveAuthContext} but throws 401 when there is no
   * valid session + device header.
   */
  async function requireAuthContext(
    sql: SqlClient,
    request: Request
  ): Promise<AuthContext> {
    const header = request.headers.get('Authorization');
    if (header === null || !header.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing bearer token');
    }
    const anonRaw = request.headers.get(ANON_ID_HEADER)?.trim() ?? '';
    if (anonRaw.length === 0) {
      throw new UnauthorizedError('Missing x-anon-id for device binding');
    }
    const ctx = await resolveAuthContext(sql, request);
    const auth = appAuth(ctx);
    if (auth === null || auth.accountId === null || auth.isAnon) {
      throw new UnauthorizedError('Invalid or expired session');
    }
    return ctx as AuthContext;
  }

  return { resolveAuthContext, requireAuthContext };
}
