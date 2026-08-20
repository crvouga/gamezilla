/**
 * Snapshot + palette methods attached onto a playground session façade.
 */

import type { ObjectStore } from '@pkgs/object-store/interface';
import type {
  PlaygroundPaletteCommand,
  PlaygroundSession,
} from '@pkgs/sim-console/client';
import type { createPlaygroundChessCommands } from '@sim/console/playground/playground-chess-seed';
import {
  buildPlaygroundPaletteCommands,
  buildSnapshotLoadCommands,
} from '@sim/console/playground/playground-fault-commands';
import {
  deletePlaygroundSnapshot,
  deletePlaygroundSnapshots,
  listPlaygroundSnapshots,
  loadPlaygroundSnapshot,
  purgeIncompatiblePlaygroundSnapshotsFromStore,
  type SnapshotSessionCtx,
  savePlaygroundSnapshot,
} from '@sim/console/playground/playground-snapshots';

export type SnapshotSessionApiArgs = {
  readonly snapshotStore: ObjectStore;
  readonly sessionRef: { current: PlaygroundSession | null };
  readonly snapshotCtx: () => SnapshotSessionCtx;
  readonly getSnapshotLoads: () => PlaygroundPaletteCommand[];
  readonly setSnapshotLoads: (cmds: PlaygroundPaletteCommand[]) => void;
  readonly commands: ReturnType<typeof createPlaygroundChessCommands>;
  readonly notify: () => void;
  readonly fireDomainWake: (label: string) => void;
};

async function refreshSnapshotLoads(
  session: PlaygroundSession,
  setSnapshotLoads: (cmds: PlaygroundPaletteCommand[]) => void,
  notify: () => void
): Promise<void> {
  const cmds = await buildSnapshotLoadCommands(session);
  setSnapshotLoads(cmds);
  notify();
}

export function snapshotSessionMethods(
  args: SnapshotSessionApiArgs
): Pick<
  PlaygroundSession,
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
  const live = (): PlaygroundSession => {
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
        ...buildPlaygroundPaletteCommands(s).map((cmd) =>
          wrapPaletteWake(cmd, fireDomainWake)
        ),
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

function wrapPaletteWake(
  cmd: PlaygroundPaletteCommand,
  fireDomainWake: (label: string) => void
): PlaygroundPaletteCommand {
  return {
    ...cmd,
    run: async () => {
      await cmd.run();
      fireDomainWake('fault');
    },
  };
}
