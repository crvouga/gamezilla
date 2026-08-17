/**
 * Snapshot + palette methods attached onto a playground session façade.
 */

import type { createPlaygroundChessCommands } from '@apps/client/host/playground-chess-seed';
import {
  buildPlaygroundPaletteCommands,
  buildSnapshotLoadCommands,
} from '@apps/client/host/playground-fault-commands';
import {
  deletePlaygroundSnapshot,
  deletePlaygroundSnapshots,
  listPlaygroundSnapshots,
  loadPlaygroundSnapshot,
  purgeIncompatiblePlaygroundSnapshotsFromStore,
  type SnapshotSessionCtx,
  savePlaygroundSnapshot,
} from '@apps/client/host/playground-snapshots';
import type { ClientSystemResources } from '@apps/client/providers/client-system-resources';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type {
  PlaygroundPaletteCommand,
  PlaygroundSession,
} from '@pkgs/system-console/client';

export type SnapshotSessionApiArgs = {
  readonly snapshotStore: ObjectStore;
  readonly sessionRef: {
    current: PlaygroundSession<ClientSystemResources> | null;
  };
  readonly snapshotCtx: () => SnapshotSessionCtx;
  readonly getSnapshotLoads: () => PlaygroundPaletteCommand[];
  readonly setSnapshotLoads: (cmds: PlaygroundPaletteCommand[]) => void;
  readonly commands: ReturnType<typeof createPlaygroundChessCommands>;
  readonly notify: () => void;
};

async function refreshSnapshotLoads(
  session: PlaygroundSession<ClientSystemResources>,
  setSnapshotLoads: (cmds: PlaygroundPaletteCommand[]) => void,
  notify: () => void
): Promise<void> {
  setSnapshotLoads(await buildSnapshotLoadCommands(session));
  notify();
}

export function snapshotSessionMethods(
  args: SnapshotSessionApiArgs
): Pick<
  PlaygroundSession<ClientSystemResources>,
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
  } = args;
  const live = (): PlaygroundSession<ClientSystemResources> => {
    const s = sessionRef.current;
    if (s === null) throw new Error('playground session not ready');
    return s;
  };
  return {
    listPaletteCommands() {
      const s = live();
      const seed: PlaygroundPaletteCommand[] = commands.map((c) => ({
        id: `cmd:${c.id}`,
        title: c.label,
        category: 'Commands',
        keywords: [c.id, c.label],
        run: () => s.runCommand(c.id),
      }));
      return [
        ...buildPlaygroundPaletteCommands(s),
        ...getSnapshotLoads(),
        ...seed,
      ];
    },
    async refreshSnapshotPaletteCommands() {
      await refreshSnapshotLoads(live(), setSnapshotLoads, notify);
    },
    listSnapshots: () => listPlaygroundSnapshots(snapshotStore),
    async saveSnapshot(label) {
      const info = await savePlaygroundSnapshot(snapshotCtx(), label);
      await refreshSnapshotLoads(live(), setSnapshotLoads, notify);
      return info;
    },
    loadSnapshot: (id) => loadPlaygroundSnapshot(snapshotCtx(), id),
    async deleteSnapshot(id) {
      await deletePlaygroundSnapshot(snapshotStore, id);
      await refreshSnapshotLoads(live(), setSnapshotLoads, notify);
    },
    async deleteSnapshots(ids) {
      await deletePlaygroundSnapshots(snapshotStore, ids);
      await refreshSnapshotLoads(live(), setSnapshotLoads, notify);
    },
    async purgeIncompatibleSnapshots() {
      const n =
        await purgeIncompatiblePlaygroundSnapshotsFromStore(snapshotStore);
      await refreshSnapshotLoads(live(), setSnapshotLoads, notify);
      return n;
    },
  };
}
