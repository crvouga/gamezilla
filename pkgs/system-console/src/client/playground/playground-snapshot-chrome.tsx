import {
  Box,
  IconButton,
  ListItem,
  MutationModal,
  RotateCcwIcon,
  SaveIcon,
  SearchIcon,
  SegmentedControl,
  Select,
  Text,
  Trash2Icon,
  useCommandPalette,
} from '@pkgs/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  PlaygroundSession,
  PlaygroundSnapshotInfo,
} from '../../shared/ports';
import {
  formatSnapshotAge,
  formatSnapshotTitle,
} from './playground-snapshot-format';
import { usePlaygroundSnapshots } from './use-playground-snapshots';

const ICON_SIZE = 40;
const GLYPH_SIZE = 20;
const SELECT_WIDTH = 150;

type SortKey = 'newest' | 'oldest';

type SnapshotListApi = ReturnType<typeof usePlaygroundSnapshots>;

function SnapshotSelect(props: {
  readonly list: SnapshotListApi;
  readonly sortedSnaps: readonly PlaygroundSnapshotInfo[];
  readonly snapById: ReadonlyMap<string, PlaygroundSnapshotInfo>;
  readonly selectValue: string;
  readonly sort: SortKey;
  readonly nowMs: number;
  readonly onSelectId: (id: string) => void;
  readonly onSort: (sort: SortKey) => void;
  readonly onDeleteTarget: (snap: PlaygroundSnapshotInfo) => void;
}) {
  const {
    list,
    sortedSnaps,
    snapById,
    selectValue,
    sort,
    nowMs,
    onSelectId,
    onSort,
    onDeleteTarget,
  } = props;
  return (
    <Box sx={{ width: SELECT_WIDTH, flexShrink: 0, minWidth: 0 }}>
      <Select
        size="sm"
        options={sortedSnaps.map((s) => ({
          value: s.id,
          label: formatSnapshotTitle(s.createdAtMs),
        }))}
        value={selectValue}
        onValueChange={(id) => {
          onSelectId(id);
          void list.onLoad(id).catch(() => undefined);
        }}
        surfaceTitle="Snapshots"
        surfaceExtra={
          <SegmentedControl
            segments={[
              { key: 'newest', label: 'Newest' },
              { key: 'oldest', label: 'Oldest' },
            ]}
            selected={sort}
            onSelect={onSort}
          />
        }
        disabled={list.busy || list.snaps.length === 0}
        renderOption={(option, selected, onPick) => {
          const snap = snapById.get(option.value);
          if (snap === undefined) return null;
          return (
            <Box
              sx={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <ListItem
                  title={formatSnapshotTitle(snap.createdAtMs)}
                  subtitle={formatSnapshotAge(snap.createdAtMs, nowMs)}
                  trailing={
                    selected ? (
                      <Text sx={{ color: 'tint', fontSize: 16 }} label="✓" />
                    ) : undefined
                  }
                  onPress={onPick}
                />
              </Box>
              <IconButton
                label="Delete snapshot"
                size={32}
                disabled={list.busy}
                onPress={() => onDeleteTarget(snap)}
              >
                <Trash2Icon size={16} />
              </IconButton>
            </Box>
          );
        }}
      />
    </Box>
  );
}

function SnapshotChromeActions(props: {
  readonly list: SnapshotListApi;
  readonly hasSelection: boolean;
  readonly selectedId: string | null;
  readonly onSaved: (id: string) => void;
  readonly openPalette: () => void;
}) {
  const { list, hasSelection, selectedId, onSaved, openPalette } = props;
  return (
    <>
      <IconButton
        label="Save snapshot"
        size={ICON_SIZE}
        disabled={list.busy}
        onPress={() => {
          void list
            .onSave()
            .then((info) => {
              onSaved(info.id);
            })
            .catch(() => undefined);
        }}
      >
        <SaveIcon size={GLYPH_SIZE} />
      </IconButton>
      <IconButton
        label="Reload current snapshot"
        size={ICON_SIZE}
        disabled={list.busy || !hasSelection}
        onPress={() => {
          if (selectedId === null) return;
          void list.onLoad(selectedId);
        }}
      >
        <RotateCcwIcon size={GLYPH_SIZE} />
      </IconButton>
      <IconButton
        label="Open command palette"
        size={ICON_SIZE}
        onPress={openPalette}
      >
        <SearchIcon size={GLYPH_SIZE} />
      </IconButton>
      {list.error !== null ? (
        <Text
          sx={{ color: 'danger', fontSize: 11, maxWidth: 80 }}
          numberOfLines={1}
          label={list.error}
        />
      ) : null}
    </>
  );
}

function useSnapshotChromeState(list: SnapshotListApi) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('newest');
  const [deleteTarget, setDeleteTarget] =
    useState<PlaygroundSnapshotInfo | null>(null);

  useEffect(() => {
    if (list.snaps.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev !== null && list.snaps.some((s) => s.id === prev)) return prev;
      return list.snaps[0]!.id;
    });
  }, [list.snaps]);

  const sortedSnaps = useMemo(() => {
    const copy = [...list.snaps];
    copy.sort((a, b) =>
      sort === 'newest'
        ? b.createdAtMs - a.createdAtMs
        : a.createdAtMs - b.createdAtMs
    );
    return copy;
  }, [list.snaps, sort]);

  const snapById = useMemo(() => {
    const map = new Map<string, PlaygroundSnapshotInfo>();
    for (const s of list.snaps) map.set(s.id, s);
    return map;
  }, [list.snaps]);

  const closeDelete = useCallback(() => setDeleteTarget(null), []);
  const runDelete = useCallback(async () => {
    if (deleteTarget === null) return;
    const id = deleteTarget.id;
    await list.onDelete(id);
    setSelectedId((prev) => (prev === id ? null : prev));
  }, [deleteTarget, list]);

  return {
    selectedId,
    setSelectedId,
    sort,
    setSort,
    deleteTarget,
    setDeleteTarget,
    sortedSnaps,
    snapById,
    closeDelete,
    runDelete,
  };
}

/** TabStrip trailing: snapshot Select + save / reload / palette icon buttons. */
export function PlaygroundSnapshotChrome<R>(props: {
  readonly session: PlaygroundSession<R>;
}) {
  const { session } = props;
  const list = usePlaygroundSnapshots(session);
  const state = useSnapshotChromeState(list);
  const { open: openPalette } = useCommandPalette();
  const nowMs = session.io.clock.now();

  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 0.5,
        flexShrink: 0,
      }}
    >
      <SnapshotSelect
        list={list}
        sortedSnaps={state.sortedSnaps}
        snapById={state.snapById}
        selectValue={state.selectedId ?? ''}
        sort={state.sort}
        nowMs={nowMs}
        onSelectId={state.setSelectedId}
        onSort={state.setSort}
        onDeleteTarget={state.setDeleteTarget}
      />
      <SnapshotChromeActions
        list={list}
        hasSelection={state.selectedId !== null}
        selectedId={state.selectedId}
        onSaved={state.setSelectedId}
        openPalette={openPalette}
      />
      <MutationModal
        visible={state.deleteTarget !== null}
        onClose={state.closeDelete}
        title="Delete snapshot?"
        message={
          state.deleteTarget === null
            ? ''
            : `Permanently remove “${formatSnapshotTitle(state.deleteTarget.createdAtMs)}” from ObjectStore. This cannot be undone.`
        }
        submitLabel="Delete"
        variant="destructive"
        operation={state.runDelete}
        successTitle="Snapshot deleted"
        successBody="The snapshot is gone from ObjectStore."
        onSuccess={state.closeDelete}
        stackId="playground-snapshot-chrome-delete"
      />
    </Box>
  );
}
