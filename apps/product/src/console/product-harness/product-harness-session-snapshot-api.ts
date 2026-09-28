/**
 * Snapshot + palette methods attached onto a product-harness session façade.
 */

import type { createProductHarnessChessCommands } from '@apps/product/product-harness/product-harness-chess-seed';
import {
  buildProductHarnessPaletteCommands,
  buildSnapshotLoadCommands,
} from '@apps/product/product-harness/product-harness-fault-commands';
import {
  deleteProductHarnessSnapshot,
  deleteProductHarnessSnapshots,
  listProductHarnessSnapshots,
  loadProductHarnessSnapshot,
  purgeIncompatibleProductHarnessSnapshotsFromStore,
  type SnapshotSessionCtx,
  saveProductHarnessSnapshot,
} from '@apps/product/product-harness/product-harness-snapshots';
import type {
  ProductHarnessPaletteCommand,
  ProductHarnessSession,
} from '@pkgs/harness-console/client';
import type { ObjectStore } from '@pkgs/object-store/interface';

export type SnapshotSessionApiArgs = {
  readonly snapshotStore: ObjectStore;
  readonly sessionRef: { current: ProductHarnessSession | null };
  readonly snapshotCtx: () => SnapshotSessionCtx;
  readonly getSnapshotLoads: () => ProductHarnessPaletteCommand[];
  readonly setSnapshotLoads: (cmds: ProductHarnessPaletteCommand[]) => void;
  readonly commands: ReturnType<typeof createProductHarnessChessCommands>;
  readonly notify: () => void;
  readonly fireDomainWake: (label: string) => void;
};

async function refreshSnapshotLoads(
  session: ProductHarnessSession,
  setSnapshotLoads: (cmds: ProductHarnessPaletteCommand[]) => void,
  notify: () => void
): Promise<void> {
  const cmds = await buildSnapshotLoadCommands(session);
  setSnapshotLoads(cmds);
  notify();
}

export function snapshotSessionMethods(
  args: SnapshotSessionApiArgs
): Pick<
  ProductHarnessSession,
  | 'listPaletteCommands'
  | 'refreshSnapshotPaletteCommands'
  | 'listSnapshots'
  | 'saveSnapshot'
  | 'loadSnapshot'
  | 'deleteSnapshot'
  | 'deleteSnapshots'
  | 'purgeIncompatibleSnapshots'
> {
  const {
    snapshotStore,
    sessionRef,
    snapshotCtx,
    getSnapshotLoads,
    setSnapshotLoads,
    commands,
    notify,
    fireDomainWake,
  } = args;
  const live = (): ProductHarnessSession => {
    const s = sessionRef.current;
    if (s === null) throw new Error('harness session not ready');
    return s;
  };
  return {
    listPaletteCommands() {
      const s = live();
      const seed: ProductHarnessPaletteCommand[] = commands.map((c) => ({
        id: `cmd:${c.id}`,
        title: c.label,
        category: 'Commands',
        keywords: [c.id, c.label],
        run: () => s.runCommand(c.id),
      }));
      return [
        ...buildProductHarnessPaletteCommands(s).map((cmd) =>
          wrapPaletteWake(cmd, fireDomainWake)
        ),
        ...getSnapshotLoads(),
        ...seed,
      ];
    },
    async refreshSnapshotPaletteCommands() {
      await refreshSnapshotLoads(live(), setSnapshotLoads, notify);
    },
    listSnapshots: () => listProductHarnessSnapshots(snapshotStore),
    async saveSnapshot(label) {
      const info = await saveProductHarnessSnapshot(snapshotCtx(), label);
      await refreshSnapshotLoads(live(), setSnapshotLoads, notify);
      return info;
    },
    loadSnapshot: (id) => loadProductHarnessSnapshot(snapshotCtx(), id),
    async deleteSnapshot(id) {
      await deleteProductHarnessSnapshot(snapshotStore, id);
      await refreshSnapshotLoads(live(), setSnapshotLoads, notify);
    },
    async deleteSnapshots(ids) {
      await deleteProductHarnessSnapshots(snapshotStore, ids);
      await refreshSnapshotLoads(live(), setSnapshotLoads, notify);
    },
    async purgeIncompatibleSnapshots() {
      const n =
        await purgeIncompatibleProductHarnessSnapshotsFromStore(snapshotStore);
      await refreshSnapshotLoads(live(), setSnapshotLoads, notify);
      return n;
    },
  };
}

function wrapPaletteWake(
  cmd: ProductHarnessPaletteCommand,
  fireDomainWake: (label: string) => void
): ProductHarnessPaletteCommand {
  return {
    ...cmd,
    run: async () => {
      await cmd.run();
      fireDomainWake('fault');
    },
  };
}
