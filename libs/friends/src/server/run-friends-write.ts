import { mapAppAuthToWriteContext } from '@libs/auth/shared/map-app-auth-to-write-context';
import type { AppAuth } from '@libs/auth/shared/auth-context';
import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import type { Context } from 'hono';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { WriteDefinition } from '@pkgs/write/shared/define-write';
import { runWrite } from '@pkgs/write/shared/run-write';
import {
  isWriteFailure,
  unwrap,
  type WriteFailure,
} from '@pkgs/write/shared/write-result';

export type FriendsWriteOk<TOutput> = {
  readonly ok: true;
  readonly value: TOutput;
  readonly sql: SqlClient;
};

export type FriendsWriteOutcome<TOutput> =
  | FriendsWriteOk<TOutput>
  | { readonly ok: false; readonly failure: WriteFailure };

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

export function jsonWriteFailure(
  c: Context<ApiHonoEnv>,
  result: WriteFailure
): Response {
  return c.json(
    { error: result.message, code: result.code },
    writeFailureStatus(result.code)
  );
}

export async function runFriendsWrite<TInput, TOutput>(
  auth: AppAuth,
  sql: SqlClient,
  write: WriteDefinition<TInput, TOutput>,
  rawInput: unknown
): Promise<FriendsWriteOutcome<TOutput>> {
  const result = await runWrite({
    write,
    ctx: mapAppAuthToWriteContext(auth),
    rawInput,
    sql,
    mode: 'full',
  });
  if (isWriteFailure(result)) {
    return { ok: false, failure: result };
  }
  return { ok: true, value: unwrap(result), sql };
}
