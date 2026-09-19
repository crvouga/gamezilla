import {
  type Decision,
  decideQuota,
  policyAt,
  quotaWindowOf,
  resolveSubject,
} from '@pkgs/permissions';
import { sql } from '@pkgs/sql';
import { unitsSince } from '../../../shared/ledger-time';
import {
  type AccessIdentity,
  type AccessReader,
  readAccessFacts,
  readPermissionPolicy,
} from '../../../shared/read-access';

type LedgerRow = { readonly amount: unknown; readonly consumed_at: unknown };

/**
 * Units of `quota` the owner consumed since `startMs` (live rows). Filtered
 * in code: synced timestamps are not uniformly formatted across engines, so
 * a SQL string comparison would miscount.
 */
async function usedSince(
  db: AccessReader,
  args: {
    readonly ownerId: string;
    readonly quota: string;
    readonly startMs: number;
  }
): Promise<number> {
  const rows = await db.query<LedgerRow>(sql<LedgerRow>`
    SELECT amount, consumed_at
    FROM permissions_quota_ledger
    WHERE owner_id = ${args.ownerId}
      AND quota = ${args.quota}
      AND deleted_at IS NULL
  `);
  return unitsSince(rows, args.startMs);
}

/**
 * The single quota evaluation run identically by the optimistic client, the
 * client's `remaining`/`can` reads and the server replay: policy version
 * active at `clientAtMs`, facts and consumed units read from synced rows,
 * window computed at `nowMs`. `amount: 0` asks "what is left right now".
 */
export async function evaluateQuota(
  db: AccessReader,
  args: {
    readonly identity: AccessIdentity;
    readonly quota: string;
    readonly nowMs: number;
    readonly clientAtMs: number;
    readonly amount: number;
  }
): Promise<Decision> {
  const policy = policyAt(await readPermissionPolicy(db), args.clientAtMs);
  const subject = resolveSubject(
    policy,
    await readAccessFacts(db, args.identity, args.nowMs)
  );
  const window = quotaWindowOf(policy, subject, args.quota, {
    nowMs: args.nowMs,
  });
  const used =
    window === undefined
      ? 0
      : await usedSince(db, {
          ownerId: args.identity.actorId,
          quota: args.quota,
          startMs: window.startMs,
        });
  return decideQuota(policy, subject, args.quota, {
    used,
    nowMs: args.nowMs,
    amount: args.amount,
  });
}
