/**
 * Keep playground snapshot SQL dumps consistent across server + clients.
 */

import {
  clientNamespace,
  type PlaygroundSqlHandle,
} from '@apps/client/host/playground-provide';
import type { Io } from '@pkgs/io';
import { sql } from '@pkgs/sql';

type DrainLive = {
  readonly id: string;
  readonly syncEnginePool: {
    readonly peekReady: (
      databaseName: string
    ) => { readonly wakeUploads: () => void } | null;
  };
};

type DrainCtx = {
  readonly io: Io;
  readonly serverHandle: PlaygroundSqlHandle;
  readonly clientSqlByAddress: Map<string, PlaygroundSqlHandle>;
  readonly maps: {
    readonly lives: Map<string, DrainLive>;
  };
};

function advanceSimClock(io: Io, ms: number): void {
  const clock = io.clock as { advance?: (delta: number) => void };
  clock.advance?.(ms);
}

async function pendingMutationTotal(
  ctx: DrainCtx,
  clientIds: readonly string[]
): Promise<number> {
  let total = 0;
  for (const clientId of clientIds) {
    const handle = ctx.clientSqlByAddress.get(`client:${clientId}.db`);
    if (handle === undefined) continue;
    const rows = await handle.sqlClient.query(sql<{ c: number | string }>`
      SELECT COUNT(*) AS c FROM sync_engine_mutations
    `);
    total += Number(rows[0]?.c ?? 0);
  }
  return total;
}

function wakeAllUploads(ctx: DrainCtx): void {
  for (const live of ctx.maps.lives.values()) {
    const engine = live.syncEnginePool.peekReady(clientNamespace(live.id));
    engine?.wakeUploads();
  }
}

/**
 * Drain client mutation queues so server + client SQL dumps agree (otherwise
 * hydrate after load overwrites restored client usernames with a stale server).
 */
export async function awaitPlaygroundMutationDrain(
  ctx: DrainCtx,
  clientIds: readonly string[]
): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    wakeAllUploads(ctx);
    if ((await pendingMutationTotal(ctx, clientIds)) === 0) return;
    advanceSimClock(ctx.io, 25);
    await Promise.resolve();
  }
}

type ProfileSnapRow = {
  readonly id: string;
  readonly created_at: string | null;
  readonly updated_at: string | null;
  readonly deleted_at: string | null;
  readonly username: string | null;
  readonly avatar_config: string | null;
  readonly username_changed_at: string | null;
  readonly username_norm: string | null;
};

/**
 * Client dumps are what the UI showed when the snapshot was taken. Push those
 * profile rows onto the restored server so hydrate cannot regress usernames
 * from a stale server blob (common when save raced an in-flight upload).
 */
export async function reconcileServerProfilesFromClients(
  ctx: DrainCtx,
  clientIds: readonly string[]
): Promise<void> {
  for (const clientId of clientIds) {
    const handle = ctx.clientSqlByAddress.get(`client:${clientId}.db`);
    if (handle === undefined) continue;
    const rows = await handle.sqlClient.query(sql<ProfileSnapRow>`
      SELECT
        id,
        created_at,
        updated_at,
        deleted_at,
        username,
        avatar_config,
        username_changed_at,
        username_norm
      FROM profile
    `);
    for (const row of rows) {
      await ctx.serverHandle.sqlClient.run(sql`
        INSERT INTO profile (
          id,
          created_at,
          updated_at,
          deleted_at,
          username,
          avatar_config,
          username_changed_at,
          username_norm
        ) VALUES (
          ${row.id},
          ${row.created_at},
          ${row.updated_at},
          ${row.deleted_at},
          ${row.username},
          ${row.avatar_config},
          ${row.username_changed_at},
          ${row.username_norm}
        )
        ON CONFLICT (id) DO UPDATE SET
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at,
          username = excluded.username,
          avatar_config = excluded.avatar_config,
          username_changed_at = excluded.username_changed_at,
          username_norm = excluded.username_norm
      `);
    }
  }
}
