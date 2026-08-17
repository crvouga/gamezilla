import { useCallback, useEffect, useState } from 'react';

import type {
  PlaygroundSession,
  PlaygroundSnapshotInfo,
} from '../../shared/ports';

/** List + mutate ObjectStore playground snapshots (busy/error included). */
export function usePlaygroundSnapshots<R>(session: PlaygroundSession<R>) {
  const [snaps, setSnaps] = useState<readonly PlaygroundSnapshotInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await session.listSnapshots();
      setSnaps(list);
      await session.refreshSnapshotPaletteCommands();
      setError(null);
      return list;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return [];
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(
    async <T>(op: () => Promise<T>): Promise<T> => {
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
    },
    [refresh]
  );

  const dropLocal = useCallback((ids: readonly string[]) => {
    const drop = new Set(ids);
    setSnaps((prev) => prev.filter((s) => !drop.has(s.id)));
  }, []);

  return {
    snaps,
    busy,
    error,
    refresh,
    onSave: () => run(() => session.saveSnapshot()),
    onLoad: (id: string) => run(() => session.loadSnapshot(id)),
    onDelete: (id: string) =>
      run(async () => {
        dropLocal([id]);
        await session.deleteSnapshot(id);
      }),
    onDeleteMany: (ids: readonly string[]) =>
      run(async () => {
        dropLocal(ids);
        await session.deleteSnapshots(ids);
      }),
    onPurgeIncompatible: () =>
      run(async () => {
        const outdated = snaps.filter((s) => !s.compatible).map((s) => s.id);
        dropLocal(outdated);
        return session.purgeIncompatibleSnapshots();
      }),
  };
}
