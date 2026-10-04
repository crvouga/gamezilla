import type { Scheduler as VirtualScheduler } from '@pkgs/harness-shared/scheduler';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import { reconcileOptimisticPeerMarkers } from '@pkgs/sync-engine-client/optimistic-peer-rows';
import type { HarnessClient } from './client';
import type { HarnessDomainPack } from './harness-domain-pack';
import { RELIABLE_FAULTS } from './faults';
import { checkPostInSyncInvariants, isClosedDatabaseError, isDbOpen } from './invariants';
import type { InvariantViolation } from './invariant-tracker';
import type { NetEffectRegistry } from './net-effect';
import type { SyncNetwork } from './network';
import type { HarnessServer } from './server';

export type RecoverAllCtx = {
  readonly network: SyncNetwork;
  readonly clients: ReadonlyMap<string, HarnessClient>;
  readonly netEffects: NetEffectRegistry;
  /** Restore server/broker after chaos commands. */
  readonly restoreInfra?: () => Promise<void>;
  /** Drop armed one-shot boundary faults before restoreNetwork. */
  readonly clearEdgeFaults?: () => void;
};

export type DomainInSyncCtx = {
  readonly clients: ReadonlyMap<string, HarnessClient>;
  readonly server: HarnessServer;
  readonly domain: HarnessDomainPack;
};

export type DrainUntilConvergedCtx = {
  readonly scheduler: VirtualScheduler;
  readonly clients: ReadonlyMap<string, HarnessClient>;
  readonly server: HarnessServer;
  readonly seed: bigint;
  readonly domain: HarnessDomainPack;
  readonly now: () => number;
};

async function openClientSnapshots(
  clients: ReadonlyMap<string, HarnessClient>
): Promise<readonly { readonly label: string; readonly db: SqlClient }[]> {
  const out: { label: string; db: SqlClient }[] = [];
  for (const c of clients.values()) {
    if (await isDbOpen(c.db)) out.push({ label: c.id, db: c.db });
  }
  return out;
}

function nudgeClients(clients: ReadonlyMap<string, HarnessClient>): void {
  for (const client of clients.values()) {
    client.engine.wakeUploads();
    void client.engine.refreshQueries().catch(() => {
      // revoke / disconnect paths may reject refresh
    });
  }
}

/**
 * Heal network, neutralize faults, restore infra, force clients online/connected.
 * Stimulus only — no domain check, no reconcile (reconcile only after domain
 * agreement inside {@link drainUntilInSyncImpl}).
 */
export async function recoverAllImpl(ctx: RecoverAllCtx): Promise<void> {
  ctx.clearEdgeFaults?.();
  ctx.network.releaseAll();
  ctx.network.restoreAllNetwork();
  ctx.network.clearNodeFaults();
  ctx.network.setDefaultFaults(RELIABLE_FAULTS);
  ctx.netEffects.neutralizeAll();
  if (ctx.restoreInfra !== undefined) {
    await ctx.restoreInfra();
  }
  for (const client of ctx.clients.values()) {
    client.lifecycle.setOnline(true);
    client.lifecycle.setForeground(true);
    await client.engine.connect();
  }
}

/**
 * Pure domain agreement + post-restoreNetwork invariant reads. Never heals, never advances
 * time, never nudges — safe for observations.
 */
export async function checkDomainInSync(
  ctx: DomainInSyncCtx
): Promise<InvariantViolation | null> {
  let domain: InvariantViolation | null;
  try {
    domain = await ctx.domain.checkAllInSync({
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
  if (domain !== null) return domain;
  for (const client of ctx.clients.values()) {
    let post: InvariantViolation | null;
    try {
      post = await checkPostInSyncInvariants(client.db);
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
  return null;
}

async function checkDomainOnly(
  ctx: DrainUntilConvergedCtx
): Promise<InvariantViolation | null> {
  try {
    return await ctx.domain.checkAllInSync({
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

async function drainScheduler(ctx: DrainUntilConvergedCtx): Promise<void> {
  for (let i = 0; i < 8; i += 1) {
    if (ctx.scheduler.pendingTaskCount() === 0) return;
    await ctx.scheduler.runFor(250);
  }
}

/**
 * One settle round matching HEAD `settleOnce`: nudge + drain; reconcile markers
 * only after domain already matches (reconcile while diverged can strand
 * rejected optimistic rows).
 */
async function settleOnce(
  ctx: DrainUntilConvergedCtx
): Promise<InvariantViolation | null> {
  nudgeClients(ctx.clients);
  await drainScheduler(ctx);
  let domain = await checkDomainOnly(ctx);
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
  domain = await checkDomainOnly(ctx);
  if (domain !== null) return domain;
  for (const client of ctx.clients.values()) {
    let post: InvariantViolation | null;
    try {
      post = await checkPostInSyncInvariants(client.db);
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
  return checkDomainOnly(ctx);
}

/** Drain until domain + post invariants agree (no restoreNetwork — call recoverAll first). */
export async function drainUntilInSyncImpl(
  ctx: DrainUntilConvergedCtx
): Promise<void> {
  let last: InvariantViolation | null = null;
  for (let i = 0; i < 60; i += 1) {
    last = await settleOnce(ctx);
    if (last === null) return;
  }
  throw new Error(
    `convergence failed seed=${ctx.seed.toString(16)} now=${ctx.now()} ${last?.detail ?? ''}`
  );
}
