import type { Topic } from '@pkgs/pubsub/interface';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { TableChangeBus } from '@pkgs/sync-engine/queries/client/table-change-bus';
import { bumpWriteEpoch } from '@pkgs/sync-engine/queries/client/write-epoch';
import type { MutationEnv, MutationRegistry } from '../mutations/core/types';
import type { MutationFanoutPayload } from '../shared/mutation-fanout-payload';
import type { QueryChannelsCtx } from '../shared/nudge-payload';

function roomSpaceId(topic: Topic): string | null {
  return topic.startsWith('room:') ? topic.slice('room:'.length) : null;
}

function userActorId(topic: Topic): string | null {
  return topic.startsWith('user:') ? topic.slice('user:'.length) : null;
}

/** Topic trust gates for untrusted MQTT mutation fanout. */
export function acceptFanoutOnTopic(args: {
  readonly topic: Topic;
  readonly payload: MutationFanoutPayload;
  readonly ctx: QueryChannelsCtx;
}): boolean {
  const { topic, payload, ctx } = args;
  const userId = userActorId(topic);
  if (userId !== null) return payload.actorId === userId;
  const spaceId = roomSpaceId(topic);
  if (spaceId === null || spaceId.length === 0) return false;
  if (payload.actorId.length === 0) return false;
  const memberships = ctx.membershipSpaceIds ?? [];
  return memberships.includes(spaceId);
}

async function alreadyApplied(
  db: SqlClient,
  mutationId: string
): Promise<boolean> {
  const peer = await db.query(sql<{ readonly id: string }>`
    SELECT id FROM _peer_applied WHERE id = ${mutationId} LIMIT 1
  `);
  if (peer.length > 0) return true;
  const own = await db.query(sql<{ readonly id: string }>`
    SELECT id FROM _mutations WHERE id = ${mutationId} LIMIT 1
  `);
  return own.length > 0;
}

function peerEnv(payload: MutationFanoutPayload): MutationEnv {
  return {
    actorId: payload.actorId,
    deviceId: payload.deviceId,
    accountId: payload.accountId,
    isAnon: payload.accountId === null,
    now: () => new Date(),
  };
}

export type PeerApplyMutationArgs = {
  readonly db: SqlClient;
  readonly bus: TableChangeBus;
  readonly registry: MutationRegistry;
  readonly topic: Topic;
  readonly payload: MutationFanoutPayload;
  readonly getChannelsCtx: () => QueryChannelsCtx;
};

/**
 * Apply a foreign mutation locally (no upload enqueue). Idempotent by
 * mutationId; trust-gated by topic. Keeps a rebase log until a later query
 * confirms server truth.
 */
export async function peerApplyMutation(
  args: PeerApplyMutationArgs
): Promise<boolean> {
  const { db, bus, registry, topic, payload, getChannelsCtx } = args;
  if (!acceptFanoutOnTopic({ topic, payload, ctx: getChannelsCtx() })) {
    return false;
  }
  const mutation = registry[payload.name];
  if (mutation === undefined) return false;
  if (await alreadyApplied(db, payload.mutationId)) return false;

  let parsed: unknown;
  try {
    parsed = mutation.args.parse(payload.args);
  } catch {
    return false;
  }

  const env = peerEnv(payload);
  try {
    await db.transaction(async (tx) => {
      const epoch = await bumpWriteEpoch(tx);
      await mutation.run({ tx, env }, parsed);
      const appliedAt = env.now().toISOString();
      await tx.run(sql`
        INSERT INTO _peer_applied (id, applied_at)
        VALUES (${payload.mutationId}, ${appliedAt})
        ON CONFLICT (id) DO NOTHING
      `);
      await tx.run(sql`
        INSERT INTO _peer_mutations (
          id, name, args, actor_id, device_id, account_id,
          client_id, seq, created_at, epoch, applied_at
        )
        VALUES (
          ${payload.mutationId},
          ${payload.name},
          ${JSON.stringify(parsed)},
          ${payload.actorId},
          ${payload.deviceId},
          ${payload.accountId},
          ${payload.clientId},
          ${payload.seq},
          ${payload.createdAt},
          ${epoch},
          ${appliedAt}
        )
        ON CONFLICT (id) DO NOTHING
      `);
      // Settle bump so the next query's basisEpoch > peer.epoch.
      await bumpWriteEpoch(tx);
    });
  } catch (error) {
    console.warn(
      `[sync] peer apply failed name=${payload.name} id=${payload.mutationId}`,
      error
    );
    return false;
  }
  bus.emit([...mutation.writes, '_peer_applied', '_peer_mutations']);
  return true;
}
