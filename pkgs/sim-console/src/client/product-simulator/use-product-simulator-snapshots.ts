import { createEffect, createSignal } from 'solid-js';

import type {
  ProductSimulatorSession,
  ProductSimulatorSnapshotInfo,
} from '../../shared/ports';

/** List + mutate ObjectStore product-simulator snapshots (busy/error included). */
export function useProductSimulatorSnapshots(
  session: () => ProductSimulatorSession
) {
  const [snaps, setSnaps] = createSignal<
    readonly ProductSimulatorSnapshotInfo[]
  >([]);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const refresh = async () => {
    try {
      const list = await session().listSnapshots();
      setSnaps(list);
      await session().refreshSnapshotPaletteCommands();
      setError(null);
      return list;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return [];
    }
  };

  createEffect(() => {
    session();
    void refresh();
  });

  const run = async <T>(op: () => Promise<T>): Promise<T> => {
    setBusy(true);
    setError(null);
    try {
      const result = await op();
      await refresh();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const dropLocal = (ids: readonly string[]) => {
    const drop = new Set(ids);
    setSnaps((prev) => prev.filter((s) => !drop.has(s.id)));
  };

  return {
    get snaps() {
      return snaps();
    },
    get busy() {
      return busy();
    },
    get error() {
      return error();
    },
    refresh,
    onSave: () => run(() => session().saveSnapshot()),
    onLoad: (id: string) => run(() => session().loadSnapshot(id)),
    onDelete: (id: string) =>
      run(async () => {
        dropLocal([id]);
        await session().deleteSnapshot(id);
      }),
    onDeleteMany: (ids: readonly string[]) =>
      run(async () => {
        dropLocal(ids);
        await session().deleteSnapshots(ids);
      }),
    onPurgeIncompatible: () =>
      run(async () => {
        const outdated = snaps()
          .filter((s) => !s.compatible)
          .map((s) => s.id);
        dropLocal(outdated);
        return session().purgeIncompatibleSnapshots();
      }),
  };
}
