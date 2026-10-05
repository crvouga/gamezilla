import { assert } from '@pkgs/assert-root-shared/singleton';
import type { AuthServerPort } from '@pkgs/auth-root-shared/auth-server-port';
import type { Clock } from '@pkgs/clock-shared/types';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import querySql from '@pkgs/sql-root-shared/sql';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import { AnonUserService } from './anon-user-service';
import type { AppAuthContext, AppClientContext } from './auth-context';
import { buildAppAuthContext } from './auth-context';
import { BearerAuthResolver } from './bearer-resolve';
import { assertDeviceId } from './device-id';

/** Header carrying the install-scoped device id on HTTP / WebSocket requests. */
export const ANON_ID_HEADER = 'x-anon-id';

const UNAUTH_CLIENT_CONTEXT: AppClientContext = {};

async function buildAnonAppAuthContext(
  sql: SqlClient,
  deviceId: string,
  time: { readonly clock: Clock; readonly createId: CreateId }
): Promise<AppAuthContext | null> {
  assertDeviceId(deviceId);
  const anonUsers = new AnonUserService(sql, time);
  const userId = await anonUsers.findUserIdByDeviceId(deviceId);
  if (userId === null) return null;
  const state = await anonUsers.readUserAnonState(userId);
  if (!state.exists || !state.isAnon) return null;
  return buildAppAuthContext({
    deviceId,
    accountId: userId,
    myId: userId,
    isAnon: state.isAnon,
  });
}

/**
 * Token-only request resolution. Session JWT in `Authorization: Bearer …` plus
 * {@link ANON_ID_HEADER} (install UUID) for `deviceId`; or anonymous
 * {@link AppAuthContext} when only `x-anon-id` is set and the device is bound
 * to a `users` row; or unauthenticated marker when neither applies.
 *
 * `sql` is passed per call because the client is request-scoped.
 */
export class SessionAuth {
  constructor(
    private readonly authServer: AuthServerPort,
    private readonly time: {
      readonly clock: Clock;
      readonly createId: CreateId;
    }
  ) {}

  async resolveAuthContext(
    sql: SqlClient,
    request: Request
  ): Promise<Readonly<Record<string, unknown>>> {
    const header = request.headers.get('Authorization');
    const anonRaw = request.headers.get(ANON_ID_HEADER)?.trim() ?? '';

    if (header === null || !header.startsWith('Bearer ')) {
      if (anonRaw.length > 0) {
        return (
          (await buildAnonAppAuthContext(sql, anonRaw, this.time)) ??
          UNAUTH_CLIENT_CONTEXT
        );
      }
      return UNAUTH_CLIENT_CONTEXT;
    }

    const token = header.slice('Bearer '.length).trim();
    assert.ok(token.length > 0, 'Bearer token must be non-empty');

    if (anonRaw.length === 0) {
      return UNAUTH_CLIENT_CONTEXT;
    }

    const ctx = await new BearerAuthResolver(
      sql,
      this.authServer,
      this.time
    ).buildAppAuthContext(token, anonRaw);
    if (ctx !== null) return ctx;
    if (
      request.method === 'POST' &&
      new URL(request.url).pathname.endsWith('/mutations')
    ) {
      assertDeviceId(anonRaw);
      const deleted = await sql.query(
        querySql<{
          id: string;
        }>`SELECT u.id FROM auth_account_devices d JOIN auth_users u ON u.id = d.user_id WHERE d.device_id = ${anonRaw} AND u.deleted_at IS NOT NULL LIMIT 1`
      );
      if (deleted.length > 0) return { accountDeleted: true };
    }
    // Invalid/expired bearer must not block a bound anon device — otherwise
    // stale IdP tokens poison sync and client_config (sign-in methods) never
    // hydrates (chicken/egg: cannot sign in without methods from config).
    return (
      (await buildAnonAppAuthContext(sql, anonRaw, this.time)) ??
      UNAUTH_CLIENT_CONTEXT
    );
  }
}
