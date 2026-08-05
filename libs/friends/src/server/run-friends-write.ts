import { mapAppAuthToRulesAuth } from '@libs/auth/shared/map-app-auth-to-rules-auth';
import type { AppAuth } from '@libs/auth/shared/auth-context';
import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import { messageForFailure } from '@pkgs/rules/core/messages';
import { isRulesReject } from '@pkgs/rules/core/rules-reject';
import type { Failure } from '@pkgs/rules/core/types';
import { FRIENDS_MESSAGES } from '@libs/friends/shared/rules/messages';
import type { Context } from 'hono';
import type { SqlClient } from '@pkgs/sql-client/interface';

export type FriendsWriteFailure = {
  readonly code: string;
  readonly message: string;
};

export type FriendsWriteOk<TOutput> = {
  readonly ok: true;
  readonly value: TOutput;
  readonly sql: SqlClient;
};

export type FriendsWriteOutcome<TOutput> =
  | FriendsWriteOk<TOutput>
  | { readonly ok: false; readonly failure: FriendsWriteFailure };

export function writeFailureStatus(
  code: string
): 400 | 401 | 403 | 404 | 409 | 429 {
  if (code === 'FRIENDS_NOT_SIGNED_IN') return 401;
  if (code === 'FRIENDS_BLOCKED' || code === 'FRIENDS_FORBIDDEN') return 403;
  if (code === 'FRIENDS_NOT_FOUND') return 404;
  if (code === 'FRIENDS_ALREADY_FRIENDS' || code === 'FRIENDS_REQUEST_EXISTS') {
    return 409;
  }
  if (code === 'FRIENDS_COOLDOWN') return 429;
  return 400;
}

function failureFromRules(failure: Failure): FriendsWriteFailure {
  return {
    code: failure.code,
    message: messageForFailure(failure, FRIENDS_MESSAGES),
  };
}

export function jsonWriteFailure(
  c: Context<ApiHonoEnv>,
  result: FriendsWriteFailure
): Response {
  return c.json(
    { error: result.message, code: result.code },
    writeFailureStatus(result.code)
  );
}

export async function runFriendsMutation<TOutput>(
  auth: AppAuth,
  sql: SqlClient,
  fn: (
    rulesAuth: ReturnType<typeof mapAppAuthToRulesAuth>,
    sql: SqlClient
  ) => Promise<TOutput>
): Promise<FriendsWriteOutcome<TOutput>> {
  const rulesAuth = mapAppAuthToRulesAuth(auth);
  try {
    const value = await fn(rulesAuth, sql);
    return { ok: true, value, sql };
  } catch (error) {
    if (isRulesReject(error) && error.failures[0] !== undefined) {
      return { ok: false, failure: failureFromRules(error.failures[0]) };
    }
    throw error;
  }
}
