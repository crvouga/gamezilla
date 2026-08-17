import { useCallback, useEffect, useMemo, useState } from 'react';

import type { PlaygroundSnapshotInfo } from '../../shared/ports';
import type { usePlaygroundSnapshots } from './use-playground-snapshots';

export type SortKey = 'newest' | 'oldest';

type SnapshotListApi = ReturnType<typeof usePlaygroundSnapshots>;

function useSortedSnaps(
  snaps: readonly PlaygroundSnapshotInfo[],
  sort: SortKey
) {
  return useMemo(() => {
    const copy = [...snaps];
    copy.sort((a, b) =>
      sort === 'newest'
        ? b.createdAtMs - a.createdAtMs
        : a.createdAtMs - b.createdAtMs
    );
    return copy;
  }, [snaps, sort]);
}

function useSnapById(snaps: readonly PlaygroundSnapshotInfo[]) {
  return useMemo(() => {
    const map = new Map<string, PlaygroundSnapshotInfo>();
    for (const s of snaps) map.set(s.id, s);
    return map;
  }, [snaps]);
}

function useCheckedSnapshotIds(snaps: readonly PlaygroundSnapshotInfo[]) {
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );

  useEffect(() => {
    if (snaps.length === 0) {
      setCheckedIds(new Set());
      return;
    }
    setCheckedIds((prev) => {
      const next = new Set<string>();
      for (const s of snaps) {
        if (prev.has(s.id)) next.add(s.id);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [snaps]);

  const onToggleChecked = useCallback((id: string, next: boolean) => {
    setCheckedIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  }, []);

  const clearChecked = useCallback(() => setCheckedIds(new Set()), []);

  return { checkedIds, setCheckedIds, onToggleChecked, clearChecked };
}

function useSelectedSnapshotId(snaps: readonly PlaygroundSnapshotInfo[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (snaps.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev !== null && snaps.some((s) => s.id === prev)) return prev;
      const firstCompatible = snaps.find((s) => s.compatible);
      return (firstCompatible ?? snaps[0])!.id;
    });
  }, [snaps]);

  return { selectedId, setSelectedId };
}

export function useSnapshotChromeState(list: SnapshotListApi) {
  const [sort, setSort] = useState<SortKey>('newest');
  const { selectedId, setSelectedId } = useSelectedSnapshotId(list.snaps);
  const { checkedIds, setCheckedIds, onToggleChecked, clearChecked } =
    useCheckedSnapshotIds(list.snaps);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<
    readonly string[] | null
  >(null);
  const [purgeOpen, setPurgeOpen] = useState(false);

  const sortedSnaps = useSortedSnaps(list.snaps, sort);
  const snapById = useSnapById(list.snaps);

  const onToggleAll = useCallback(
    (next: boolean) => {
      if (!next) {
        clearChecked();
        return;
      }
      setCheckedIds(new Set(sortedSnaps.map((s) => s.id)));
    },
    [clearChecked, setCheckedIds, sortedSnaps]
  );

  const closeDelete = useCallback(() => setPendingDeleteIds(null), []);
  const runDelete = useCallback(async () => {
    if (pendingDeleteIds === null || pendingDeleteIds.length === 0) return;
    const ids = pendingDeleteIds;
    await list.onDeleteMany(ids);
    clearChecked();
    setSelectedId((prev) =>
      prev !== null && ids.includes(prev) ? null : prev
    );
    setPendingDeleteIds(null);
  }, [pendingDeleteIds, list, clearChecked, setSelectedId]);

  const closePurge = useCallback(() => setPurgeOpen(false), []);
  const runPurge = useCallback(async () => {
    await list.onPurgeIncompatible();
    setPurgeOpen(false);
  }, [list]);

  const selectedSnap =
    selectedId === null ? undefined : snapById.get(selectedId);

  return {
    selectedId,
    setSelectedId,
    sort,
    setSort,
    checkedIds,
    pendingDeleteIds,
    setPendingDeleteIds,
    purgeOpen,
    setPurgeOpen,
    sortedSnaps,
    snapById,
    onToggleChecked,
    onToggleAll,
    closeDelete,
    runDelete,
    closePurge,
    runPurge,
    hasCompatibleSelection:
      selectedSnap !== undefined && selectedSnap.compatible,
    hasIncompatible: list.snaps.some((s) => !s.compatible),
  };
}
