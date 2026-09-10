import { createEffect, createMemo, createSignal } from 'solid-js';

import type { ProductSimulatorSnapshotInfo } from '../../shared/ports';
import type { useProductSimulatorSnapshots } from './use-product-simulator-snapshots';

export type SortKey = 'newest' | 'oldest';

type SnapshotListApi = ReturnType<typeof useProductSimulatorSnapshots>;

function sortSnaps(
  snaps: readonly ProductSimulatorSnapshotInfo[],
  sort: SortKey
): readonly ProductSimulatorSnapshotInfo[] {
  const copy = [...snaps];
  copy.sort((a, b) =>
    sort === 'newest'
      ? b.createdAtMs - a.createdAtMs
      : a.createdAtMs - b.createdAtMs
  );
  return copy;
}

function snapByIdMap(
  snaps: readonly ProductSimulatorSnapshotInfo[]
): ReadonlyMap<string, ProductSimulatorSnapshotInfo> {
  const map = new Map<string, ProductSimulatorSnapshotInfo>();
  for (const s of snaps) map.set(s.id, s);
  return map;
}

function useCheckedSnapshotIds(snaps: () => readonly ProductSimulatorSnapshotInfo[]) {
  const [checkedIds, setCheckedIds] = createSignal<ReadonlySet<string>>(
    new Set<string>()
  );

  createEffect(() => {
    const current = snaps();
    if (current.length === 0) {
      setCheckedIds(new Set<string>());
      return;
    }
    setCheckedIds((prev) => {
      const next = new Set<string>();
      for (const s of current) {
        if (prev.has(s.id)) next.add(s.id);
      }
      return next.size === prev.size ? prev : next;
    });
  });

  const onToggleChecked = (id: string, next: boolean) => {
    setCheckedIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  };

  const clearChecked = () => setCheckedIds(new Set<string>());

  return {
    get checkedIds() {
      return checkedIds();
    },
    setCheckedIds,
    onToggleChecked,
    clearChecked,
  };
}

function useSelectedSnapshotId(snaps: () => readonly ProductSimulatorSnapshotInfo[]) {
  const [selectedId, setSelectedId] = createSignal<string | null>(null);

  createEffect(() => {
    const current = snaps();
    if (current.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev !== null && current.some((s) => s.id === prev)) return prev;
      const firstCompatible = current.find((s) => s.compatible);
      return (firstCompatible ?? current[0])!.id;
    });
  });

  return {
    get selectedId() {
      return selectedId();
    },
    setSelectedId,
  };
}

export function useSnapshotChromeState(list: SnapshotListApi) {
  const [sort, setSort] = createSignal<SortKey>('newest');
  const snaps = () => list.snaps;
  const selected = useSelectedSnapshotId(snaps);
  const checked = useCheckedSnapshotIds(snaps);
  const [pendingDeleteIds, setPendingDeleteIds] = createSignal<
    readonly string[] | null
  >(null);
  const [purgeOpen, setPurgeOpen] = createSignal(false);

  const sortedSnaps = createMemo(() => sortSnaps(snaps(), sort()));
  const snapById = createMemo(() => snapByIdMap(snaps()));

  const onToggleAll = (next: boolean) => {
    if (!next) {
      checked.clearChecked();
      return;
    }
    checked.setCheckedIds(new Set(sortedSnaps().map((s) => s.id)));
  };

  const closeDelete = () => setPendingDeleteIds(null);
  const runDelete = async () => {
    const ids = pendingDeleteIds();
    if (ids === null || ids.length === 0) return;
    await list.onDeleteMany(ids);
    checked.clearChecked();
    selected.setSelectedId((prev) =>
      prev !== null && ids.includes(prev) ? null : prev
    );
    setPendingDeleteIds(null);
  };

  const closePurge = () => setPurgeOpen(false);
  const runPurge = async () => {
    await list.onPurgeIncompatible();
    setPurgeOpen(false);
  };

  const selectedSnap = () => {
    const id = selected.selectedId;
    return id === null ? undefined : snapById().get(id);
  };

  return {
    get selectedId() {
      return selected.selectedId;
    },
    setSelectedId: selected.setSelectedId,
    get sort() {
      return sort();
    },
    setSort,
    get checkedIds() {
      return checked.checkedIds;
    },
    get pendingDeleteIds() {
      return pendingDeleteIds();
    },
    setPendingDeleteIds,
    get purgeOpen() {
      return purgeOpen();
    },
    setPurgeOpen,
    get sortedSnaps() {
      return sortedSnaps();
    },
    get snapById() {
      return snapById();
    },
    onToggleChecked: checked.onToggleChecked,
    onToggleAll,
    closeDelete,
    runDelete,
    closePurge,
    runPurge,
    get hasCompatibleSelection() {
      const snap = selectedSnap();
      return snap !== undefined && snap.compatible;
    },
    get hasIncompatible() {
      return snaps().some((s) => !s.compatible);
    },
  };
}
