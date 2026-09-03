import { DST_FAULTS, RELIABLE_FAULTS, sampleFaultOptions } from './faults';
import { isDbOpen } from './invariants';
import { restartClientWithRetry } from './scenario/replay-step';
import type { SyncSurface } from './scenario/system';

/** Add N clients and optionally enable DST / sampled network faults. */
export async function bootClients(args: {
  readonly surface: SyncSurface;
  readonly clientCount: number;
  readonly sampleFaults: boolean;
  /** Mild fixed reorder/loss faults (ignored when sampleFaults is true). */
  readonly dstFaults?: boolean;
}): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < args.clientCount; i += 1) {
    const id = `c${i}`;
    await args.surface.addClient({ id, actorId: id });
    ids.push(id);
  }
  if (args.sampleFaults) {
    const sampled = sampleFaultOptions(args.surface.rng.fork('faults'));
    args.surface.kit.network.setDefaultFaults(sampled);
  } else if (args.dstFaults === true) {
    args.surface.kit.network.setDefaultFaults(DST_FAULTS);
  }
  await args.surface.advance(200);
  return ids;
}

function settleClientIds(
  surface: SyncSurface,
  bootIds: readonly string[]
): string[] {
  const ids = [...bootIds];
  for (const id of surface.clients.keys()) {
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Heal partitions, clear holds/faults, bring clients online, assert converge. */
export async function settleKit(args: {
  readonly surface: SyncSurface;
  readonly ids: readonly string[];
}): Promise<void> {
  args.surface.clearFailNextOpen();
  args.surface.clearStoragePressure();
  args.surface.clearBoundaryFaults();
  const ids = settleClientIds(args.surface, args.ids);
  for (const id of ids) {
    args.surface.net(id, 'all').set('ok');
  }
  args.surface.kit.network.setDefaultFaults(RELIABLE_FAULTS);
  for (const id of ids) {
    const client = args.surface.clients.get(id);
    const needsRestart = client === undefined || !(await isDbOpen(client.db));
    if (needsRestart) {
      await restartClientWithRetry(args.surface, id);
    }
    args.surface.clients.get(id)?.online(true);
    args.surface.clients.get(id)?.foreground(true);
  }
  await args.surface.assertConverged();
}
