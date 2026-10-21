import type { AccessScope } from '@libs/permissions-shared-ts/decide-for-actor';
import { decideForActor } from '@libs/permissions-shared-ts/decide-for-actor';
import type { AppGrantKey } from '@libs/permissions-shared-ts/permission-catalog';
import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';

/**
 * The actor's decision for `key` on the server, outside a mutation (a route
 * or a gateway deciding before it admits a connection): the same synced rows
 * and policy the mutation replay reads, judged at the server's `nowMs`, plus
 * `scope`'s roles — e.g. their presence in the space the action targets.
 *
 * `actor` is who the request resolved to: the install, and the account when
 * a bearer resolved one (signed in, as the session guard judges it).
 */
export function decideOnServer(
  db: Pick<SqlClient, 'query'>,
  args: {
    readonly actor: {
      readonly deviceId: string;
      readonly accountId: string | null;
    };
    readonly key: AppGrantKey;
    readonly nowMs: number;
    readonly scope?: AccessScope;
  }
): Promise<Decision> {
  return decideForActor(db, {
    identity: {
      actorId: args.actor.deviceId,
      accountId: args.actor.accountId,
      isAnon: args.actor.accountId === null,
    },
    key: args.key,
    nowMs: args.nowMs,
    clientAtMs: args.nowMs,
    scope: args.scope,
  });
}
