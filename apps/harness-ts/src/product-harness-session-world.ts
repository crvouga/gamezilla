/**
 * The world a session opens on: the one a bug report carries when the
 * address asks for it, else the newest kept snapshot.
 */

import type { HarnessCheckpoint } from '@pkgs/harness-console-shared-ts/checkpoint';
import { restoreCheckpoint } from './product-harness-checkpoint';
import type { SnapshotSessionCtx } from './product-harness-snapshots';
import {
  listProductHarnessSnapshots,
  loadProductHarnessSnapshot,
} from './product-harness-snapshots';

/** Opens on the world a bug report carries; false when there is none to open. */
export async function openReportedWorld(
  ctx: () => SnapshotSessionCtx,
  reportedWorld: (() => Promise<HarnessCheckpoint | null>) | undefined
): Promise<boolean> {
  const checkpoint = await reportedWorld?.().catch(() => null);
  if (checkpoint === null || checkpoint === undefined) return false;
  const session = ctx();
  try {
    await restoreCheckpoint(session, checkpoint);
    return session.maps.clients.size > 0;
  } catch {
    // A world this version cannot open: the kept one, or a fresh one, instead.
    return false;
  }
}

/** Opens on the newest snapshot this version can use, if any. */
export async function loadNewestSnapshot(
  ctx: () => SnapshotSessionCtx
): Promise<void> {
  const session = ctx();
  const snaps = await listProductHarnessSnapshots(session.store);
  const compatible = snaps.filter((s) => s.compatible);
  if (compatible.length === 0) return;
  let newest = compatible[0]!;
  for (const s of compatible) {
    if (s.createdAtMs > newest.createdAtMs) newest = s;
  }
  await loadProductHarnessSnapshot(session, newest.id);
}
