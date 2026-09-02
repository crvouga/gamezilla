/**
 * Keep playground snapshot SQL dumps consistent across server + clients.
 */

import type { Client } from '@apps/client/product/create-client';
import type { Clock } from '@pkgs/clock';
import type { SimScheduler } from '@pkgs/determinism';
import { sql } from '@pkgs/sql';
import type { SimSqlHandle } from '@sim/console/sim/sim-sql';

type DrainCtx = {
  readonly clock: Clock;
  readonly scheduler: SimScheduler;
  readonly serverHandle: SimSqlHandle;
  readonly sim: { clientSql(id: string): SimSqlHandle | undefined };
  readonly clientSqlByAddress: Map<string, SimSqlHandle>;
  readonly maps: {
    readonly lives: {
      readonly get: (id: string) => Client | undefined;
      readonly values: () => IterableIterator<Client>;
    };
  };
};

function peekEngine(live: Client) {
  const ns = live.env.resolveDatabaseName({ userId: '' });
  return live.syncEnginePool.peekReady(ns);
}

async function pendingMutationTotal(
  ctx: DrainCtx,
  clientIds: readonly string[]
): Promise<number> {
  let total = 0;
  for (const clientId of clientIds) {
    const live = ctx.maps.lives.get(clientId);
    if (live === undefined) continue;
    const engine = peekEngine(live);
    if (engine === null) continue;
    total += await engine.pendingMutationCount();
  }
  return total;
}

function wakeAllUploads(ctx: DrainCtx): void {
  for (const live of ctx.maps.lives.values()) {
    peekEngine(live)?.wakeUploads();
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
    await ctx.scheduler.runFor(25);
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

function clientSqlHandle(
  ctx: DrainCtx,
  clientId: string
): SimSqlHandle | undefined {
  return ctx.clientSqlByAddress.get(clientId) ?? ctx.sim.clientSql(clientId);
}

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
    const handle = clientSqlHandle(ctx, clientId);
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
