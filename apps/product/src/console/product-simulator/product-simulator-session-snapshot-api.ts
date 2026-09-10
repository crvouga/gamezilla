/**
 * Snapshot + palette methods attached onto a product-simulator session façade.
 */

import type { createProductSimulatorChessCommands } from '@apps/product/product-simulator/product-simulator-chess-seed';
import {
  buildProductSimulatorPaletteCommands,
  buildSnapshotLoadCommands,
} from '@apps/product/product-simulator/product-simulator-fault-commands';
import {
  deleteProductSimulatorSnapshot,
  deleteProductSimulatorSnapshots,
  listProductSimulatorSnapshots,
  loadProductSimulatorSnapshot,
  purgeIncompatibleProductSimulatorSnapshotsFromStore,
  type SnapshotSessionCtx,
  saveProductSimulatorSnapshot,
} from '@apps/product/product-simulator/product-simulator-snapshots';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type {
  ProductSimulatorPaletteCommand,
  ProductSimulatorSession,
} from '@pkgs/sim-console/client';

export type SnapshotSessionApiArgs = {
  readonly snapshotStore: ObjectStore;
  readonly sessionRef: { current: ProductSimulatorSession | null };
  readonly snapshotCtx: () => SnapshotSessionCtx;
  readonly getSnapshotLoads: () => ProductSimulatorPaletteCommand[];
  readonly setSnapshotLoads: (cmds: ProductSimulatorPaletteCommand[]) => void;
  readonly commands: ReturnType<typeof createProductSimulatorChessCommands>;
  readonly notify: () => void;
  readonly fireDomainWake: (label: string) => void;
};

async function refreshSnapshotLoads(
  session: ProductSimulatorSession,
  setSnapshotLoads: (cmds: ProductSimulatorPaletteCommand[]) => void,
  notify: () => void
): Promise<void> {
  const cmds = await buildSnapshotLoadCommands(session);
  setSnapshotLoads(cmds);
  notify();
}

export function snapshotSessionMethods(
  args: SnapshotSessionApiArgs
): Pick<
  ProductSimulatorSession,
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
  const live = (): ProductSimulatorSession => {
    const s = sessionRef.current;
    if (s === null) throw new Error('simulator session not ready');
    return s;
  };
  return {
    listPaletteCommands() {
      const s = live();
      const seed: ProductSimulatorPaletteCommand[] = commands.map((c) => ({
        id: `cmd:${c.id}`,
        title: c.label,
        category: 'Commands',
        keywords: [c.id, c.label],
        run: () => s.runCommand(c.id),
      }));
      return [
        ...buildProductSimulatorPaletteCommands(s).map((cmd) =>
          wrapPaletteWake(cmd, fireDomainWake)
        ),
        ...getSnapshotLoads(),
        ...seed,
      ];
    },
    async refreshSnapshotPaletteCommands() {
      await refreshSnapshotLoads(live(), setSnapshotLoads, notify);
    },
    listSnapshots: () => listProductSimulatorSnapshots(snapshotStore),
    async saveSnapshot(label) {
      const info = await saveProductSimulatorSnapshot(snapshotCtx(), label);
      await refreshSnapshotLoads(live(), setSnapshotLoads, notify);
      return info;
    },
    loadSnapshot: (id) => loadProductSimulatorSnapshot(snapshotCtx(), id),
    async deleteSnapshot(id) {
      await deleteProductSimulatorSnapshot(snapshotStore, id);
      await refreshSnapshotLoads(live(), setSnapshotLoads, notify);
    },
    async deleteSnapshots(ids) {
      await deleteProductSimulatorSnapshots(snapshotStore, ids);
      await refreshSnapshotLoads(live(), setSnapshotLoads, notify);
    },
    async purgeIncompatibleSnapshots() {
      const n =
        await purgeIncompatibleProductSimulatorSnapshotsFromStore(
          snapshotStore
        );
      await refreshSnapshotLoads(live(), setSnapshotLoads, notify);
      return n;
    },
  };
}

function wrapPaletteWake(
  cmd: ProductSimulatorPaletteCommand,
  fireDomainWake: (label: string) => void
): ProductSimulatorPaletteCommand {
  return {
    ...cmd,
    run: async () => {
      await cmd.run();
      fireDomainWake('fault');
    },
  };
}
