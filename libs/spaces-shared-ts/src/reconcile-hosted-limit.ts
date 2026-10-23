import { decideLimitForActor } from '@libs/permissions-shared-ts/decide-for-actor';
import { LIMIT } from '@libs/permissions-shared-ts/permission-catalog';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type {
  MutationDb,
  MutationEnv,
} from '@pkgs/sync-engine-shared-ts/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { endSpace } from './space-mutation-helpers';

type LiveHosted = { readonly id: string; readonly created_at: string };

/**
 * A free account hosts one live space. When this create is the earlier of
 * two that were made apart, it stays and the later ones end. A later create
 * is refused and leaves the spaces already hosted untouched.
 */
export async function reconcileHostedLimit(
  tx: MutationDb,
  env: MutationEnv,
  args: {
    readonly spaceId: string;
    readonly memberId: string;
    readonly now: string;
  }
): Promise<'ok' | 'collapsed'> {
  const others = await tx.query<LiveHosted>(sql`
    SELECT id, created_at
    FROM spaces
    WHERE ended_at IS NULL
      AND deleted_at IS NULL
      AND (host_member_id = ${args.memberId} OR host_account_id = ${args.memberId})
      AND id <> ${args.spaceId}
    ORDER BY created_at ASC
  `);
  const nowMs = (env.serverNow ?? env.now)().getTime();
  const decision = await decideLimitForActor(tx, {
    identity: env,
    limit: LIMIT.hostedSpaces,
    used: others.length,
    nowMs,
    clientAtMs: Math.min(env.now().getTime(), nowMs),
  });
  if (decision.allowed) return 'ok';
  const earliest = others[0];
  if (earliest !== undefined && args.now < earliest.created_at) {
    for (const other of others) await endSpace(tx, env, other.id);
    return 'collapsed';
  }
  throw new MutationError(
    decision.reason ?? 'limit_reached',
    `Limit reached: ${LIMIT.hostedSpaces}`,
    { decision }
  );
}
