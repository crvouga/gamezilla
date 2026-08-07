import type { SqlClient } from '@pkgs/sql-client/interface';

import type { SimClientHandle } from './client-factory';
import {
  checkAllClientsConverged,
  type InvariantViolation,
} from './invariants';
import type { SimNetwork } from './network';
import type { SimScheduler } from './scheduler';
import type { SimServer } from './server';

export type AssertConvergedCtx = {
  readonly network: SimNetwork;
  readonly scheduler: SimScheduler;
  readonly clients: ReadonlyMap<string, SimClientHandle>;
  readonly server: SimServer;
  readonly seed: bigint;
};

function clientSnapshots(
  clients: ReadonlyMap<string, SimClientHandle>
): readonly { readonly label: string; readonly db: SqlClient }[] {
  return [...clients.values()].map((c) => ({
    label: c.id,
    db: c.db,
  }));
}

async function settleOnce(
  ctx: AssertConvergedCtx
): Promise<InvariantViolation | null> {
  await ctx.scheduler.runFor(250);
  return checkAllClientsConverged({
    clients: clientSnapshots(ctx.clients),
    serverDb: ctx.server.db,
  });
}

/** Heal and settle until all clients match server notes (or throw). */
export async function assertConvergedImpl(
  ctx: AssertConvergedCtx
): Promise<void> {
  ctx.network.healAll();
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
    `convergence failed seed=${ctx.seed.toString(16)} ${last?.detail ?? ''}`
  );
}
