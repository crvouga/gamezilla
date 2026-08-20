import {
  Box,
  Button,
  Checkbox,
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

import type {
  PlaygroundSession,
  PlaygroundSnapshotInfo,
} from '../../shared/ports';
import {
  formatSnapshotAge,
  formatSnapshotTitle,
} from './playground-snapshot-format';
import { usePlaygroundSnapshots } from './use-playground-snapshots';
import {
  type SortKey,
  useSnapshotChromeState,
} from './use-snapshot-chrome-state';

const ICON_SIZE = 40;
const GLYPH_SIZE = 20;
const SELECT_WIDTH = 150;

type SnapshotListApi = ReturnType<typeof usePlaygroundSnapshots>;

function snapshotOptionLabel(
  snap: PlaygroundSnapshotInfo,
  nowMs: number
): string {
  const age = formatSnapshotAge(snap.createdAtMs, nowMs);
  return snap.compatible ? age : `${age} · outdated`;
}

function SnapshotSurfaceExtra(props: {
  readonly sort: SortKey;
  readonly onSort: (sort: SortKey) => void;
  readonly allChecked: boolean;
  readonly someChecked: boolean;
  readonly checkedCount: number;
  readonly busy: boolean;
  readonly onToggleAll: (next: boolean) => void;
  readonly onDeleteChecked: () => void;
}) {
  const {
    sort,
    onSort,
    allChecked,
    someChecked,
    checkedCount,
    busy,
    onToggleAll,
    onDeleteChecked,
  } = props;
  return (
    <Box sx={{ gap: 1.5 }}>
      <SegmentedControl
        segments={[
          { key: 'newest', label: 'Newest' },
          { key: 'oldest', label: 'Oldest' },
        ]}
        selected={sort}
        onSelect={onSort}
      />
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Checkbox
          label={allChecked ? 'Clear' : 'Select all'}
          checked={allChecked || someChecked}
          onToggle={onToggleAll}
          disabled={busy}
        />
        <Button
          size="sm"
          intent="danger"
          title={
            checkedCount === 0 ? 'Delete' : `Delete ${String(checkedCount)}`
          }
          disabled={busy || checkedCount === 0}
          onPress={onDeleteChecked}
        />
      </Box>
    </Box>
  );
}

function SnapshotSelect(props: {
  readonly list: SnapshotListApi;
  readonly sortedSnaps: readonly PlaygroundSnapshotInfo[];
  readonly snapById: ReadonlyMap<string, PlaygroundSnapshotInfo>;
  readonly selectValue: string;
  readonly sort: SortKey;
  readonly nowMs: number;
  readonly checkedIds: ReadonlySet<string>;
  readonly onSelectId: (id: string) => void;
  readonly onSort: (sort: SortKey) => void;
  readonly onToggleChecked: (id: string, next: boolean) => void;
  readonly onToggleAll: (next: boolean) => void;
  readonly onDeleteChecked: () => void;
}) {
  const {
    list,
    sortedSnaps,
    snapById,
    selectValue,
    sort,
    nowMs,
    checkedIds,
    onSelectId,
    onSort,
    onToggleChecked,
    onToggleAll,
    onDeleteChecked,
  } = props;
  const allChecked =
    sortedSnaps.length > 0 && sortedSnaps.every((s) => checkedIds.has(s.id));
  const someChecked = sortedSnaps.some((s) => checkedIds.has(s.id));
  return (
    <Box sx={{ width: SELECT_WIDTH, flexShrink: 0, minWidth: 0 }}>
      <Select
        size="sm"
        options={sortedSnaps.map((s) => ({
          value: s.id,
          label: snapshotOptionLabel(s, nowMs),
          disabled: !s.compatible,
        }))}
        value={selectValue}
        onValueChange={(id) => {
          const snap = snapById.get(id);
          if (snap === undefined || !snap.compatible) return;
          onSelectId(id);
          void list.onLoad(id).catch(() => undefined);
        }}
        surfaceTitle="Snapshots"
        surfaceExtra={
          <SnapshotSurfaceExtra
            sort={sort}
            onSort={onSort}
            allChecked={allChecked}
            someChecked={someChecked}
            checkedCount={checkedIds.size}
            busy={list.busy}
            onToggleAll={onToggleAll}
            onDeleteChecked={onDeleteChecked}
          />
        }
        disabled={list.busy || list.snaps.length === 0}
        renderOption={(option, selected, onPick) => {
          const snap = snapById.get(option.value);
          if (snap === undefined) return null;
          const outdated = !snap.compatible;
          return (
            <Box
              sx={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 1,
                opacity: outdated ? 0.4 : 1,
              }}
            >
              <Checkbox
                checked={checkedIds.has(snap.id)}
                onToggle={(next) => onToggleChecked(snap.id, next)}
                disabled={list.busy}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <ListItem
                  title={formatSnapshotTitle(snap.createdAtMs)}
                  subtitle={snapshotOptionLabel(snap, nowMs)}
                  trailing={
                    selected && !outdated ? (
                      <Text sx={{ color: 'tint', fontSize: 16 }} label="✓" />
                    ) : undefined
                  }
                  {...(outdated ? {} : { onPress: onPick })}
                />
              </Box>
            </Box>
          );
        }}
      />
    </Box>
  );
}

function SnapshotChromeActions(props: {
  readonly list: SnapshotListApi;
  readonly hasCompatibleSelection: boolean;
  readonly selectedId: string | null;
  readonly hasIncompatible: boolean;
  readonly onSaved: (id: string) => void;
  readonly onPurge: () => void;
  readonly openPalette: () => void;
}) {
  const {
    list,
    hasCompatibleSelection,
    selectedId,
    hasIncompatible,
    onSaved,
    onPurge,
    openPalette,
  } = props;
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
        disabled={list.busy || !hasCompatibleSelection}
        onPress={() => {
          if (selectedId === null) return;
          void list.onLoad(selectedId);
        }}
      >
        <RotateCcwIcon size={GLYPH_SIZE} />
      </IconButton>
      {hasIncompatible ? (
        <IconButton
          label="Purge incompatible snapshots"
          size={ICON_SIZE}
          disabled={list.busy}
          onPress={onPurge}
        >
          <Trash2Icon size={GLYPH_SIZE} />
        </IconButton>
      ) : null}
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

/** TabStrip trailing: snapshot Select + save / reload / palette icon buttons. */
export function PlaygroundSnapshotChrome(props: {
  readonly session: PlaygroundSession;
}) {
  const { session } = props;
  const list = usePlaygroundSnapshots(session);
  const state = useSnapshotChromeState(list);
  const { open: openPalette } = useCommandPalette();
  const nowMs = session.clock.now();
  const deleteCount = state.pendingDeleteIds?.length ?? 0;

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
        checkedIds={state.checkedIds}
        onSelectId={state.setSelectedId}
        onSort={state.setSort}
        onToggleChecked={state.onToggleChecked}
        onToggleAll={state.onToggleAll}
        onDeleteChecked={() => state.setPendingDeleteIds([...state.checkedIds])}
      />
      <SnapshotChromeActions
        list={list}
        hasCompatibleSelection={state.hasCompatibleSelection}
        selectedId={state.selectedId}
        hasIncompatible={state.hasIncompatible}
        onSaved={state.setSelectedId}
        onPurge={() => state.setPurgeOpen(true)}
        openPalette={openPalette}
      />
      <MutationModal
        visible={state.pendingDeleteIds !== null}
        onClose={state.closeDelete}
        title={
          deleteCount === 1
            ? 'Delete snapshot?'
            : `Delete ${String(deleteCount)} snapshots?`
        }
        message="Permanently remove the selected snapshots from ObjectStore. This cannot be undone."
        submitLabel="Delete"
        variant="destructive"
        operation={state.runDelete}
        successTitle="Deleted"
        successBody="Selected snapshots were removed."
        onSuccess={state.closeDelete}
        stackId="playground-snapshot-chrome-delete"
      />
      <MutationModal
        visible={state.purgeOpen}
        onClose={state.closePurge}
        title="Purge incompatible?"
        message="Delete every snapshot whose schema no longer matches this app. Compatible snapshots are kept."
        submitLabel="Purge incompatible"
        variant="destructive"
        operation={state.runPurge}
        successTitle="Purged"
        successBody="Outdated snapshots were removed."
        onSuccess={state.closePurge}
        stackId="playground-snapshot-chrome-purge"
      />
    </Box>
  );
}
