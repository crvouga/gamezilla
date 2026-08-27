import type { SqlClient } from '@pkgs/sql-client/interface';

import type { SimClientHandle } from './client-factory';
import type { SimDomainPack } from './domain-pack';
import { RELIABLE_FAULTS } from './faults';
import type { InvariantViolation } from './invariants';
import type { NetEffectRegistry } from './net-effect';
import type { SimNetwork } from './network';
import type { SimScheduler } from './scheduler';
import type { SimServer } from './server';

export type AssertConvergedCtx = {
  readonly network: SimNetwork;
  readonly scheduler: SimScheduler;
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

function clientSnapshots(
  clients: ReadonlyMap<string, SimClientHandle>
): readonly { readonly label: string; readonly db: SqlClient }[] {
  return [...clients.values()].map((c) => ({
    label: c.id,
    db: c.db,
  }));
}

function nudgeClients(clients: ReadonlyMap<string, SimClientHandle>): void {
  for (const client of clients.values()) {
    client.engine.wakeUploads();
    // Must not await: refresh needs the sim scheduler to advance (runFor below).
    void client.engine.refreshQueries().catch(() => {
      // revoke / disconnect paths may reject refresh
    });
  }
}

async function settleOnce(
  ctx: AssertConvergedCtx
): Promise<InvariantViolation | null> {
  nudgeClients(ctx.clients);
  await ctx.scheduler.runFor(250);
  return ctx.domain.checkAllConverged({
    clients: clientSnapshots(ctx.clients),
    serverDb: ctx.server.db,
  });
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
  for (let i = 0; i < 40; i += 1) {
    last = await settleOnce(ctx);
    if (last === null) return;
  }
  throw new Error(
    `convergence failed seed=${ctx.seed.toString(16)} now=${ctx.now()} ${last?.detail ?? ''}`
  );
}
