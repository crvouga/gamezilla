import type { Decision } from '@pkgs/permissions';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  type AccessScope,
  decideForActor,
} from '../../shared/decide-for-actor';
import type { AppGrantKey } from '../../shared/permission-catalog';

export type { AccessScope };

/**
 * The actor's decision for `key` on the server, outside a mutation (a route
 * or a gateway deciding before it admits a connection): the same synced rows
 * and policy the mutation replay reads, judged at the server's `nowMs`, plus
 * `scope`'s roles — e.g. their presence in the space the action targets.
 */
export function decideOnServer(
  db: Pick<SqlClient, 'query'>,
  args: {
    readonly identity: {
      readonly actorId: string;
      readonly accountId: string | null;
      readonly isAnon: boolean;
    };
    readonly key: AppGrantKey;
    readonly nowMs: number;
    readonly scope?: AccessScope;
  }
): Promise<Decision> {
  return decideForActor(db, {
    identity: args.identity,
    key: args.key,
    nowMs: args.nowMs,
    clientAtMs: args.nowMs,
    scope: args.scope,
  });
}
