import type { Scheduler } from '@pkgs/dst';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { reconcileOptimisticPeerMarkers } from '../client/optimistic-peer-rows';
import type { SimClientHandle } from './client-factory';
import type { SimDomainPack } from './domain-pack';
import { RELIABLE_FAULTS } from './faults';
import {
  checkPostConvergeInvariants,
  type InvariantViolation,
  isClosedDatabaseError,
  isDbOpen,
} from './invariants';
import type { NetEffectRegistry } from './net-effect';

import type { SyncNetwork } from './network';
import type { SimServer } from './server';

export type AssertConvergedCtx = {
  readonly network: SyncNetwork;
  readonly scheduler: Scheduler;
  readonly clients: ReadonlyMap<string, SimClientHandle>;
  readonly server: SimServer;
  readonly seed: bigint;
  readonly domain: SimDomainPack;
  readonly netEffects: NetEffectRegistry;
  readonly now: () => number;
  /** Restore server/broker after chaos commands before settle. */
  readonly healInfra?: () => Promise<void>;
  /** Drop armed one-shot boundary faults before heal/settle. */
  readonly clearBoundaryFaults?: () => void;
};

async function openClientSnapshots(
  clients: ReadonlyMap<string, SimClientHandle>
): Promise<readonly { readonly label: string; readonly db: SqlClient }[]> {
  const out: { label: string; db: SqlClient }[] = [];
  for (const c of clients.values()) {
    // Auth revoke / wipe closes the handle; seq checks already skip these.
    if (await isDbOpen(c.db)) out.push({ label: c.id, db: c.db });
  }
  return out;
}

function nudgeClients(clients: ReadonlyMap<string, SimClientHandle>): void {
  for (const client of clients.values()) {
    client.engine.wakeUploads();
    void client.engine.refreshQueries().catch(() => {
      // revoke / disconnect paths may reject refresh
    });
  }
}

async function checkDomainConverged(
  ctx: AssertConvergedCtx
): Promise<InvariantViolation | null> {
  try {
    return await ctx.domain.checkAllConverged({
      clients: await openClientSnapshots(ctx.clients),
      serverDb: ctx.server.db,
    });
  } catch (error) {
    if (isClosedDatabaseError(error)) {
      return {
        invariant: 'convergence',
        detail: 'closed database during domain check',
      };
    }
    throw error;
  }
}

async function drainScheduler(ctx: AssertConvergedCtx): Promise<void> {
  for (let i = 0; i < 8; i += 1) {
    if (ctx.scheduler.pendingTaskCount() === 0) return;
    await ctx.scheduler.runFor(250);
  }
}

async function settleOnce(
  ctx: AssertConvergedCtx
): Promise<InvariantViolation | null> {
  nudgeClients(ctx.clients);
  await drainScheduler(ctx);
  let domain = await checkDomainConverged(ctx);
  if (domain !== null) return domain;
  const nowIso = new Date(ctx.now()).toISOString();
  for (const client of ctx.clients.values()) {
    try {
      await client.db.transaction(async (tx) => {
        await reconcileOptimisticPeerMarkers(tx, nowIso);
      });
    } catch (error) {
      if (isClosedDatabaseError(error)) continue;
      throw error;
    }
  }
  domain = await checkDomainConverged(ctx);
  if (domain !== null) return domain;
  for (const client of ctx.clients.values()) {
    let post: InvariantViolation | null;
    try {
      post = await checkPostConvergeInvariants(client.db);
    } catch (error) {
      if (isClosedDatabaseError(error)) continue;
      throw error;
    }
    if (post !== null) {
      return {
        invariant: 'convergence',
        detail: `${post.invariant}: ${post.detail}`,
      };
    }
  }
  await drainScheduler(ctx);
  return checkDomainConverged(ctx);
}

/** Heal and settle until all clients match server domain (or throw). */
export async function assertConvergedImpl(
  ctx: AssertConvergedCtx
): Promise<void> {
  ctx.clearBoundaryFaults?.();
  ctx.network.releaseAll();
  ctx.network.healAll();
  ctx.network.clearNodeFaults();
  ctx.network.setDefaultFaults(RELIABLE_FAULTS);
  ctx.netEffects.neutralizeAll();
  if (ctx.healInfra !== undefined) {
    await ctx.healInfra();
  }
  for (const client of ctx.clients.values()) {
    client.lifecycle.setOnline(true);
    client.lifecycle.setForeground(true);
    await client.engine.connect();
  }
  let last: InvariantViolation | null = null;
  for (let i = 0; i < 60; i += 1) {
    last = await settleOnce(ctx);
    if (last === null) return;
  }
  throw new Error(
    `convergence failed seed=${ctx.seed.toString(16)} now=${ctx.now()} ${last?.detail ?? ''}`
  );
}
